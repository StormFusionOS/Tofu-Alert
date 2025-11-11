import { WebSocketServer, WebSocket } from 'ws'
import { Server } from 'http'

let wss: WebSocketServer | null = null
const clients = new Set<WebSocket>()

export function initializeWebSocketServer(server: Server) {
  if (wss) {
    console.log('[WebSocket] Server already initialized')
    return wss
  }

  wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] New client connected')
    clients.add(ws)

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected')
      clients.delete(ws)
    })

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error)
      clients.delete(ws)
    })

    // Send initial connection message
    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to Tofu Alert overlay' }))
  })

  console.log('[WebSocket] Server initialized')
  return wss
}

export function broadcastToOverlay(event: any) {
  const message = JSON.stringify(event)

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message)
      } catch (error) {
        console.error('[WebSocket] Error sending message:', error)
      }
    }
  })

  console.log(`[WebSocket] Broadcasted event to ${clients.size} clients`)
}

export function getConnectedClientsCount(): number {
  return clients.size
}
