import {
  MetricsCollector,
  MetricsConfig,
  Metric,
  Counter,
  Gauge,
  Histogram,
  Timer,
  RequestMetrics,
  PerformanceMetrics,
  ServerMetrics,
} from './types'

export class BaseMetricsCollector implements MetricsCollector {
  protected config: MetricsConfig
  protected counters: Map<string, Counter> = new Map()
  protected gauges: Map<string, Gauge> = new Map()
  protected histograms: Map<string, Histogram> = new Map()
  protected timers: Map<string, Timer[]> = new Map()
  protected requestMetrics: RequestMetrics[] = []
  protected performanceMetrics: PerformanceMetrics[] = []
  protected startTime: number = Date.now()

  constructor(config: MetricsConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      interval: config.interval ?? 60000,
      retentionPeriod: config.retentionPeriod ?? 3600000,
      maxSamples: config.maxSamples ?? 10000,
      buckets: config.buckets ?? [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      tags: config.tags ?? {},
    }
  }

  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    if (!this.config.enabled) return

    const key = this.getMetricKey(name, tags)
    const counter = this.counters.get(key) || {
      name,
      description: `Counter for ${name}`,
      type: 'counter',
      value: 0,
      ...(tags && { tags }),
    }

    counter.value += value
    this.counters.set(key, counter)
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return

    const key = this.getMetricKey(name, tags)
    const gauge: Gauge = {
      name,
      description: `Gauge for ${name}`,
      type: 'gauge',
      value,
      ...(tags && { tags }),
    }

