import {
  Metric,
  Counter,
  Gauge,
  Timer,
  RequestMetrics,
  PerformanceMetrics,
} from './types';

export interface AggregationConfig {
  interval: number;
  retentionPeriods: {
    raw: number;       // 1 hour
    minute: number;   // 1 day
    hour: number;      // 1 week
    day: number;       // 1 month
  };
  maxSamples: {
    raw: number;
    minute: number;
    hour: number;
    day: number;
  };
}

export interface AggregatedMetric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  interval: 'raw' | 'minute' | 'hour' | 'day';
  timestamp: number;
  value: number;
  count?: number;
  min?: number;
  max?: number;
  avg?: number;
  sum?: number;
  tags?: Record<string, string>;
}

export class MetricsAggregator {
  private config: AggregationConfig;
  private rawMetrics: Map<string, Metric[]> = new Map();
  private minuteMetrics: Map<string, AggregatedMetric[]> = new Map();
  private hourMetrics: Map<string, AggregatedMetric[]> = new Map();
  private dayMetrics: Map<string, AggregatedMetric[]> = new Map();
  private aggregationInterval?: NodeJS.Timeout | undefined;

  constructor(config: AggregationConfig) {
    this.config = {
      interval: config.interval || 60000,
      retentionPeriods: {
        raw: config.retentionPeriods?.raw || 3600000,     // 1 hour
        minute: config.retentionPeriods?.minute || 86400000,  // 1 day
        hour: config.retentionPeriods?.hour || 604800000,    // 1 week
        day: config.retentionPeriods?.day || 2592000000,     // 1 month
      },
      maxSamples: {
        raw: config.maxSamples?.raw || 10000,
        minute: config.maxSamples?.minute || 1440,    // 1 day of minutes
        hour: config.maxSamples?.hour || 168,         // 1 week of hours
        day: config.maxSamples?.day || 30,            // 1 month of days
      },
    };
  }

  startAggregation(): void {
    if (this.aggregationInterval) {
      this.stopAggregation();
    }

    this.aggregationInterval = setInterval(() => {
      this.aggregateMetrics();
    }, this.config.interval);
  }

