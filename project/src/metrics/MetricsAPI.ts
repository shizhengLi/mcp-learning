import { Request, Response } from 'express'
import { BaseMetricsCollector } from './BaseMetricsCollector'
import { RequestMetricsCollector } from './RequestMetricsCollector'
import { PerformanceMetricsCollector } from './PerformanceMetricsCollector'
import { MetricsAggregator } from './MetricsAggregator'

export class MetricsAPI {
  private baseCollector: BaseMetricsCollector
  private requestCollector: RequestMetricsCollector
  private performanceCollector: PerformanceMetricsCollector
  private aggregator: MetricsAggregator

  constructor(
    baseCollector: BaseMetricsCollector,
    requestCollector: RequestMetricsCollector,
    performanceCollector: PerformanceMetricsCollector,
    aggregator: MetricsAggregator
  ) {
    this.baseCollector = baseCollector
    this.requestCollector = requestCollector
    this.performanceCollector = performanceCollector
    this.aggregator = aggregator
  }

  // Get all metrics
  getAllMetrics(_req: Request, res: Response): void {
    try {
      const metrics = this.baseCollector.getMetrics()

      res.json({
        metrics,
        timestamp: Date.now(),
        count: metrics.length,
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        message: (error as Error).message,
      })
    }
  }

  // Get metrics by type
  getMetricsByType(req: Request, res: Response): void {
    try {
      const { type } = req.params
      const metrics = this.baseCollector.getMetrics().filter(m => m.type === type)

      res.json({
        type,
        metrics,
        count: metrics.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve metrics by type',
        message: (error as Error).message,
      })
    }
  }

  // Get metrics by name
  getMetricsByName(req: Request, res: Response): void {
    try {
      const { name } = req.params
      const metrics = this.baseCollector.getMetrics().filter(m => m.name === name)

      res.json({
        name,
        metrics,
        count: metrics.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve metrics by name',
        message: (error as Error).message,
      })
    }
  }

