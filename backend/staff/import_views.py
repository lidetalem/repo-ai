"""
staff/import_views.py — AMECO External Staff Import Engine
===========================================================

Two endpoints:

  POST /api/staff/import/preview/
    Connect to the hosting company's database and return a preview list of
    staff records (without importing anything yet).  The frontend shows this
    so the admin can review before committing.

  POST /api/staff/import/run/
    Actually import the selected staff members.  Streams progress as
    newline-delimited JSON so the frontend can show a live progress bar.

Supported external DB engines:
  • PostgreSQL   (psycopg2)
  • MySQL/MariaDB (mysql-connector-python)
  • Microsoft SQL Server (pyodbc)
  • SQLite       (built-in — useful for testing)

The hosting company must expose their database with:
  - A host/port accessible from this server (VPN, whitelist, or public)
  - A read-only credential (we never write to their DB)
  - A known table/view that contains the staff columns we expect

Expected columns in the external table (configurable via field_map):
  first_name, middle_name, last_name, email, phone, position,
  department, gender, profile_image_url (or base64), face_*_url (optional)

Any column can be remapped via the `field_map` request body param.
"""

import io
import json
import base64
import logging
import uuid
import requests as http_requests
from django.http            import StreamingHttpResponse
from rest_framework.views   import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from authentication.permissions import IsSuperAdmin
from .models        import StaffProfile
from recognition.models  import BiometricData
from recognition.encoding import save_base64_image, compute_and_store_encodings
from django.contrib.contenttypes.models import ContentType

logger = logging.getLogger(__name__)

# ── Default column mapping ────────────────────────────────────────────────────
# Maps AMECO field names → expected column names in the external DB.
# The admin can override any of these via field_map in the request body.
DEFAULT_FIELD_MAP = {
    'first_name':        'first_name',
    'middle_name':       'middle_name',
    'last_name':         'last_name',
    'email':             'email',
    'phone_number':      'phone',
    'position':          'position',
    'department':        'department',
    'gender':            'gender',
    'profile_image_url': 'profile_image_url',
    'face_front_url':    'face_front_url',
    'face_left_url':     'face_left_url',
    'face_right_url':    'face_right_url',
    'face_down_url':     'face_down_url',
    'face_unusual_url':  'face_unusual_url',
}


# ── Database connector ────────────────────────────────────────────────────────

def _get_connection(conn_params):
    """
    Return a DB-API 2.0 connection based on the engine specified.
    Raises a descriptive exception if the connection fails.
    """
    engine = conn_params.get('engine', 'postgresql').lower()

    if engine == 'postgresql':
        import psycopg2
        return psycopg2.connect(
            host=conn_params['host'],
            port=int(conn_params.get('port', 5432)),
            dbname=conn_params['database'],
            user=conn_params['username'],
            password=conn_params['password'],
            connect_timeout=10,
            sslmode=conn_params.get('ssl_mode', 'prefer'),
        )

    elif engine in ('mysql', 'mariadb'):
        import mysql.connector
        return mysql.connector.connect(
            host=conn_params['host'],
            port=int(conn_params.get('port', 3306)),
            database=conn_params['database'],
            user=conn_params['username'],
            password=conn_params['password'],
            connection_timeout=10,
        )

    elif engine in ('mssql', 'sqlserver'):
        import pyodbc
        dsn = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={conn_params['host']},{conn_params.get('port', 1433)};"
            f"DATABASE={conn_params['database']};"
            f"UID={conn_params['username']};"
            f"PWD={conn_params['password']};"
        )
        return pyodbc.connect(dsn, timeout=10)

    elif engine == 'sqlite':
        import sqlite3
        return sqlite3.connect(conn_params['database'])

    else:
        raise ValueError(f"Unsupported engine: {engine}. Use postgresql, mysql, mssql, or sqlite.")


def _fetch_rows(conn_params, table, field_map, limit=None):
    """
    Connect to the external DB, run a SELECT on the specified table,
    and return rows as a list of dicts mapped to AMECO field names.
    """
    conn   = _get_connection(conn_params)
    cursor = conn.cursor()

    # Build SELECT — only the columns we actually need
    ext_cols   = list(field_map.values())
    select_sql = f"SELECT {', '.join(ext_cols)} FROM {table}"
    if limit:
        engine = conn_params.get('engine', 'postgresql').lower()
        if engine in ('postgresql', 'sqlite', 'mysql', 'mariadb'):
            select_sql += f" LIMIT {int(limit)}"
        elif engine in ('mssql', 'sqlserver'):
            select_sql = f"SELECT TOP {int(limit)} {', '.join(ext_cols)} FROM {table}"

    cursor.execute(select_sql)
    col_names = [d[0] for d in cursor.description]
    raw_rows  = cursor.fetchall()
    cursor.close()
    conn.close()

    # Map external column names → AMECO field names
    reverse_map = {v: k for k, v in field_map.items()}
    rows = []
    for raw in raw_rows:
        row = {}
        for col, val in zip(col_names, raw):
            ameco_key = reverse_map.get(col, col)
            row[ameco_key] = val if val is not None else ''
        rows.append(row)

    return rows


