export interface TransportMessage {
  id: string
  type: 'request' | 'response' | 'notification'
  method?: string
  params?: any
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
  timestamp: number
}

export interface TransportConfig {
  type: 'stdio' | 'http' | 'websocket'
  host?: string
  port?: number
  path?: string
  ssl?: boolean
  timeout?: number
  maxRetries?: number
  headers?: Record<string, string>
}

export abstract class BaseTransport {
  protected config: TransportConfig
  protected isConnected: boolean = false
  protected messageHandlers: Map<string, Function[]> = new Map()

  constructor(config: TransportConfig) {
    this.config = config
  }

  abstract connect(): Promise<void>
  abstract disconnect(): Promise<void>
  abstract send(message: TransportMessage): Promise<void>
  abstract onMessage(handler: (message: TransportMessage) => void): void
  abstract offMessage(handler: (message: TransportMessage) => void): void

  public getStatus(): { isConnected: boolean; type: string } {
    return {
      isConnected: this.isConnected,
      type: this.config.type,
    }
  }

  public getConfig(): TransportConfig {
    return { ...this.config }
  }

  protected emit(event: string, ...args: any[]): void {
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

  protected validateMessage(message: TransportMessage): boolean {
    return (
      !!message.id &&
      !!message.type &&
      !!message.timestamp &&
      typeof message.id === 'string' &&
      ['request', 'response', 'notification'].includes(message.type) &&
      typeof message.timestamp === 'number'
    )
  }

  protected createMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  protected createRequest(method: string, params?: any): TransportMessage {
    return {
      id: this.createMessageId(),
      type: 'request',
      method,
      params,
      timestamp: Date.now(),
    }
  }

  protected createResponse(id: string, result?: any, error?: any): TransportMessage {
    return {
      id,
      type: 'response',
      result,
      error,
      timestamp: Date.now(),
    }
  }

  protected createNotification(method: string, params?: any): TransportMessage {
    return {
      id: this.createMessageId(),
      type: 'notification',
      method,
      params,
      timestamp: Date.now(),
    }
  }
}