  // Get request metrics
  getRequestMetrics(req: Request, res: Response): void {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const requestMetrics = this.requestCollector.getRequestHistory(limit)

      res.json({
        requestMetrics,
        count: requestMetrics.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve request metrics',
        message: (error as Error).message,
      })
    }
  }

  // Get server metrics
  getServerMetrics(_req: Request, res: Response): void {
    try {
      const serverMetrics = this.baseCollector.getServerMetrics()

      res.json({
        serverMetrics,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve server metrics',
        message: (error as Error).message,
      })
    }
  }

  // Get aggregated metrics
  getAggregatedMetrics(req: Request, res: Response): void {
    try {
      const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000
      const aggregated = this.baseCollector.getAggregatedMetrics(timeRange)

      res.json({
        aggregated,
        timeRange,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve aggregated metrics',
        message: (error as Error).message,
      })
    }
  }

  // Get performance metrics
  getPerformanceMetrics(req: Request, res: Response): void {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const performanceMetrics = this.performanceCollector.getMetricsHistory(limit)

      res.json({
        performanceMetrics,
        count: performanceMetrics.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve performance metrics',
        message: (error as Error).message,
      })
    }
  }

  // Get active requests
  getActiveRequests(_req: Request, res: Response): void {
    try {
      const activeRequests = this.requestCollector.getActiveRequests()

      res.json({
        activeRequests,
        count: activeRequests.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve active requests',
        message: (error as Error).message,
      })
    }
  }

  // Get error requests
  getErrorRequests(req: Request, res: Response): void {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const errorRequests = this.requestCollector.getErrorRequests().slice(0, limit)

      res.json({
        errorRequests,
        count: errorRequests.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve error requests',
        message: (error as Error).message,
      })
    }
  }

  // Get slow requests
  getSlowRequests(req: Request, res: Response): void {
    try {
      const threshold = req.query.threshold ? parseInt(req.query.threshold as string) : 1000
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined
      const slowRequests = this.requestCollector.getSlowRequests(threshold).slice(0, limit)

      res.json({
        slowRequests,
        threshold,
        count: slowRequests.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve slow requests',
        message: (error as Error).message,
      })
    }
  }

  // Get top metrics
  getTopMetrics(req: Request, res: Response): void {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10
      const sortBy = (req.query.sortBy as 'total' | 'avg' | 'max') || 'total'
      const topMetrics = this.aggregator.getTopMetrics(limit, sortBy)

      res.json({
        topMetrics,
        limit,
        sortBy,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve top metrics',
        message: (error as Error).message,
      })
    }
  }

  // Get metric summary
  getMetricSummary(req: Request, res: Response): void {
    try {
      const { name } = req.params
      const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000
      const summary = this.aggregator.getMetricSummary(name, timeRange)

      res.json({
        summary,
        timeRange,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve metric summary',
        message: (error as Error).message,
      })
    }
  }

  // Get request statistics
  getRequestStats(req: Request, res: Response): void {
    try {
      const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000
      const stats = this.requestCollector.getRequestStats(timeRange)

      res.json({
        stats,
        timeRange,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve request statistics',
        message: (error as Error).message,
      })
    }
  }

  // Get performance alerts
  getPerformanceAlerts(_req: Request, res: Response): void {
    try {
      const alerts = this.performanceCollector.getAlerts()

      res.json({
        alerts,
        count: alerts.length,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve performance alerts',
        message: (error as Error).message,
      })
    }
  }

  // Get system info
  getSystemInfo(_req: Request, res: Response): void {
    try {
      const systemInfo = this.performanceCollector.getSystemInfo()

      res.json({
        systemInfo,
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve system info',
        message: (error as Error).message,
      })
    }
  }

  // Export metrics
  exportMetrics(req: Request, res: Response): void {
    try {
      const { format } = req.params
      const data = this.aggregator.exportMetrics(format as 'json' | 'csv' | 'prometheus')

      switch (format) {
        case 'json':
          res.setHeader('Content-Type', 'application/json')
          break
        case 'csv':
          res.setHeader('Content-Type', 'text/csv')
          res.setHeader('Content-Disposition', 'attachment; filename="metrics.csv"')
          break
        case 'prometheus':
          res.setHeader('Content-Type', 'text/plain')
          break
      }

      res.send(data)
    } catch (error) {
      res.status(500).json({
        error: 'Failed to export metrics',
        message: (error as Error).message,
      })
    }
  }

  // Reset metrics
  resetMetrics(_req: Request, res: Response): void {
    try {
      this.baseCollector.reset()
      this.requestCollector.clearHistory()
      this.performanceCollector.clearHistory()
      this.aggregator.clearAllMetrics()

      res.json({
        message: 'Metrics reset successfully',
        timestamp: Date.now(),
      })
    } catch (error) {
      res.status(500).json({
        error: 'Failed to reset metrics',
        message: (error as Error).message,
      })
    }
  }

  // Health check
  healthCheck(_req: Request, res: Response): void {
    try {
      const serverMetrics = this.baseCollector.getServerMetrics()
      const activeRequests = this.requestCollector.getActiveRequestCount()
      const alerts = this.performanceCollector.getAlerts()

      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        activeRequests,
        requestRate: serverMetrics.requests.rate,
        errorRate: serverMetrics.errors.rate,
        avgResponseTime: serverMetrics.responseTime.avg,
        alerts: alerts.length,
        memoryUsage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
      }

      // Determine health status
      if (
        health.memoryUsage > 90 ||
        health.errorRate > 0.1 ||
        alerts.some(a => a.level === 'critical')
      ) {
        health.status = 'critical'
      } else if (
        health.memoryUsage > 80 ||
        health.errorRate > 0.05 ||
        alerts.some(a => a.level === 'warning')
      ) {
        health.status = 'warning'
      }

      res.status(health.status === 'healthy' ? 200 : 503).json(health)
    } catch (error) {
      res.status(500).json({
        error: 'Health check failed',
        message: (error as Error).message,
      })
    }
  }

  // Get metrics dashboard data
  getDashboardData(req: Request, res: Response): void {
    try {
      const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : 3600000

      const requestStats = this.requestCollector.getRequestStats(timeRange)
      const performanceAggregated = this.performanceCollector.getAggregatedMetrics(timeRange)
      const alerts = this.performanceCollector.getAlerts()
      const topMetrics = this.aggregator.getTopMetrics(10)

      const dashboard = {
        overview: {
          uptime: process.uptime(),
          activeRequests: this.requestCollector.getActiveRequestCount(),
          totalRequests: requestStats.total,
          requestRate: requestStats.requestsPerSecond,
          errorRate: requestStats.errorRate,
          avgResponseTime: requestStats.avgDuration,
        },
        performance: {
          memoryUsage: performanceAggregated.avgMemoryUsage,
          cpuUsage: performanceAggregated.avgCpuUsage,
          memoryTrend: this.performanceCollector.getMemoryTrend(timeRange),
          cpuTrend: this.performanceCollector.getCPUTrend(timeRange),
        },
        alerts,
        topMetrics,
        recentErrors: this.requestCollector.getErrorRequests().slice(0, 10),
        slowRequests: this.requestCollector.getSlowRequests(1000).slice(0, 10),
        timestamp: Date.now(),
        timeRange,
      }

      res.json(dashboard)
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retrieve dashboard data',
        message: (error as Error).message,
      })
    }
  }
}
