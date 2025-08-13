export * from './types'
export * from './BaseMetricsCollector'
export * from './RequestMetricsCollector'
export * from './PerformanceMetricsCollector'
export * from './MetricsAggregator'
export * from './MetricsMiddleware'
export * from './MetricsAPI'

import { BaseMetricsCollector } from './BaseMetricsCollector'
import { RequestMetricsCollector } from './RequestMetricsCollector'
import { PerformanceMetricsCollector } from './PerformanceMetricsCollector'
import { MetricsAggregator } from './MetricsAggregator'
import { MetricsMiddleware } from './MetricsMiddleware'
import { MetricsAPI } from './MetricsAPI'
import { MetricsConfig } from './types'

export class MetricsManager {
  private baseCollector: BaseMetricsCollector
  private requestCollector: RequestMetricsCollector
  private performanceCollector: PerformanceMetricsCollector
  private aggregator: MetricsAggregator
  private middleware: MetricsMiddleware
  private api: MetricsAPI

  constructor(config: MetricsConfig) {
    this.baseCollector = new BaseMetricsCollector(config)
    this.requestCollector = new RequestMetricsCollector(config.maxSamples || 10000)
    this.performanceCollector = new PerformanceMetricsCollector(
      config.maxSamples || 1000,
      config.interval || 5000
    )

    const aggregationConfig = {
      interval: config.interval || 60000,
      retentionPeriods: {
        raw: config.retentionPeriod || 3600000,
        minute: 86400000,
        hour: 604800000,
        day: 2592000000,
      },
      maxSamples: {
        raw: config.maxSamples || 10000,
        minute: 1440,
        hour: 168,
        day: 30,
      },
    }

    this.aggregator = new MetricsAggregator(aggregationConfig)
    this.middleware = new MetricsMiddleware(this.baseCollector, this.requestCollector, {
      enableRequestMetrics: true,
      enableResponseMetrics: true,
      enablePerformanceMetrics: true,
      trackHeaders: [],
      trackQueries: [],
      excludePaths: ['/health', '/metrics'],
      sampleRate: 1.0,
      slowRequestThreshold: 1000,
    })

    this.api = new MetricsAPI(
      this.baseCollector,
      this.requestCollector,
      this.performanceCollector,
      this.aggregator
    )
  }

  start(): void {
    this.performanceCollector.startCollection()
    this.aggregator.startAggregation()
  }

  stop(): void {
    this.performanceCollector.stopCollection()
    this.aggregator.stopAggregation()
  }

  getBaseCollector(): BaseMetricsCollector {
    return this.baseCollector
  }

  getRequestCollector(): RequestMetricsCollector {
    return this.requestCollector
  }

  getPerformanceCollector(): PerformanceMetricsCollector {
    return this.performanceCollector
  }

  getAggregator(): MetricsAggregator {
    return this.aggregator
  }

  getMiddleware(): MetricsMiddleware {
    return this.middleware
  }

  getAPI(): MetricsAPI {
    return this.api
  }
}
