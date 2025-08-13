import { Request, Response, NextFunction } from 'express'
import { BaseMetricsCollector } from './BaseMetricsCollector'
import { RequestMetricsCollector } from './RequestMetricsCollector'
import { RequestMetrics } from './types'

export interface MetricsMiddlewareConfig {
  enableRequestMetrics: boolean
  enableResponseMetrics: boolean
  enablePerformanceMetrics: boolean
  trackHeaders: string[]
  trackQueries: string[]
  excludePaths: string[]
  sampleRate: number
  slowRequestThreshold: number
}

export class MetricsMiddleware {
  private baseCollector: BaseMetricsCollector
  private requestCollector: RequestMetricsCollector
  private config: MetricsMiddlewareConfig

  constructor(
    baseCollector: BaseMetricsCollector,
    requestCollector: RequestMetricsCollector,
    config: MetricsMiddlewareConfig
  ) {
    this.baseCollector = baseCollector
    this.requestCollector = requestCollector
    this.config = {
      enableRequestMetrics: config.enableRequestMetrics ?? true,
      enableResponseMetrics: config.enableResponseMetrics ?? true,
      enablePerformanceMetrics: config.enablePerformanceMetrics ?? true,
      trackHeaders: config.trackHeaders || [],
      trackQueries: config.trackQueries || [],
      excludePaths: config.excludePaths || ['/health', '/metrics'],
      sampleRate: config.sampleRate ?? 1.0,
      slowRequestThreshold: config.slowRequestThreshold ?? 1000,
    }
  }

  middleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip excluded paths
      if (this.shouldExcludeRequest(req)) {
        return next()
      }

      // Apply sampling
      if (Math.random() > this.config.sampleRate) {
        return next()
      }

      const requestId = this.generateRequestId()
      const startTime = Date.now()

      // Add request ID to request object for tracking
      ;(req as any).requestId = requestId
      ;(req as any).startTime = startTime

      // Track request start
      if (this.config.enableRequestMetrics) {
        this.requestCollector.startRequest(requestId, req)
        this.baseCollector.incrementCounter('requests_started', 1, {
          method: req.method,
          path: req.path,
        })
      }

      // Track specific metrics based on headers
      this.trackRequestHeaders(req)

      // Override response methods to track completion
      this.wrapResponseMethods(res, requestId, req, startTime)

