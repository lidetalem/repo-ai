"""
attendance/views.py — AMECO Attendance & Overstay API
======================================================

GET  /api/attendance/                     — paginated list (date filter)
GET  /api/attendance/today/               — today's records with live status
GET  /api/attendance/person/<digital_id>/ — full history for one person
GET  /api/attendance/report/              — summary report (date range)
GET  /api/attendance/export_csv/          — download CSV
GET  /api/attendance/alerts/              — unresolved overstay alerts
POST /api/attendance/alerts/<id>/resolve/ — guard/admin resolves an alert
POST /api/attendance/check_overstay/      — manually trigger overstay check
"""

import csv
from datetime import date, timedelta

from django.http        import HttpResponse
from django.utils       import timezone
from rest_framework     import viewsets, status
from rest_framework.decorators import action
from rest_framework.response   import Response
from rest_framework.views      import APIView
from rest_framework.permissions import IsAuthenticated

from authentication.permissions import IsAdminOrGuard, CanViewLogs
from .models    import AttendanceRecord, OverstayAlert
from .engine    import check_overstay
from .serializers import AttendanceRecordSerializer, OverstayAlertSerializer


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = AttendanceRecordSerializer
    permission_classes = [IsAdminOrGuard]

    def get_queryset(self):
        qs        = AttendanceRecord.objects.all()
        from_date = self.request.query_params.get('from')
        to_date   = self.request.query_params.get('to')
        ptype     = self.request.query_params.get('type')   # STAFF|VISITOR|etc.
        status_f  = self.request.query_params.get('status')
        search    = self.request.query_params.get('search', '').strip()

        if from_date:
            qs = qs.filter(entry_time__date__gte=from_date)
        if to_date:
            qs = qs.filter(entry_time__date__lte=to_date)
        if ptype:
            qs = qs.filter(person_type=ptype.upper())
        if status_f:
            qs = qs.filter(status=status_f.upper())
        if search:
            qs = qs.filter(person_name__icontains=search) | \
                 qs.filter(digital_id__icontains=search)
        return qs.order_by('-entry_time')

    @action(detail=False, methods=['get'])
    def today(self, request):
        """All records for today — the main live view."""
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        qs = AttendanceRecord.objects.filter(
            entry_time__gte=today_start
        ).order_by('-entry_time')
        return Response(AttendanceRecordSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='person/(?P<digital_id>[^/.]+)')
    def person_history(self, request, digital_id=None):
        """Full attendance history for a single person."""
        qs = AttendanceRecord.objects.filter(
            digital_id=digital_id
        ).order_by('-entry_time')[:90]   # last 90 sessions
        return Response(AttendanceRecordSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        """
        Daily summary report for a date range.
        Returns: total_in, currently_inside, visitors_inside,
                 overstay_count, by_type breakdown.
        """
        from_date = request.query_params.get('from', str(date.today()))
        to_date   = request.query_params.get('to',   str(date.today()))
        qs = AttendanceRecord.objects.filter(
            entry_time__date__gte=from_date,
            entry_time__date__lte=to_date,
        )
        total         = qs.count()
        inside        = qs.filter(exit_time__isnull=True).count()
        visitors_in   = qs.filter(person_type='VISITOR', exit_time__isnull=True).count()
        overstay      = qs.filter(status='OVERSTAY').count()
        by_type       = {}
        for pt in ('STAFF', 'ADMIN', 'GUARD', 'VISITOR'):
            by_type[pt] = qs.filter(person_type=pt).count()

        return Response({
            'from_date':       from_date,
            'to_date':         to_date,
            'total_entries':   total,
            'currently_inside':inside,
            'visitors_inside': visitors_in,
            'overstay_count':  overstay,
            'by_type':         by_type,
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Download attendance records as CSV."""
        qs       = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="ameco_attendance.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Date', 'Name', 'Digital ID', 'Role', 'Type',
            'Entry Time (ET)', 'Exit Time (ET)', 'Duration (min)',
            'Allowed (min)', 'Status', 'Gate',
        ])
        for r in qs:
            writer.writerow([
                r.entry_time.strftime('%Y-%m-%d'),
                r.person_name,
                r.digital_id,
                r.person_role,
                r.get_person_type_display(),
                r.entry_eth_time,
                r.exit_eth_time or '—',
                r.duration_minutes if r.duration_minutes is not None else '—',
                r.allowed_minutes or '—',
                r.get_status_display(),
                r.gate_camera_id,
            ])
        return response

    @action(detail=False, methods=['get'])
    def alerts(self, request):
        """Unresolved overstay alerts — for the security alert panel."""
        qs = OverstayAlert.objects.filter(resolved=False).order_by('-alerted_at')
        return Response(OverstayAlertSerializer(qs, many=True).data)

    @action(detail=False, methods=['post'], url_path='alerts/(?P<alert_id>[0-9]+)/resolve')
    def resolve_alert(self, request, alert_id=None):
        """Mark an overstay alert as resolved by a guard/admin."""
        try:
            alert = OverstayAlert.objects.get(id=alert_id)
        except OverstayAlert.DoesNotExist:
            return Response({'error': 'Alert not found.'}, status=404)
        alert.resolve(
            by    = request.user.username,
            notes = request.data.get('notes', ''),
        )
        return Response({'detail': 'Alert resolved.'})

    @action(detail=False, methods=['post'])
    def check_overstay(self, request):
        """Manually trigger the overstay check — for testing / admin use."""
        fired = check_overstay()
        return Response({'alerts_fired': len(fired), 'alerts': fired})
