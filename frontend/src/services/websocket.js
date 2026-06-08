/**
 * websocket.js
 * AMECO — WebSocket connection manager with auto-reconnect.
 */

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'

class WebSocketManager {
  constructor() {
    this.socket = null
    this.username = null
    this.reconnectDelay = 2000
    this.maxReconnectDelay = 30000
    this.listeners = new Map()
    this.connected = false
    this._reconnectTimer = null
    this._pingInterval = null
  }

  connect(username) {
    if (this.socket && this.connected) return
    this.username = username
    this._doConnect()
  }

  _doConnect() {
    const url = `${WS_BASE}/ws/notifications/${this.username}/`
    this.socket = new WebSocket(url)

    this.socket.onopen = () => {
      this.connected = true
      this.reconnectDelay = 2000
      this._emit('__connected__', {})
      // Ping every 25 seconds to keep connection alive
      this._pingInterval = setInterval(() => {
        if (this.socket?.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping' }))
        }
      }, 25000)
    }

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const type = data.type || '__message__'
        this._emit(type, data)
        this._emit('*', data)
      } catch (_) {}
    }

    this.socket.onclose = () => {
      this.connected = false
      clearInterval(this._pingInterval)
      this._emit('__disconnected__', {})
      // Auto-reconnect with backoff
      this._reconnectTimer = setTimeout(() => {
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay)
        if (this.username) this._doConnect()
      }, this.reconnectDelay)
    }

    this.socket.onerror = (err) => {
      this._emit('__error__', err)
    }
  }

  disconnect() {
    clearInterval(this._pingInterval)
    clearTimeout(this._reconnectTimer)
    this.username = null
    if (this.socket) {
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
    this.connected = false
  }

  on(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(callback)
    return () => this.listeners.get(type)?.delete(callback)
  }

  off(type, callback) {
    this.listeners.get(type)?.delete(callback)
  }

  _emit(type, data) {
    this.listeners.get(type)?.forEach((cb) => cb(data))
  }
}

const wsManager = new WebSocketManager()
export default wsManager