export interface AuthContext {
  userId: string
  username: string
  roles: string[]
  permissions: string[]
  metadata?: Record<string, any>
}

export interface AuthToken {
  token: string
  type: 'bearer' | 'apikey'
  expiresAt: number
  scopes: string[]
}

export interface AuthConfig {
  jwtSecret: string
  jwtExpiration: string
  apiKeyPrefix: string
  rateLimitWindow: number
  rateLimitMax: number
  allowedOrigins: string[]
}

export interface AuthRequest {
  headers?: Record<string, string>
  body?: any
  query?: Record<string, string>
}

export interface AuthResult {
  success: boolean
  context?: AuthContext
  error?: string
  statusCode: number
}

export abstract class BaseAuth {
  protected config: AuthConfig

  constructor(config: AuthConfig) {
    this.config = config
  }

  abstract authenticate(request: AuthRequest): Promise<AuthResult>
  abstract authorize(context: AuthContext, requiredPermissions: string[]): Promise<boolean>
  abstract generateToken(context: AuthContext): Promise<AuthToken>
  abstract validateToken(token: string): Promise<AuthResult>
  abstract refreshToken(refreshToken: string): Promise<AuthToken>

  protected createError(message: string, statusCode: number = 401): AuthResult {
    return {
      success: false,
      error: message,
      statusCode,
    }
  }

  protected createSuccess(context: AuthContext): AuthResult {
    return {
      success: true,
      context,
      statusCode: 200,
    }
  }

  protected hasPermission(context: AuthContext, requiredPermissions: string[]): boolean {
    return requiredPermissions.every(
      permission =>
        context.permissions.includes(permission) ||
        context.roles.some(role => this.roleHasPermission(role, permission))
    )
  }

  protected roleHasPermission(role: string, permission: string): boolean {
    const rolePermissions: Record<string, string[]> = {
      admin: ['*'],
      user: ['read', 'write'],
      guest: ['read'],
    }

    const permissions = rolePermissions[role] || []
    return permissions.includes('*') || permissions.includes(permission)
  }

  protected validateAuthConfig(config: AuthConfig): boolean {
    return (
      !!config.jwtSecret &&
      !!config.jwtExpiration &&
      !!config.apiKeyPrefix &&
      config.rateLimitWindow > 0 &&
      config.rateLimitMax > 0 &&
      Array.isArray(config.allowedOrigins)
    )
  }

  protected extractTokenFromHeader(headers: Record<string, string>): string | null {
    const authHeader = headers['authorization'] || headers['Authorization']
    if (!authHeader) return null

    const parts = authHeader.split(' ')
    if (parts.length !== 2) return null

    const [scheme, token] = parts
    if (scheme.toLowerCase() !== 'bearer') return null

    return token
  }

  protected extractApiKeyFromHeader(headers: Record<string, string>): string | null {
    const apiKeyHeader = headers['x-api-key'] || headers['X-Api-Key']
    return apiKeyHeader || null
  }

  protected extractTokenFromQuery(query: Record<string, string>): string | null {
    return query['token'] || query['api_key'] || null
  }
}
