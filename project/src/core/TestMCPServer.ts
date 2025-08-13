import { BaseMCPServer } from './BaseMCPServer'
import { MCPRequest, MCPResponse } from '../types/index'
import { z } from 'zod'

export class TestMCPServer extends BaseMCPServer {
  protected getServerInstructions(): string {
    return 'Test MCP server for unit testing'
  }

  protected initializeTools(): void {
    this.server.tool(
      'echo',
      'Echo back the input message',
      {
        message: z.string().describe('Message to echo back'),
      },
      async ({ message }) => {
        return {
          content: [
            {
              type: 'text',
              text: `Echo: ${message}`,
            },
          ],
        }
      }
    )

    this.server.tool(
      'add',
      'Add two numbers',
      {
        a: z.number().describe('First number'),
        b: z.number().describe('Second number'),
      },
      async ({ a, b }) => {
        return {
          content: [
            {
              type: 'text',
              text: `Result: ${a + b}`,
            },
          ],
        }
      }
    )
  }

  protected initializeResources(): void {
    // Initialize resources if needed
  }

  protected async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.validateRequest(request)) {
      return this.createErrorResponse(request.id, -32600, 'Invalid Request')
    }

    switch (request.method) {
      case 'echo':
        return this.createSuccessResponse(request.id, {
          message: request.params?.message || 'No message provided',
        })

      case 'add':
        const a = request.params?.a || 0
        const b = request.params?.b || 0
        return this.createSuccessResponse(request.id, {
          result: a + b,
        })

      default:
        return this.createErrorResponse(request.id, -32601, 'Method not found')
    }
  }

  protected createTransport(): any {
    // Mock transport for testing
    return {
      start: async () => {
        // Mock start
      },
      close: async () => {
        // Mock close
      },
      on: (_event: string, _handler: Function) => {
        // Mock event handler
      },
      send: async (_message: any) => {
        // Mock send
      },
    }
  }
}
