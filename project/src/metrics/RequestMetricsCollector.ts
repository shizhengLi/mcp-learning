import { RequestMetrics } from './types'

export class RequestMetricsCollector {
  private activeRequests: Map<string, { startTime: number; request: any }> = new Map()
  private requestHistory: RequestMetrics[] = []
  private maxHistorySize: number = 10000

  constructor(maxHistorySize: number = 10000) {
    this.maxHistorySize = maxHistorySize
  }

  startRequest(requestId: string, request: any): void {
    const startTime = Date.now()
    this.activeRequests.set(requestId, { startTime, request })
  }

  endRequest(requestId: string, response: any, error?: string): RequestMetrics | null {
    const activeRequest = this.activeRequests.get(requestId)
    if (!activeRequest) return null

    const { startTime, request } = activeRequest
    const duration = Date.now() - startTime
    const timestamp = Date.now()

    const metrics: RequestMetrics = {
      requestId,
      method: request.method || 'UNKNOWN',
      path: request.path || request.url || '/',
      statusCode: response?.statusCode || 500,
      duration,
      timestamp,
      userId: request.user?.userId || request.user?.id,
      userAgent: request.headers?.['user-agent'],
      ip: request.ip || request.connection?.remoteAddress,
      success: !error && (response?.statusCode || 500) < 400,
      ...(error && { error }),
    }

    this.requestHistory.push(metrics)
    this.activeRequests.delete(requestId)

    // Maintain history size
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory = this.requestHistory.slice(-this.maxHistorySize)
    }

    return metrics
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size
  }

  getActiveRequests(): Array<{ requestId: string; duration: number; request: any }> {
    const now = Date.now()
    return Array.from(this.activeRequests.entries()).map(([requestId, { startTime, request }]) => ({
      requestId,
      duration: now - startTime,
      request,
    }))
  }

  getRequestHistory(limit?: number): RequestMetrics[] {
    const history = this.requestHistory.slice().reverse()
    return limit ? history.slice(0, limit) : history
  }

  getRequestsByTimeRange(startTime: number, endTime: number): RequestMetrics[] {
    return this.requestHistory.filter(req => req.timestamp >= startTime && req.timestamp <= endTime)
  }

  getRequestsByStatusCode(statusCode: number): RequestMetrics[] {
    return this.requestHistory.filter(req => req.statusCode === statusCode)
  }

  getRequestsByPath(path: string): RequestMetrics[] {
    return this.requestHistory.filter(req => req.path === path)
  }

  getErrorRequests(): RequestMetrics[] {
    return this.requestHistory.filter(req => !req.success || req.error)
  }

  getSlowRequests(threshold: number = 1000): RequestMetrics[] {
    return this.requestHistory.filter(req => req.duration > threshold)
  }

  getTopSlowRequests(limit: number = 10): RequestMetrics[] {
    return this.requestHistory
      .slice()
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
  }

  getTopErrorPaths(limit: number = 10): Array<{ path: string; count: number; errorRate: number }> {
    const pathStats = new Map<string, { total: number; errors: number }>()

    for (const req of this.requestHistory) {
      const stats = pathStats.get(req.path) || { total: 0, errors: 0 }
      stats.total++
      if (!req.success || req.error) {
        stats.errors++
      }
      pathStats.set(req.path, stats)
    }

    return Array.from(pathStats.entries())
      .map(([path, { total, errors }]) => ({
        path,
        count: total,
        errorRate: total > 0 ? errors / total : 0,
      }))
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, limit)
  }

  getRequestStats(timeRange: number = 3600000): {
    total: number
    successful: number
    failed: number
    avgDuration: number
    minDuration: number
    maxDuration: number
    p95Duration: number
    p99Duration: number
    requestsPerSecond: number
    errorRate: number
  } {
    const now = Date.now()
    const startTime = now - timeRange
    const relevantRequests = this.requestHistory.filter(req => req.timestamp >= startTime)

    if (relevantRequests.length === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        requestsPerSecond: 0,
        errorRate: 0,
      }
    }

    const durations = relevantRequests.map(req => req.duration)
    const successful = relevantRequests.filter(req => req.success).length
    const failed = relevantRequests.length - successful

    durations.sort((a, b) => a - b)

    return {
      total: relevantRequests.length,
      successful,
      failed,
      avgDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p95Duration: this.calculatePercentile(durations, 95),
      p99Duration: this.calculatePercentile(durations, 99),
      requestsPerSecond: relevantRequests.length / (timeRange / 1000),
      errorRate: failed / relevantRequests.length,
    }
  }

  clearHistory(): void {
    this.requestHistory = []
  }

  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1
    return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))]
  }
}