      next()
    }
  }

  errorHandlerMiddleware(): (err: Error, req: Request, res: Response, next: NextFunction) => void {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      const requestId = (req as any).requestId
      const startTime = (req as any).startTime

      if (requestId && this.config.enableRequestMetrics) {
        const duration = Date.now() - startTime
        const errorMetrics: RequestMetrics = {
          requestId,
          method: req.method,
          path: req.path,
          statusCode: 500,
          duration,
          timestamp: Date.now(),
          userId: (req as any).user?.userId,
          userAgent: req.headers['user-agent'] as string | undefined,
          ip: req.ip,
          success: false,
          error: err.message,
        }

        this.requestCollector.endRequest(requestId, res, err.message)
        this.baseCollector.recordRequest(errorMetrics)
        this.baseCollector.incrementCounter('requests_error', 1, {
          method: req.method,
          path: req.path,
          errorType: err.constructor.name,
        })

        // Track slow requests
        if (duration > this.config.slowRequestThreshold) {
          this.baseCollector.incrementCounter('slow_requests', 1, {
            method: req.method,
            path: req.path,
          })
        }
      }

      next(err)
    }
  }

  private shouldExcludeRequest(req: Request): boolean {
    return this.config.excludePaths.some(path => {
      if (path.endsWith('*')) {
        return req.path.startsWith(path.slice(0, -1))
      }
      return req.path === path
    })
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private trackRequestHeaders(req: Request): void {
    for (const header of this.config.trackHeaders) {
      const value = req.headers[header.toLowerCase()]
      if (value) {
        this.baseCollector.incrementCounter('request_headers', 1, {
          header,
          value: Array.isArray(value) ? value.join(',') : value,
        })
      }
    }
  }

  private wrapResponseMethods(
    res: Response,
    requestId: string,
    req: Request,
    startTime: number
  ): void {
    const originalEnd = res.end
    const originalJson = res.json
    const self = this

    ;(res as any).end = function (this: Response, chunk: any, encoding?: any, cb?: () => void) {
      self.trackResponseCompletion(requestId, req, this, startTime)
      return originalEnd.call(this, chunk, encoding, cb)
    }

    ;(res as any).json = function (this: Response, body?: any) {
      self.trackResponseCompletion(requestId, req, this, startTime)
      return originalJson.call(this, body)
    }
  }

  private trackResponseCompletion(
    requestId: string,
    req: Request,
    res: Response,
    startTime: number
  ): RequestMetrics | null {
    if (!this.config.enableResponseMetrics) {
      return null
    }

    const duration = Date.now() - startTime
    const metrics: RequestMetrics = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      timestamp: Date.now(),
      userId: (req as any).user?.userId,
      userAgent: req.headers['user-agent'] as string | undefined,
      ip: req.ip,
      success: res.statusCode < 400,
    }

    // Record metrics
    this.requestCollector.endRequest(requestId, res)
    this.baseCollector.recordRequest(metrics)

    // Track response status codes
    this.baseCollector.incrementCounter('responses_total', 1, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode.toString(),
    })

    // Track response time
    this.baseCollector.recordTimer('response_time', duration, {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode.toString(),
    })

    // Track successful vs failed responses
    if (res.statusCode < 400) {
      this.baseCollector.incrementCounter('responses_successful', 1, {
        method: req.method,
        path: req.path,
      })
    } else {
      this.baseCollector.incrementCounter('responses_failed', 1, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode.toString(),
      })
    }

    // Track slow requests
    if (duration > this.config.slowRequestThreshold) {
      this.baseCollector.incrementCounter('slow_requests', 1, {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode.toString(),
      })
    }

    // Track content length if available
    const contentLength = res.get('content-length')
    if (contentLength) {
      this.baseCollector.recordHistogram('response_size', parseInt(contentLength), {
        method: req.method,
        path: req.path,
      })
    }

    return metrics
  }

  // Utility middleware to track specific routes
  trackRoute(routePath: string): (req: Request, _res: Response, next: NextFunction) => void {
    return (req: Request, _res: Response, next: NextFunction) => {
      this.baseCollector.incrementCounter('route_hits', 1, {
        route: routePath,
        method: req.method,
      })
      next()
    }
  }

  // Middleware to track authentication metrics
  trackAuth(): (req: Request, _res: Response, next: NextFunction) => void {
    return (req: Request, _res: Response, next: NextFunction) => {
      if ((req as any).user) {
        this.baseCollector.incrementCounter('auth_success', 1, {
          userId: (req as any).user.userId,
          method: (req as any).user.method || 'unknown',
        })
      } else {
        this.baseCollector.incrementCounter('auth_failed', 1)
      }
      next()
    }
  }

  // Middleware to track rate limiting
  trackRateLimit(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // This would be called by the rate limiter when a limit is reached
      const originalStatus = res.status
      const self = this
      ;(res as any).status = function (this: Response, code: number) {
        if (code === 429) {
          self.baseCollector.incrementCounter('rate_limit_exceeded', 1, {
            ip: req.ip || 'unknown',
            path: req.path,
          })
        }
        return originalStatus.call(this, code)
      }
      next()
    }
  }

  // Health check middleware
  healthCheck(): (req: Request, res: Response, next: NextFunction) => void {
    return (_req: Request, res: Response, _next: NextFunction) => {
      const startTime = Date.now()

      // Get current metrics for health check
      const activeRequests = this.requestCollector.getActiveRequestCount()
      const serverMetrics = this.baseCollector.getServerMetrics()
      const latestPerformance = this.baseCollector
        .getMetrics()
        .find(m => m.name === 'memory_usage_percentage')

      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        activeRequests,
        requestRate: serverMetrics.requests.rate,
        errorRate: serverMetrics.errors.rate,
        avgResponseTime: serverMetrics.responseTime.avg,
        memoryUsage: (latestPerformance as any)?.value || 0,
        responseTime: Date.now() - startTime,
      }

      // Determine health status
      if (health.memoryUsage > 90 || health.errorRate > 0.1) {
        health.status = 'critical'
      } else if (health.memoryUsage > 80 || health.errorRate > 0.05) {
        health.status = 'warning'
      }

      res.status(health.status === 'healthy' ? 200 : 503).json(health)
    }
  }
}
