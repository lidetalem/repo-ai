
import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from authentication.permissions import IsAdmin, IsAdminOrGuard
from .models import GateWithCamera
from .serializers import GateWithCameraSerializer

logger = logging.getLogger(__name__)


def _broadcast(payload: dict) -> None:
    """
    Fire-and-forget WebSocket broadcast.
    Wrapped in try/except so a broken notifications module never
    prevents the API from returning a correct 2xx response.
    """
    try:
        from notifications.broadcast import broadcast_camera_update
        broadcast_camera_update(payload)
    except Exception as exc:
        logger.warning("Camera broadcast failed (non-fatal): %s", exc)


class GateWithCameraViewSet(viewsets.ModelViewSet):
    """
    Standard CRUD + custom toggle actions for GateWithCamera.

    Endpoints (mounted at /api/camera/terminals/ via urls.py):
      GET    /terminals/                  → list
      POST   /terminals/                  → create
      GET    /terminals/<id>/             → retrieve
      PATCH  /terminals/<id>/             → update  (Settings modal)
      DELETE /terminals/<id>/             → destroy (Delete button)
      PATCH  /terminals/<id>/toggle_power/   → Power button
      PATCH  /terminals/<id>/toggle_status/  → Maintenance button
    """

    queryset         = GateWithCamera.objects.all().order_by('-created_at')
    serializer_class = GateWithCameraSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdminOrGuard()]
        return [IsAdmin()]

    # ── DELETE ────────────────────────────────────────────────────────────────
    def perform_destroy(self, instance):
        cam_id   = instance.id
        cam_name = instance.camera_name
        instance.delete()
        logger.info("Camera #%d '%s' deleted.", cam_id, cam_name)
        _broadcast({'type': 'camera_deleted', 'camera_id': cam_id})
        # DRF ModelViewSet.destroy() sends 204 No Content after perform_destroy ✓

    # ── POWER TOGGLE ─────────────────────────────────────────────────────────
    @action(detail=True, methods=['patch'], permission_classes=[IsAdmin])
    def toggle_power(self, request, pk=None):
        """
        Toggle power: on → off, off → on.
        PATCH /api/camera/terminals/<id>/toggle_power/
        Returns the updated camera object.
        """
        camera = self.get_object()
        camera.power = 'off' if camera.power == 'on' else 'on'
        camera.save(update_fields=['power'])

        logger.info("Camera #%d power toggled to '%s'.", camera.id, camera.power)
        _broadcast({
            'type':      'camera_power',
            'camera_id': camera.id,
            'power':     camera.power,
        })
        return Response(GateWithCameraSerializer(camera).data, status=status.HTTP_200_OK)

    # ── STATUS TOGGLE ─────────────────────────────────────────────────────────
    @action(detail=True, methods=['patch'], permission_classes=[IsAdmin])
    def toggle_status(self, request, pk=None):
        """
        Toggle status: active → maintenance, maintenance → active.
        PATCH /api/camera/terminals/<id>/toggle_status/
        Returns the updated camera object.
        """
        camera = self.get_object()
        camera.status = 'maintenance' if camera.status == 'active' else 'active'
        camera.save(update_fields=['status'])

        logger.info("Camera #%d status toggled to '%s'.", camera.id, camera.status)
        _broadcast({
            'type':      'camera_status',
            'camera_id': camera.id,
            'status':    camera.status,
        })
        return Response(GateWithCameraSerializer(camera).data, status=status.HTTP_200_OK)



import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from authentication.permissions import IsAdminOrGuard, CanManageCameras
from cameras.models import GateWithCamera
from cameras.serializers import GateWithCameraSerializer

logger = logging.getLogger(__name__)


def _broadcast(payload: dict) -> None:
    try:
        from notifications.broadcast import broadcast_camera_update
        broadcast_camera_update(payload)
    except Exception as exc:
        logger.warning('Camera broadcast failed (non-fatal): %s', exc)


class GateWithCameraViewSet(viewsets.ModelViewSet):
    queryset         = GateWithCamera.objects.all().order_by('-created_at')
    serializer_class = GateWithCameraSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAdminOrGuard()]
        return [CanManageCameras()]

    def perform_destroy(self, instance):
        cam_id, cam_name = instance.id, instance.camera_name
        instance.delete()
        _broadcast({'type': 'camera_deleted', 'camera_id': cam_id})

    @action(detail=True, methods=['patch'])
    def toggle_power(self, request, pk=None):
        camera = self.get_object()
        camera.power = 'off' if camera.power == 'on' else 'on'
        camera.save(update_fields=['power'])
        _broadcast({'type': 'camera_power', 'camera_id': camera.id, 'power': camera.power})
        return Response(GateWithCameraSerializer(camera).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'])
    def toggle_status(self, request, pk=None):
        camera = self.get_object()
        camera.status = 'maintenance' if camera.status == 'active' else 'active'
        camera.save(update_fields=['status'])
        _broadcast({'type': 'camera_status', 'camera_id': camera.id, 'status': camera.status})
        return Response(GateWithCameraSerializer(camera).data, status=status.HTTP_200_OK)