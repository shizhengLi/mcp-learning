import { spawn, ChildProcess } from 'child_process'
import { BaseTransport, TransportConfig, TransportMessage } from './BaseTransport'

export class StdioTransport extends BaseTransport {
  private process: ChildProcess | null = null

  constructor(config: TransportConfig) {
    super(config)
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn('node', ['-e', this.getStdioScript()], {
          stdio: ['pipe', 'pipe', 'pipe'],
        })

        this.process.on('error', error => {
          this.isConnected = false
          this.emit('error', error)
          reject(error)
        })

        this.process.on('exit', code => {
          this.isConnected = false
          this.emit('disconnected', { code })
        })

        if (this.process.stdout) {
          this.process.stdout.on('data', data => {
            this.handleStdoutData(data)
          })
        }

        if (this.process.stderr) {
          this.process.stderr.on('data', data => {
            this.emit('error', new Error(`STDERR: ${data.toString()}`))
          })
        }

        this.isConnected = true
        this.emit('connected')
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.process) {
      return
    }

    return new Promise(resolve => {
      if (this.process) {
        this.process.on('exit', () => {
          this.isConnected = false
          this.emit('disconnected')
          resolve()
        })
        this.process.kill()
      } else {
        this.isConnected = false
        resolve()
      }
    })
  }

  async send(message: TransportMessage): Promise<void> {
    if (!this.isConnected || !this.process) {
      throw new Error('Transport not connected')
    }

    if (!this.validateMessage(message)) {
      throw new Error('Invalid message format')
    }

    const messageStr = JSON.stringify(message) + '\n'

    if (this.process.stdin) {
      this.process.stdin.write(messageStr)
      this.emit('messageSent', message)
    } else {
      throw new Error('STDIN not available')
    }
  }

  onMessage(handler: (message: TransportMessage) => void): void {
    if (!this.messageHandlers.has('message')) {
      this.messageHandlers.set('message', [])
    }
    this.messageHandlers.get('message')!.push(handler)
  }

  offMessage(handler: (message: TransportMessage) => void): void {
    const handlers = this.messageHandlers.get('message')
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  private handleStdoutData(data: Buffer): void {
    const output = data.toString()
    const lines = output.split('\n').filter(line => line.trim())

    for (const line of lines) {
      try {
        const message = JSON.parse(line) as TransportMessage
        if (this.validateMessage(message)) {
          this.emit('message', message)
        } else {
          this.emit('error', new Error('Invalid message received from stdio'))
        }
      } catch (error) {
        this.emit('error', new Error(`Failed to parse stdio message: ${error}`))
      }
    }
  }

  private getStdioScript(): string {
    return `
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
      });

      rl.on('line', (line) => {
        try {
          const message = JSON.parse(line);
          console.log(JSON.stringify({
            id: message.id + '_response',
            type: 'response',
            result: { received: true },
            timestamp: Date.now()
          }));
        } catch (error) {
          console.error('Error processing message:', error);
        }
      });

      process.on('SIGINT', () => {
        process.exit(0);
      });
    `
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