# ── Image fetching ────────────────────────────────────────────────────────────

def _url_to_base64(url):
    """Download an image URL and return it as a base64 string."""
    if not url or not str(url).startswith('http'):
        return None
    try:
        resp = http_requests.get(url, timeout=15, stream=True)
        resp.raise_for_status()
        return base64.b64encode(resp.content).decode('utf-8')
    except Exception as exc:
        logger.warning('Failed to fetch image %s: %s', url, exc)
        return None


def _is_base64(value):
    """Check if a value is already a base64 string rather than a URL."""
    if not value or not isinstance(value, str):
        return False
    return not value.startswith('http') and len(value) > 100


# ── Import a single staff row ─────────────────────────────────────────────────

def _import_one(row, registered_by, skip_existing):
    """
    Create a StaffProfile + BiometricData for one row dict.
    Returns (status, message) where status is 'created'|'skipped'|'error'.
    """
    from django.core.files.base import ContentFile

    name = f"{row.get('first_name','')} {row.get('last_name','')}".strip()

    # Skip if staff with same name+email already exists
    if skip_existing:
        email = row.get('email', '')
        if email and StaffProfile.objects.filter(email=email).exists():
            return 'skipped', f'{name} — already exists (email match)'

    try:
        # Create the StaffProfile
        profile = StaffProfile.objects.create(
            first_name   = str(row.get('first_name',  '') or '').strip(),
            middle_name  = str(row.get('middle_name', '') or '').strip(),
            last_name    = str(row.get('last_name',   '') or '').strip(),
            email        = str(row.get('email',        '') or '').strip(),
            phone_number = str(row.get('phone_number', '') or '').strip(),
            position     = str(row.get('position',     '') or '').strip(),
            department   = str(row.get('department',   '') or '').strip(),
            gender       = str(row.get('gender',       'M') or 'M')[:1].upper(),
            digital_id   = f'STF-{uuid.uuid4().hex[:8].upper()}',
            registered_by= registered_by,
            staff_tag    = 'Imported',
        )

        # Profile image
        profile_img_val = row.get('profile_image_url', '') or row.get('profile_image', '')
        if profile_img_val:
            b64 = profile_img_val if _is_base64(profile_img_val) else _url_to_base64(profile_img_val)
            if b64:
                raw = base64.b64decode(b64)
                profile.profile_image.save(f'profile_{profile.id}.jpg', ContentFile(raw), save=True)

        # Biometric / face images
        face_fields = [
            ('face_front_url',   'face_front'),
            ('face_left_url',    'face_left'),
            ('face_right_url',   'face_right'),
            ('face_down_url',    'face_down'),
            ('face_unusual_url', 'face_unusual'),
        ]

        ct  = ContentType.objects.get_for_model(profile)
        bio = BiometricData(content_type=ct, object_id=profile.id)

        has_faces = False
        for row_key, bio_field in face_fields:
            val = row.get(row_key, '') or ''
            if not val:
                continue
            b64 = val if _is_base64(val) else _url_to_base64(val)
            if b64:
                raw = base64.b64decode(b64)
                getattr(bio, bio_field).save(f'{bio_field}_{profile.id}.jpg', ContentFile(raw), save=False)
                has_faces = True

        bio.save()

        if has_faces:
            compute_and_store_encodings(bio)
            return 'created', f'{name} — imported with face recognition'
        else:
            return 'created', f'{name} — imported (no face images available)'

    except Exception as exc:
        logger.error('Import error for %s: %s', name, exc)
        # Clean up partial record
        try:
            StaffProfile.objects.filter(email=row.get('email', ''), registered_by=registered_by).last().delete()
        except Exception:
            pass
        return 'error', f'{name} — {str(exc)}'


# ── Preview endpoint ──────────────────────────────────────────────────────────

