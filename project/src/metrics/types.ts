export interface MetricValue {
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

export interface Counter {
  name: string;
  description: string;
  type: 'counter';
  value: number;
  tags?: Record<string, string>;
}

export interface Gauge {
  name: string;
  description: string;
  type: 'gauge';
  value: number;
  tags?: Record<string, string>;
}

export interface Histogram {
  name: string;
  description: string;
  type: 'histogram';
  buckets: number[];
  count: number;
  sum: number;
  values: number[];
  tags?: Record<string, string>;
}

export interface Timer {
  name: string;
  description: string;
  type: 'timer';
  duration: number;
  tags?: Record<string, string>;
}

export type Metric = Counter | Gauge | Histogram | Timer;

export interface RequestMetrics {
  requestId: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: number;
  userId?: string;
  userAgent?: string | undefined;
  ip?: string | undefined;
  success: boolean;
  error?: string;
}

export interface PerformanceMetrics {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
  uptime: number;
  timestamp: number;
}

export interface ServerMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number;
  };
  responseTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  connections: {
    active: number;
    total: number;
  };
  errors: {
    total: number;
    rate: number;
  };
  timestamp: number;
}

export interface MetricsConfig {
  enabled: boolean;
  interval: number;
  retentionPeriod: number;
  maxSamples: number;
  buckets: number[];
  tags?: Record<string, string>;
}

export interface MetricsCollector {
  incrementCounter(name: string, value?: number, tags?: Record<string, string>): void;
  setGauge(name: string, value: number, tags?: Record<string, string>): void;
  recordTimer(name: string, duration: number, tags?: Record<string, string>): void;
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void;
  recordRequest(metrics: RequestMetrics): void;
  recordPerformance(metrics: PerformanceMetrics): void;
  getMetrics(): Metric[];
  getRequestMetrics(limit?: number): RequestMetrics[];
  getServerMetrics(): ServerMetrics;
  getAggregatedMetrics(timeRange?: number): Record<string, any>;
  reset(): void;
}