  stopAggregation(): void {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = undefined;
    }
  }

  addMetric(metric: Metric): void {
    const key = this.getMetricKey(metric);
    const metrics = this.rawMetrics.get(key) || [];
    metrics.push(metric);
    this.rawMetrics.set(key, metrics);

    // Cleanup old metrics
    this.cleanupOldMetrics();
  }

  addRequestMetrics(requestMetrics: RequestMetrics): void {
    // Convert request metrics to counters and timers
    this.addMetric({
      name: 'requests_total',
      description: 'Total number of requests',
      type: 'counter',
      value: 1,
      tags: { method: requestMetrics.method, path: requestMetrics.path },
    } as Counter);

    this.addMetric({
      name: 'request_duration',
      description: 'Request duration in milliseconds',
      type: 'timer',
      duration: requestMetrics.duration,
      tags: { method: requestMetrics.method, path: requestMetrics.path },
    } as Timer);

    if (requestMetrics.success) {
      this.addMetric({
        name: 'requests_successful',
        description: 'Number of successful requests',
        type: 'counter',
        value: 1,
        tags: { method: requestMetrics.method, path: requestMetrics.path },
      } as Counter);
    } else {
      this.addMetric({
        name: 'requests_failed',
        description: 'Number of failed requests',
        type: 'counter',
        value: 1,
        tags: { method: requestMetrics.method, path: requestMetrics.path },
      } as Counter);
    }
  }

  addPerformanceMetrics(performanceMetrics: PerformanceMetrics): void {
    this.addMetric({
      name: 'memory_usage_percentage',
      description: 'Memory usage percentage',
      type: 'gauge',
      value: performanceMetrics.memoryUsage.percentage,
    } as Gauge);

    this.addMetric({
      name: 'cpu_usage_percentage',
      description: 'CPU usage percentage',
      type: 'gauge',
      value: performanceMetrics.cpuUsage,
    } as Gauge);

    this.addMetric({
      name: 'uptime',
      description: 'Server uptime in milliseconds',
      type: 'gauge',
      value: performanceMetrics.uptime,
    } as Gauge);
  }

  getRawMetrics(name?: string, tags?: Record<string, string>): Metric[] {
    if (name) {
      const key = this.getMetricKey({ name, tags } as Metric);
      return this.rawMetrics.get(key) || [];
    }

    const allMetrics: Metric[] = [];
    for (const metrics of this.rawMetrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  }

  getAggregatedMetrics(
    interval: 'minute' | 'hour' | 'day',
    name?: string,
    tags?: Record<string, string>,
    timeRange?: number
  ): AggregatedMetric[] {
    const metricsMap = this.getMetricsMapForInterval(interval);
    let metrics: AggregatedMetric[] = [];

    if (name) {
      const key = this.getMetricKey({ name, tags } as Metric);
      metrics = metricsMap.get(key) || [];
    } else {
      for (const ms of metricsMap.values()) {
        metrics.push(...ms);
      }
    }

    if (timeRange) {
      const now = Date.now();
      const startTime = now - timeRange;
      metrics = metrics.filter(m => m.timestamp >= startTime);
    }

    return metrics.sort((a, b) => b.timestamp - a.timestamp);
  }

  getMetricSummary(name: string, _timeRange: number = 3600000): {
    name: string;
    total: number;
    avg: number;
    min: number;
    max: number;
    latest: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const metrics = this.getRawMetrics(name);
    const relevantMetrics = metrics; // Simplified for now

    if (relevantMetrics.length === 0) {
      return {
        name,
        total: 0,
        avg: 0,
        min: 0,
        max: 0,
        latest: 0,
        trend: 'stable',
      };
    }

    const values = relevantMetrics.map(m => this.getMetricValue(m));
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = values[values.length - 1];

    // Simple trend calculation
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (secondAvg > firstAvg * 1.1) {
      trend = 'increasing';
    } else if (secondAvg < firstAvg * 0.9) {
      trend = 'decreasing';
    }

    return {
      name,
      total: relevantMetrics.length,
      avg,
      min,
      max,
      latest,
      trend,
    };
  }

  getTopMetrics(limit: number = 10, sortBy: 'total' | 'avg' | 'max' = 'total'): Array<{
    name: string;
    value: number;
    count: number;
  }> {
    const metricCounts = new Map<string, { total: number; sum: number; max: number; count: number }>();

    for (const metrics of this.rawMetrics.values()) {
      for (const metric of metrics) {
        const key = metric.name;
        const stats = metricCounts.get(key) || { total: 0, sum: 0, max: 0, count: 0 };
        const value = this.getMetricValue(metric);

        stats.total += value;
        stats.sum += value;
        stats.max = Math.max(stats.max, value);
        stats.count++;

        metricCounts.set(key, stats);
      }
    }

    return Array.from(metricCounts.entries())
      .map(([name, stats]) => ({
        name,
        value: sortBy === 'total' ? stats.total : sortBy === 'avg' ? stats.sum / stats.count : stats.max,
        count: stats.count,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  exportMetrics(format: 'json' | 'csv' | 'prometheus' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(this.getAllMetrics(), null, 2);
      case 'csv':
        return this.exportToCSV();
      case 'prometheus':
        return this.exportToPrometheus();
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  clearAllMetrics(): void {
    this.rawMetrics.clear();
    this.minuteMetrics.clear();
    this.hourMetrics.clear();
    this.dayMetrics.clear();
  }

  private aggregateMetrics(): void {
    const now = Date.now();
    const minuteStart = now - (now % 60000);

    // Aggregate raw metrics to minute level
    for (const [key, metrics] of this.rawMetrics.entries()) {
      if (metrics.length === 0) continue;

      const aggregated = this.aggregateMetricGroup(metrics, minuteStart, 'minute');
      if (aggregated) {
        const minuteMetrics = this.minuteMetrics.get(key) || [];
        minuteMetrics.push(aggregated);
        this.minuteMetrics.set(key, minuteMetrics);
      }
    }

    // Further aggregate minute to hour, hour to day
    this.aggregateUpwards();
  }

  private aggregateMetricGroup(
    metrics: Metric[],
    timestamp: number,
    interval: 'minute' | 'hour' | 'day'
  ): AggregatedMetric | null {
    if (metrics.length === 0) return null;

    const firstMetric = metrics[0];
    const values = metrics.map(m => this.getMetricValue(m));

    const aggregated: AggregatedMetric = {
      name: firstMetric.name,
      type: firstMetric.type,
      interval,
      timestamp,
      value: 0,
      tags: firstMetric.tags || {},
    };

    switch (firstMetric.type) {
      case 'counter':
        aggregated.value = values.reduce((sum, val) => sum + val, 0);
        aggregated.count = metrics.length;
        break;
      case 'gauge':
        aggregated.value = values[values.length - 1]; // Latest value
        aggregated.min = Math.min(...values);
        aggregated.max = Math.max(...values);
        aggregated.avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        break;
      case 'histogram':
      case 'timer':
        aggregated.value = values.reduce((sum, val) => sum + val, 0);
        aggregated.count = metrics.length;
        aggregated.min = Math.min(...values);
        aggregated.max = Math.max(...values);
        aggregated.avg = values.reduce((sum, val) => sum + val, 0) / values.length;
        aggregated.sum = aggregated.value;
        break;
    }

    return aggregated;
  }

  private aggregateUpwards(): void {
    // This would implement aggregation from minute -> hour -> day
    // Simplified for now
  }

  private getMetricKey(metric: Metric): string {
    if (!metric.tags || Object.keys(metric.tags).length === 0) {
      return metric.name;
    }

    const tagString = Object.entries(metric.tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');

    return `${metric.name}{${tagString}}`;
  }

  private getMetricValue(metric: Metric): number {
    switch (metric.type) {
      case 'counter':
      case 'gauge':
        return metric.value;
      case 'histogram':
        return metric.sum / metric.count; // Average
      case 'timer':
        return metric.duration;
      default:
        return 0;
    }
  }

  private getMetricsMapForInterval(interval: 'minute' | 'hour' | 'day'): Map<string, AggregatedMetric[]> {
    switch (interval) {
      case 'minute':
        return this.minuteMetrics;
      case 'hour':
        return this.hourMetrics;
      case 'day':
        return this.dayMetrics;
    }
  }

  private cleanupOldMetrics(): void {
    // const now = Date.now();

    // Cleanup raw metrics
    for (const [key, metrics] of this.rawMetrics.entries()) {
      // Simplified for now - just limit size
      this.rawMetrics.set(key, metrics.slice(-this.config.maxSamples.raw));
    }

    // Cleanup aggregated metrics
    this.cleanupAggregatedMetrics(this.minuteMetrics, this.config.retentionPeriods.minute, this.config.maxSamples.minute);
    this.cleanupAggregatedMetrics(this.hourMetrics, this.config.retentionPeriods.hour, this.config.maxSamples.hour);
    this.cleanupAggregatedMetrics(this.dayMetrics, this.config.retentionPeriods.day, this.config.maxSamples.day);
  }

  private cleanupAggregatedMetrics(
    metricsMap: Map<string, AggregatedMetric[]>,
    retentionPeriod: number,
    maxSamples: number
  ): void {
    const now = Date.now();
    const cutoff = now - retentionPeriod;

    for (const [key, metrics] of metricsMap.entries()) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      metricsMap.set(key, filtered.slice(-maxSamples));
    }
  }

  private getAllMetrics(): {
    raw: Metric[];
    minute: AggregatedMetric[];
    hour: AggregatedMetric[];
    day: AggregatedMetric[];
  } {
    const raw: Metric[] = [];
    for (const metrics of this.rawMetrics.values()) {
      raw.push(...metrics);
    }

    const minute: AggregatedMetric[] = [];
    for (const metrics of this.minuteMetrics.values()) {
      minute.push(...metrics);
    }

    const hour: AggregatedMetric[] = [];
    for (const metrics of this.hourMetrics.values()) {
      hour.push(...metrics);
    }

    const day: AggregatedMetric[] = [];
    for (const metrics of this.dayMetrics.values()) {
      day.push(...metrics);
    }

    return { raw, minute, hour, day };
  }

  private exportToCSV(): string {
    const metrics = this.getAllMetrics();
    let csv = 'name,type,interval,timestamp,value,count,min,max,avg,sum,tags\n';

    const writeRow = (metric: any, type: string, interval: string) => {
      csv += `${metric.name},${type},${interval},${metric.timestamp},${metric.value || ''},${metric.count || ''},${metric.min || ''},${metric.max || ''},${metric.avg || ''},${metric.sum || ''},"${JSON.stringify(metric.tags || {})}"\n`;
    };

    metrics.raw.forEach(m => writeRow(m, m.type, 'raw'));
    metrics.minute.forEach(m => writeRow(m, m.type, 'minute'));
    metrics.hour.forEach(m => writeRow(m, m.type, 'hour'));
    metrics.day.forEach(m => writeRow(m, m.type, 'day'));

    return csv;
  }

  private exportToPrometheus(): string {
    const prometheus: string[] = [];

    const writeMetric = (metric: any, type: string) => {
      const tags = metric.tags ? Object.entries(metric.tags)
        .map(([key, value]) => `${key}="${value}"`)
        .join(',') : '';

      const nameWithTags = tags ? `${metric.name}{${tags}}` : metric.name;
      
      switch (type) {
        case 'counter':
          prometheus.push(`# TYPE ${metric.name} counter`);
          prometheus.push(`${nameWithTags} ${metric.value}`);
          break;
        case 'gauge':
          prometheus.push(`# TYPE ${metric.name} gauge`);
          prometheus.push(`${nameWithTags} ${metric.value}`);
          break;
        case 'histogram':
          prometheus.push(`# TYPE ${metric.name} histogram`);
          prometheus.push(`${nameWithTags}_sum ${metric.sum}`);
          prometheus.push(`${nameWithTags}_count ${metric.count}`);
          break;
      }
    };

    const latestMetrics = new Map<string, Metric>();
    for (const metrics of this.rawMetrics.values()) {
      if (metrics.length > 0) {
        const latest = metrics[metrics.length - 1];
        latestMetrics.set(latest.name, latest);
      }
    }

    for (const metric of latestMetrics.values()) {
      writeMetric(metric, metric.type);
    }

    return prometheus.join('\n');
  }
}