class StaffImportPreviewView(APIView):
    """
    POST /api/staff/import/preview/

    Body:
    {
      "connection": {
        "engine":   "postgresql",        // postgresql | mysql | mssql | sqlite
        "host":     "db.company.com",
        "port":     5432,
        "database": "hr_system",
        "username": "readonly_user",
        "password": "secret",
        "ssl_mode": "require"            // optional
      },
      "table":      "employees",         // table or view name in their DB
      "field_map":  { ... },             // optional column remapping
      "preview_limit": 50               // how many rows to show in preview
    }

    Returns up to `preview_limit` rows so the admin can verify the mapping
    before committing the import.  No data is written to AMECO's DB.
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        data       = request.data
        conn_params = data.get('connection', {})
        table       = data.get('table', 'employees')
        field_map   = {**DEFAULT_FIELD_MAP, **data.get('field_map', {})}
        limit       = min(int(data.get('preview_limit', 50)), 200)

        # Validate required fields
        required = ['host', 'database', 'username', 'password']
        if conn_params.get('engine', 'postgresql') != 'sqlite':
            missing = [f for f in required if not conn_params.get(f)]
            if missing:
                return Response({'error': f'Missing connection fields: {", ".join(missing)}'}, status=400)

        try:
            rows = _fetch_rows(conn_params, table, field_map, limit=limit)
        except Exception as exc:
            return Response({'error': f'Connection failed: {str(exc)}'}, status=400)

        # Build preview — mask face URLs for brevity, show key fields only
        preview = []
        for row in rows:
            preview.append({
                'first_name':   row.get('first_name', ''),
                'middle_name':  row.get('middle_name', ''),
                'last_name':    row.get('last_name', ''),
                'email':        row.get('email', ''),
                'phone_number': row.get('phone_number', ''),
                'position':     row.get('position', ''),
                'department':   row.get('department', ''),
                'gender':       row.get('gender', ''),
                'has_photo':    bool(row.get('profile_image_url') or row.get('profile_image')),
                'has_faces':    any(row.get(k) for k in [
                    'face_front_url', 'face_left_url', 'face_right_url',
                    'face_down_url', 'face_unusual_url',
                ]),
            })

        return Response({
            'total':   len(preview),
            'rows':    preview,
            'message': f'Found {len(preview)} staff records in {table}.',
        })


# ── Run import endpoint (streaming) ──────────────────────────────────────────

class StaffImportRunView(APIView):
    """
    POST /api/staff/import/run/

    Same body as preview, plus:
    {
      ...
      "selected_indices": [0, 1, 3, ...],  // which preview rows to import
                                            // omit to import ALL rows
      "skip_existing":    true,             // skip if email already in AMECO
      "registered_by":    "admin_username"
    }

    Returns a streaming response of newline-delimited JSON events:
      {"type":"start",   "total": 42}
      {"type":"progress","index": 0, "status":"created","message":"Abebe — imported"}
      {"type":"progress","index": 1, "status":"skipped","message":"..."}
      {"type":"progress","index": 2, "status":"error",  "message":"..."}
      {"type":"done",    "created":40,"skipped":1,"errors":1}

    The frontend reads this stream and updates a live progress bar.
    """
    permission_classes = [IsSuperAdmin]

    def post(self, request):
        data             = request.data
        conn_params       = data.get('connection', {})
        table            = data.get('table', 'employees')
        field_map        = {**DEFAULT_FIELD_MAP, **data.get('field_map', {})}
        selected_indices = data.get('selected_indices')   # None = import all
        skip_existing    = bool(data.get('skip_existing', True))
        registered_by    = str(data.get('registered_by', request.user.username))

        try:
            rows = _fetch_rows(conn_params, table, field_map)
        except Exception as exc:
            return Response({'error': f'Connection failed: {str(exc)}'}, status=400)

        if selected_indices is not None:
            rows = [rows[i] for i in selected_indices if i < len(rows)]

        def event_stream():
            yield json.dumps({'type': 'start', 'total': len(rows)}) + '\n'

            created = skipped = errors = 0
            for idx, row in enumerate(rows):
                status, message = _import_one(row, registered_by, skip_existing)
                if status == 'created': created += 1
                elif status == 'skipped': skipped += 1
                else: errors += 1

                yield json.dumps({
                    'type':    'progress',
                    'index':   idx,
                    'status':  status,
                    'message': message,
                    'name':    f"{row.get('first_name','')} {row.get('last_name','')}".strip(),
                }) + '\n'

            # Reload recognition cache after all imports
            try:
                from recognition.encoding import load_all_encodings
                load_all_encodings()
            except Exception:
                pass

            yield json.dumps({
                'type':    'done',
                'created': created,
                'skipped': skipped,
                'errors':  errors,
                'total':   len(rows),
            }) + '\n'

        response = StreamingHttpResponse(event_stream(), content_type='application/x-ndjson')
        response['X-Accel-Buffering'] = 'no'   # disable Nginx buffering
        response['Cache-Control']      = 'no-cache'
        return response