    this.gauges.set(key, gauge)
  }

  recordTimer(name: string, duration: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return

    const key = this.getMetricKey(name, tags)
    const timers = this.timers.get(key) || []
    const timer: Timer = {
      name,
      description: `Timer for ${name}`,
      type: 'timer',
      duration,
      ...(tags && { tags }),
    }

    timers.push(timer)
    this.timers.set(key, timers)

    // Also record as histogram for percentiles
    this.recordHistogram(name, duration, tags)
  }

  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.config.enabled) return

    const key = this.getMetricKey(name, tags)
    const histogram = this.histograms.get(key) || {
      name,
      description: `Histogram for ${name}`,
      type: 'histogram',
      buckets: this.config.buckets,
      count: 0,
      sum: 0,
      values: [] as number[],
      ...(tags && { tags }),
    }

    histogram.count++
    histogram.sum += value
    histogram.values.push(value)

    // Update bucket counts
    for (let i = 0; i < histogram.buckets.length; i++) {
      if (value <= histogram.buckets[i]) {
        // In a real implementation, we'd track bucket counts
        break
      }
    }

    this.histograms.set(key, histogram)
  }

  recordRequest(metrics: RequestMetrics): void {
    if (!this.config.enabled) return

    this.requestMetrics.push(metrics)
    this.cleanupOldMetrics()

    // Update aggregated counters
    this.incrementCounter('requests_total', 1, { method: metrics.method, path: metrics.path })
    this.incrementCounter('requests_duration', metrics.duration, {
      method: metrics.method,
      path: metrics.path,
    })

    if (metrics.success) {
      this.incrementCounter('requests_successful', 1, {
        method: metrics.method,
        path: metrics.path,
      })
    } else {
      this.incrementCounter('requests_failed', 1, { method: metrics.method, path: metrics.path })
    }
  }

  recordPerformance(metrics: PerformanceMetrics): void {
    if (!this.config.enabled) return

    this.performanceMetrics.push(metrics)
    this.cleanupOldMetrics()

    // Update performance gauges
    this.setGauge('memory_used', metrics.memoryUsage.used)
    this.setGauge('memory_total', metrics.memoryUsage.total)
    this.setGauge('memory_percentage', metrics.memoryUsage.percentage)
    this.setGauge('cpu_usage', metrics.cpuUsage)
    this.setGauge('uptime', metrics.uptime)
  }

  getMetrics(): Metric[] {
    const metrics: Metric[] = []

    // Add counters
    for (const counter of this.counters.values()) {
      metrics.push(counter)
    }

    // Add gauges
    for (const gauge of this.gauges.values()) {
      metrics.push(gauge)
    }

    // Add histograms
    for (const histogram of this.histograms.values()) {
      metrics.push(histogram)
    }

    // Add timers
    for (const timers of this.timers.values()) {
      metrics.push(...timers)
    }

    return metrics
  }

  getRequestMetrics(limit?: number): RequestMetrics[] {
    const metrics = this.requestMetrics.slice().reverse()
    return limit ? metrics.slice(0, limit) : metrics
  }

  getServerMetrics(): ServerMetrics {
    const now = Date.now()
    const timeWindow = 60000 // 1 minute window

    // Filter recent requests
    const recentRequests = this.requestMetrics.filter(req => now - req.timestamp < timeWindow)

    // Calculate request metrics
    const totalRequests = recentRequests.length
    const successfulRequests = recentRequests.filter(req => req.success).length
    const failedRequests = totalRequests - successfulRequests
    const requestRate = totalRequests / (timeWindow / 1000)

    // Calculate response time metrics
    const durations = recentRequests.map(req => req.duration)
    const responseTime = {
      min: durations.length > 0 ? Math.min(...durations) : 0,
      max: durations.length > 0 ? Math.max(...durations) : 0,
      avg: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p95: this.calculatePercentile(durations, 95),
      p99: this.calculatePercentile(durations, 99),
    }

    // Calculate error rate
    const errorRate = failedRequests / (timeWindow / 1000)

    return {
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        rate: requestRate,
      },
      responseTime,
      connections: {
        active: 0, // Would need to track active connections
        total: totalRequests,
      },
      errors: {
        total: failedRequests,
        rate: errorRate,
      },
      timestamp: now,
    }
  }

  getAggregatedMetrics(timeRange: number = 3600000): Record<string, any> {
    const now = Date.now()
    const startTime = now - timeRange

    const filteredRequests = this.requestMetrics.filter(req => req.timestamp >= startTime)
    const filteredPerformance = this.performanceMetrics.filter(perf => perf.timestamp >= startTime)

    return {
      requests: {
        total: filteredRequests.length,
        successful: filteredRequests.filter(req => req.success).length,
        failed: filteredRequests.filter(req => !req.success).length,
        avgDuration:
          filteredRequests.length > 0
            ? filteredRequests.reduce((sum, req) => sum + req.duration, 0) / filteredRequests.length
            : 0,
      },
      performance: {
        avgMemoryUsage:
          filteredPerformance.length > 0
            ? filteredPerformance.reduce((sum, perf) => sum + perf.memoryUsage.percentage, 0) /
              filteredPerformance.length
            : 0,
        avgCpuUsage:
          filteredPerformance.length > 0
            ? filteredPerformance.reduce((sum, perf) => sum + perf.cpuUsage, 0) /
              filteredPerformance.length
            : 0,
      },
      timeRange,
      timestamp: now,
    }
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    this.timers.clear()
    this.requestMetrics = []
    this.performanceMetrics = []
    this.startTime = Date.now()
  }

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name
    }

    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',')

    return `${name}{${tagString}}`
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0

    const sorted = values.slice().sort((a, b) => a - b)
    const index = Math.ceil((percentile / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  private cleanupOldMetrics(): void {
    const now = Date.now()
    const cutoff = now - this.config.retentionPeriod

    // Clean up old request metrics
    this.requestMetrics = this.requestMetrics.filter(req => req.timestamp > cutoff)

    // Clean up old performance metrics
    this.performanceMetrics = this.performanceMetrics.filter(perf => perf.timestamp > cutoff)

    // Clean up old timers
    for (const [key, timers] of this.timers.entries()) {
      const recentTimers = timers.filter(_timer => {
        // We don't have timestamp on timers, so we'll keep them all for now
        // In a real implementation, timers would have timestamps
        return true
      })
      this.timers.set(key, recentTimers)
    }

    // Limit total samples
    if (this.requestMetrics.length > this.config.maxSamples) {
      this.requestMetrics = this.requestMetrics.slice(-this.config.maxSamples)
    }

    if (this.performanceMetrics.length > this.config.maxSamples) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.config.maxSamples)
    }
  }
}
