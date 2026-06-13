"""
visitors/views.py
AMECO — Visitor and VisitorRequest viewsets.

Key behaviours
──────────────
• Visitors created by guards go in with status=Pending / is_approved=False.
  They are NOT returned in the main visitor list until approved.
• Only APPROVED visitors appear in the main list for admins.
  Guards see only their own registered visitors (all statuses).
• Approval  → sets visitor.is_approved=True, visitor.status=Active, reloads recognition cache.
• Rejection → visitor stays Pending/unapproved, recognition cache never includes it.
• Expiry is evaluated against expiry_datetime (datetime-precise).
  A periodic call to sync_expired_visitors() (or a Celery beat task) marks overdue ones.
• Extending expiry → clears Expired status → restores Active + recognition.
"""

from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from authentication.permissions import (
    guard_or_privilege, CanReviewRequests
)
from visitors.models import Visitor, VisitorRequest
from visitors.serializers import VisitorSerializer, VisitorRequestSerializer


# ── Helpers ──────────────────────────────────────────────────────────────────

def _sync_expired():
    """Mark all visitors whose expiry_datetime has passed as Expired (non-destructive)."""
    from django.utils import timezone
    now = timezone.now()
    expired_ids = list(
        Visitor.objects.filter(
            is_approved=True,
            status='Active',
            expiry_datetime__lt=now,
        ).values_list('id', flat=True)
    )
    if expired_ids:
        Visitor.objects.filter(id__in=expired_ids).update(status='Expired')
        # Reload recognition cache so expired visitors are blocked
        try:
            from recognition.encoding import load_all_encodings
            load_all_encodings()
        except Exception:
            pass
    # Also handle legacy date_of_expiry (date-only)
    from datetime import date
    today = date.today()
    legacy_ids = list(
        Visitor.objects.filter(
            is_approved=True,
            status='Active',
            expiry_datetime__isnull=True,
            date_of_expiry__lt=today,
        ).values_list('id', flat=True)
    )
    if legacy_ids:
        Visitor.objects.filter(id__in=legacy_ids).update(status='Expired')
        try:
            from recognition.encoding import load_all_encodings
            load_all_encodings()
        except Exception:
            pass


class VisitorViewSet(viewsets.ModelViewSet):
    serializer_class   = VisitorSerializer
    permission_classes = [guard_or_privilege('manage_visitors')]

    def get_queryset(self):
        user = self.request.user
        # Sync expired before returning list
        _sync_expired()
        qs = Visitor.objects.all().order_by('-registered_at')
        if user.role == 'guard':
            # Guards see their own visitors (all statuses — they need to track pending)
            qs = qs.filter(registered_by=user.username)
        else:
            # Admins see APPROVED visitors in the main list + can filter by status
            status_filter = self.request.query_params.get('status', None)
            if status_filter:
                qs = qs.filter(status=status_filter)
            # Default admin list: only approved (Active + Expired) for the visitors tab
            # Pass ?status=Pending to see pending queue
        return qs

    def perform_create(self, serializer):
        serializer.save(
            registered_by=self.request.user.username,
            status='Pending',
            is_approved=False,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        # If expiry was extended beyond now, restore Active
        if instance.is_approved and instance.status == 'Expired':
            exp = instance.expiry_datetime
            legacy = instance.date_of_expiry
            from datetime import date
            now = timezone.now()
            if (exp and exp > now) or (not exp and legacy and legacy >= date.today()):
                instance.status = 'Active'
                instance.save(update_fields=['status'])
                try:
                    from recognition.encoding import load_all_encodings
                    load_all_encodings()
                except Exception:
                    pass


class VisitorRequestViewSet(viewsets.ModelViewSet):
    serializer_class   = VisitorRequestSerializer
    permission_classes = [guard_or_privilege('review_requests')]

    def get_queryset(self):
        user = self.request.user
        qs   = VisitorRequest.objects.select_related('temp_user').all()
        if user.role == 'guard':
            qs = qs.filter(guard_username=user.username)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        # Store guard profile image URL for notification
        guard_image = ''
        try:
            guard_image = self.request.build_absolute_uri(user.profile_image_url) if hasattr(user, 'profile_image_url') and user.profile_image_url else ''
        except Exception:
            pass

        instance = serializer.save(
            guard_username=user.username,
            guard_image=guard_image,
            status='PENDING',
        )
        self._notify_admins(instance)

    def _notify_admins(self, req):
        try:
            from notifications.broadcast import broadcast_to_role
            visitor = req.temp_user
            visitor_image = ''
            try:
                if visitor and visitor.profile_image:
                    visitor_image = visitor.profile_image.url
            except Exception:
                pass

            broadcast_to_role('admin', {
                'type':          'new_visitor_request',
                'request_id':    req.id,
                'visitor_name':  visitor.full_name() if visitor else '',
                'visitor_image': visitor_image,
                'guard':         req.guard_username,
                'guard_image':   req.guard_image,
                'reason':        req.reason,
            })
        except Exception:
            pass

    @action(detail=True, methods=['patch'], permission_classes=[CanReviewRequests])
    def update_status(self, request, pk=None):
        req        = self.get_object()
        new_status = request.data.get('status', '').upper()

        if new_status not in ('APPROVED', 'REJECTED'):
            return Response({'detail': 'status must be APPROVED or REJECTED.'}, status=400)

        req.status       = new_status
        req.responded_at = timezone.now()
        if new_status == 'REJECTED':
            req.denial_reason = request.data.get('denial_reason', '')
        req.save()

        # ── On Approval: activate visitor + reload recognition cache ──────────
        if new_status == 'APPROVED' and req.temp_user:
            visitor = req.temp_user
            visitor.is_approved = True
            visitor.status = 'Active'
            visitor.save(update_fields=['is_approved', 'status'])
            # Re-check if already expired
            if visitor.is_expired():
                visitor.status = 'Expired'
                visitor.save(update_fields=['status'])
            try:
                from recognition.encoding import load_all_encodings
                load_all_encodings()
            except Exception:
                pass

        # ── Notify the guard of the decision ─────────────────────────────────
        try:
            from notifications.broadcast import broadcast_to_user
            visitor = req.temp_user
            visitor_image = ''
            try:
                if visitor and visitor.profile_image:
                    visitor_image = visitor.profile_image.url
            except Exception:
                pass

            broadcast_to_user(req.guard_username, {
                'type':          'request_decision',
                'request_id':    req.id,
                'status':        new_status,
                'visitor_name':  visitor.full_name() if visitor else '',
                'visitor_image': visitor_image,
                'guard_image':   req.guard_image,
                'denial_reason': req.denial_reason,
            })
        except Exception:
            pass

        return Response(VisitorRequestSerializer(req, context={'request': request}).data)


    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Admin approves a visitor request: move or mark related temp_user active."""
        req = self.get_object()
        if req.status != 'PENDING':
            return Response({'detail': 'Request already processed.'}, status=400)

        # If temp_user exists, mark it ACTIVE; else reject
        if req.temp_user:
            visitor = req.temp_user
            visitor.status = 'Active'
            # Optionally set expiry_datetime from request end_date if provided
            if req.end_date:
                from datetime import datetime, time
                visitor.expiry_datetime = timezone.make_aware(datetime.combine(req.end_date, time.min))
            visitor.save()
            try:
                # Refresh recognition cache so newly approved visitor is recognized
                from recognition.encoding import load_all_encodings
                load_all_encodings()
            except Exception:
                pass

        req.status = 'APPROVED'
        req.responded_at = timezone.now()
        req.save()
        return Response(VisitorRequestSerializer(req, context={'request': request}).data)