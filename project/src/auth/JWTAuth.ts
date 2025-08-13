import jwt from 'jsonwebtoken'
import { BaseAuth, AuthConfig, AuthContext, AuthToken, AuthRequest, AuthResult } from './BaseAuth'

export class JWTAuth extends BaseAuth {
  private userStore: Map<string, AuthContext> = new Map()

  constructor(config: AuthConfig) {
    super(config)
    this.initializeTestUsers()
  }

  async authenticate(request: AuthRequest): Promise<AuthResult> {
    try {
      const token = this.extractToken(request)
      if (!token) {
        return this.createError('No authentication token provided', 401)
      }

      const decoded = jwt.verify(token, this.config.jwtSecret) as any
      const context = this.userStore.get(decoded.userId)

      if (!context) {
        return this.createError('User not found', 401)
      }

      return this.createSuccess(context)
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return this.createError('Invalid token', 401)
      }
      if (error instanceof jwt.TokenExpiredError) {
        return this.createError('Token expired', 401)
      }
      return this.createError('Authentication failed', 500)
    }
  }

  async authorize(context: AuthContext, requiredPermissions: string[]): Promise<boolean> {
    return this.hasPermission(context, requiredPermissions)
  }

  async generateToken(context: AuthContext): Promise<AuthToken> {
    const payload = {
      userId: context.userId,
      username: context.username,
      roles: context.roles,
      permissions: context.permissions,
    }

    const token = jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiration,
    } as any)

    const decoded = jwt.decode(token) as any

    return {
      token,
      type: 'bearer',
      expiresAt: decoded.exp * 1000,
      scopes: context.permissions,
    }
  }

  async validateToken(token: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as any
      const context = this.userStore.get(decoded.userId)

      if (!context) {
        return this.createError('User not found', 401)
      }

      return this.createSuccess(context)
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        return this.createError('Invalid token', 401)
      }
      if (error instanceof jwt.TokenExpiredError) {
        return this.createError('Token expired', 401)
      }
      return this.createError('Token validation failed', 500)
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    const result = await this.validateToken(refreshToken)
    if (!result.success || !result.context) {
      throw new Error(result.error || 'Invalid refresh token')
    }

    return this.generateToken(result.context)
  }

  private extractToken(request: AuthRequest): string | null {
    return (
      this.extractTokenFromHeader(request.headers || {}) ||
      this.extractTokenFromQuery(request.query || {})
    )
  }

  private initializeTestUsers(): void {
    const testUsers: AuthContext[] = [
      {
        userId: 'user-1',
        username: 'admin',
        roles: ['admin'],
        permissions: ['*'],
        metadata: { email: 'admin@example.com' },
      },
      {
        userId: 'user-2',
        username: 'user',
        roles: ['user'],
        permissions: ['read', 'write'],
        metadata: { email: 'user@example.com' },
      },
      {
        userId: 'user-3',
        username: 'guest',
        roles: ['guest'],
        permissions: ['read'],
        metadata: { email: 'guest@example.com' },
      },
    ]

    testUsers.forEach(user => {
      this.userStore.set(user.userId, user)
    })
  }

  public addUser(context: AuthContext): void {
    this.userStore.set(context.userId, context)
  }

  public removeUser(userId: string): void {
    this.userStore.delete(userId)
  }

  public getUser(userId: string): AuthContext | undefined {
    return this.userStore.get(userId)
  }

  public getAllUsers(): AuthContext[] {
    return Array.from(this.userStore.values())
  }
}
