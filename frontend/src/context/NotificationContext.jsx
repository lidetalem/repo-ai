import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import wsManager from '../services/websocket'
import { notificationsAPI } from '../services/api'
import { useAuth } from './AuthContext'

const NotificationContext = createContext(null)

export function NotificationProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)

  // Load persisted notifications from DB
  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await notificationsAPI.list()
      setNotifications(data)
      setUnreadCount(data.filter((n) => !n.is_read).length)
    } catch (_) {}
  }, [user])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Listen to WebSocket real-time pushes
  useEffect(() => {
    if (!user) return

    const unsub = wsManager.on('*', (data) => {
      const type = data.type
      if (!type || type === 'pong') return

      let message = ''
      let title = ''

      if (type === 'new_visitor_request') {
        title = 'New Visitor Request'
        message = `${data.visitor_name} — by guard ${data.guard}`
        toast(message, { icon: '🔔' })
      } else if (type === 'request_decision') {
        title = `Request ${data.status}`
        message = `${data.visitor_name}: ${data.status}`
        toast(message, { icon: data.status === 'APPROVED' ? '✅' : '❌' })
      } else if (type === 'camera_power') {
        title = 'Camera Update'
        message = `Camera #${data.camera_id} power → ${data.power}`
      }

      if (title) {
        setNotifications((prev) => [
          {
            id: Date.now(),
            notification_type: type,
            title,
            message,
            is_read: false,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ])
        setUnreadCount((c) => c + 1)
      }
    })

    return unsub
  }, [user])

  const markRead = useCallback(async (id) => {
    try { await notificationsAPI.markRead(id) } catch (_) {}
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    try { await notificationsAPI.markAllRead() } catch (_) {}
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }, [])

  const dismiss = useCallback(async (id) => {
    try { await notificationsAPI.dismiss(id) } catch (_) {}
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    setUnreadCount((c) => Math.max(0, c - 1))
  }, [])

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, fetchNotifications,
      markRead, markAllRead, dismiss,
    }}>
      {children}
    </NotificationContext.Provider>
  )
}

export const useNotifications = () => useContext(NotificationContext)