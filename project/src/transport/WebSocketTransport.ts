import { EventEmitter } from 'events'
import { BaseTransport, TransportConfig, TransportMessage } from './BaseTransport'

export class WebSocketTransport extends BaseTransport {
  private server: any = null
  private clients: Set<any> = new Set()
  private eventEmitter: EventEmitter

  constructor(config: TransportConfig) {
    super(config)
    this.eventEmitter = new EventEmitter()
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    try {
      const http = await import('http')
      const WebSocket = await import('ws').then(mod => mod.default)

      const server = http.createServer()
      const wss = new WebSocket.Server({
        server,
        path: this.config.path || '/ws',
      })

      wss.on('connection', (ws: any) => {
        this.handleClientConnection(ws)
      })

      wss.on('error', (error: any) => {
        this.emit('error', error)
      })

      server.listen(this.config.port || 8080, this.config.host || 'localhost', () => {
        this.isConnected = true
        this.emit('connected')
      })

      server.on('error', error => {
        this.isConnected = false
        this.emit('error', error)
      })

      this.server = server
    } catch (error) {
      this.isConnected = false
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.server) {
      return
    }

    return new Promise(resolve => {
      this.server.close(() => {
        this.isConnected = false
        this.clients.clear()
        this.emit('disconnected')
        resolve()
      })
    })
  }

  async send(message: TransportMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Transport not connected')
    }

    if (!this.validateMessage(message)) {
      throw new Error('Invalid message format')
    }

    const messageStr = JSON.stringify(message)

    for (const client of this.clients) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        try {
          client.send(messageStr)
        } catch (error) {
          console.error('Error sending message to client:', error)
          this.clients.delete(client)
        }
      }
    }

    this.emit('messageSent', message)
  }

  onMessage(handler: (message: TransportMessage) => void): void {
    this.eventEmitter.on('message', handler)
  }

  offMessage(handler: (message: TransportMessage) => void): void {
    this.eventEmitter.off('message', handler)
  }

  private handleClientConnection(ws: any): void {
    this.clients.add(ws)

    ws.on('message', (data: any) => {
      this.handleWebSocketMessage(data, ws)
    })

    ws.on('close', () => {
      this.clients.delete(ws)
    })

    ws.on('error', (error: any) => {
      console.error('WebSocket client error:', error)
      this.clients.delete(ws)
    })

    ws.send(
      JSON.stringify({
        type: 'connection',
        message: 'Connected to MCP WebSocket server',
        timestamp: Date.now(),
      })
    )
  }

  private handleWebSocketMessage(data: any, ws: any): void {
    try {
      const message = JSON.parse(data.toString()) as TransportMessage

      if (!this.validateMessage(message)) {
        ws.send(
          JSON.stringify({
            id: message.id || 'error',
            type: 'response',
            error: {
              code: -32600,
              message: 'Invalid message format',
            },
            timestamp: Date.now(),
          })
        )
        return
      }

      this.emit('message', message)

      const response: TransportMessage = {
        id: message.id + '_response',
        type: 'response',
        result: { received: true },
        timestamp: Date.now(),
      }

      ws.send(JSON.stringify(response))
    } catch (error) {
      ws.send(
        JSON.stringify({
          id: 'error',
          type: 'response',
          error: {
            code: -32700,
            message: 'Parse error',
          },
          timestamp: Date.now(),
        })
      )
    }
  }

  protected override emit(event: string, ...args: any[]): void {
    const handlers = this.messageHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args)
        } catch (error) {
          console.error(`Error in transport event handler for ${event}:`, error)
        }
      })
    }
  }
}
