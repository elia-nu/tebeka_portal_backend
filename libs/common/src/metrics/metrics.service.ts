import { Injectable, Optional } from '@nestjs/common';

interface MetricCounter {
  name: string;
  help: string;
  values: Map<string, number>;
}

interface MetricHistogram {
  name: string;
  help: string;
  buckets: number[];
  counts: Map<string, number[]>; // labelKey -> bucket counts
  sums: Map<string, number>;
  totalCounts: Map<string, number>;
}

interface MetricGauge {
  name: string;
  help: string;
  values: Map<string, number>;
}

@Injectable()
export class MetricsService {
  private readonly counters = new Map<string, MetricCounter>();
  private readonly gauges = new Map<string, MetricGauge>();
  private readonly histograms = new Map<string, MetricHistogram>();
  private readonly defaultBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private readonly serviceName: string;

  constructor(@Optional() serviceName?: string) {
    this.serviceName = serviceName || process.env.SERVICE_NAME || 'tebeka-service';
    this.initDefaultMetrics();
  }

  private initDefaultMetrics() {
    this.registerCounter('http_requests_total', 'Total number of HTTP requests processed');
    this.registerHistogram(
      'http_request_duration_seconds',
      'HTTP request latency duration in seconds',
      this.defaultBuckets
    );
    this.registerCounter('event_bus_messages_total', 'Total number of RabbitMQ messages published or consumed');
    this.registerGauge('circuit_breaker_state', 'Circuit breaker status (0=CLOSED, 1=HALF_OPEN, 2=OPEN)');
  }

  registerCounter(name: string, help: string): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { name, help, values: new Map() });
    }
  }

  registerGauge(name: string, help: string): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, { name, help, values: new Map() });
    }
  }

  registerHistogram(name: string, help: string, buckets = this.defaultBuckets): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        name,
        help,
        buckets: [...buckets].sort((a, b) => a - b),
        counts: new Map(),
        sums: new Map(),
        totalCounts: new Map(),
      });
    }
  }

  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const counter = this.counters.get(name);
    if (!counter) return;

    const labelKey = this.formatLabels({ service: this.serviceName, ...labels });
    const current = counter.values.get(labelKey) || 0;
    counter.values.set(labelKey, current + value);
  }

  setGauge(name: string, labels: Record<string, string> = {}, value: number): void {
    const gauge = this.gauges.get(name);
    if (!gauge) return;

    const labelKey = this.formatLabels({ service: this.serviceName, ...labels });
    gauge.values.set(labelKey, value);
  }

  observeHistogram(name: string, labels: Record<string, string> = {}, value: number): void {
    const histogram = this.histograms.get(name);
    if (!histogram) return;

    const labelKey = this.formatLabels({ service: this.serviceName, ...labels });

    // Initialize if absent
    if (!histogram.counts.has(labelKey)) {
      histogram.counts.set(labelKey, new Array(histogram.buckets.length).fill(0));
      histogram.sums.set(labelKey, 0);
      histogram.totalCounts.set(labelKey, 0);
    }

    const bucketCounts = histogram.counts.get(labelKey)!;
    for (let i = 0; i < histogram.buckets.length; i++) {
      if (value <= histogram.buckets[i]) {
        bucketCounts[i]++;
      }
    }

    histogram.sums.set(labelKey, (histogram.sums.get(labelKey) || 0) + value);
    histogram.totalCounts.set(labelKey, (histogram.totalCounts.get(labelKey) || 0) + 1);
  }

  recordHttpRequest(method: string, route: string, statusCode: number, durationSeconds: number): void {
    const labels = {
      method: method.toUpperCase(),
      route: route || 'unknown',
      status: String(statusCode),
    };
    this.incrementCounter('http_requests_total', labels);
    this.observeHistogram('http_request_duration_seconds', { method: labels.method, route: labels.route }, durationSeconds);
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels)
      .filter(([_, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
    return entries.length > 0 ? `{${entries.join(',')}}` : '';
  }

  getMetricsAsPrometheusText(): string {
    const lines: string[] = [];

    // Process and system metrics
    const memory = process.memoryUsage();
    lines.push('# HELP process_uptime_seconds Total process uptime in seconds.');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds{service="${this.serviceName}"} ${process.uptime()}`);

    lines.push('# HELP process_heap_bytes Process heap memory usage in bytes.');
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes{service="${this.serviceName}",type="used"} ${memory.heapUsed}`);
    lines.push(`process_heap_bytes{service="${this.serviceName}",type="total"} ${memory.heapTotal}`);

    // Counters
    for (const counter of this.counters.values()) {
      lines.push(`\n# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);
      for (const [labels, val] of counter.values.entries()) {
        lines.push(`${counter.name}${labels} ${val}`);
      }
    }

    // Gauges
    for (const gauge of this.gauges.values()) {
      lines.push(`\n# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);
      for (const [labels, val] of gauge.values.entries()) {
        lines.push(`${gauge.name}${labels} ${val}`);
      }
    }

    // Histograms
    for (const hist of this.histograms.values()) {
      lines.push(`\n# HELP ${hist.name} ${hist.help}`);
      lines.push(`# TYPE ${hist.name} histogram`);
      for (const [labels, bucketCounts] of hist.counts.entries()) {
        const cleanLabels = labels.slice(1, -1); // strip outer {}
        for (let i = 0; i < hist.buckets.length; i++) {
          const le = hist.buckets[i];
          const combinedLabels = cleanLabels ? `{${cleanLabels},le="${le}"}` : `{le="${le}"}`;
          lines.push(`${hist.name}_bucket${combinedLabels} ${bucketCounts[i]}`);
        }
        const infLabels = cleanLabels ? `{${cleanLabels},le="+Inf"}` : `{le="+Inf"}`;
        const total = hist.totalCounts.get(labels) || 0;
        const sum = hist.sums.get(labels) || 0;
        lines.push(`${hist.name}_bucket${infLabels} ${total}`);
        lines.push(`${hist.name}_sum${labels} ${sum}`);
        lines.push(`${hist.name}_count${labels} ${total}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}

export const globalMetrics = new MetricsService();
