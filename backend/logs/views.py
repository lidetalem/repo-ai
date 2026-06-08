"""
logs/views.py
AMECO — AccessLog list, date-range filter, CSV download.
Requires `view_logs` privilege.
"""

import csv
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from authentication.permissions import CanViewLogs
from .models import AccessLog
from .serializers import AccessLogSerializer


class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = AccessLogSerializer
    permission_classes = [CanViewLogs]

    def get_queryset(self):
        qs        = AccessLog.objects.all().order_by('-timestamp')
        from_date = self.request.query_params.get('from')
        to_date   = self.request.query_params.get('to')
        if from_date:
            qs = qs.filter(timestamp__date__gte=from_date)
        if to_date:
            qs = qs.filter(timestamp__date__lte=to_date)
        return qs

    @action(detail=False, methods=['get'])
    def history(self, request):
        """Return logs filtered by optional ?from=&to= query params."""
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Download logs as a CSV file."""
        qs       = self.get_queryset()
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="ameco_logs.csv"'
        writer = csv.writer(response)
        writer.writerow([
            'Timestamp', 'Ethiopian Time', 'Actor Username', 'Actor Name',
            'Actor Role', 'Action Type', 'Description', 'Gate/Camera',
            'Confidence', 'Scan Result',
        ])
        for log in qs:
            writer.writerow([
                log.timestamp.isoformat(), log.ethiopian_time,
                log.actor_username, log.actor_name, log.actor_role,
                log.action_type, log.description, log.gate_camera_id,
                log.confidence or '', log.scan_result,
            ])
        return response
