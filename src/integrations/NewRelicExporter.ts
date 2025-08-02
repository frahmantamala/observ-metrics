/**
 * New Relic integration for observ-metrics
 * Exports business-contextualized telemetry to New Relic Browser and APM
 */

import type { TelemetryEvent, PlatformConfig, ExporterPlugin } from '../types'

export class NewRelicExporter implements ExporterPlugin {
  name = 'newrelic'
  private config: PlatformConfig
  private batchedEvents: TelemetryEvent[] = []
  private flushTimer?: NodeJS.Timeout

  constructor() {
    this.config = {
      platform: 'newrelic',
      batchSize: 50,
      flushInterval: 10000
    }
  }

  configure(config: PlatformConfig): void {
    this.config = { ...this.config, ...config }
    
    if (!this.config.apiKey) {
      console.warn('[NewRelicExporter] No API key provided. Events will be logged to console.')
    }

    // Initialize New Relic Browser Agent if running in browser
    if (typeof window !== 'undefined' && this.config.apiKey) {
      this.initializeNewRelicBrowser()
    }

    this.startFlushTimer()
  }

  private initializeNewRelicBrowser(): void {
    console.log('[NewRelicExporter] Initializing New Relic Browser with business context')
    
    // Example of New Relic Browser initialization
    /*
    import { newrelic } from 'newrelic'
    
    // Set custom attributes for business context
    newrelic.setCustomAttribute('observ_metrics_version', '1.0.0')
    newrelic.setCustomAttribute('business_context_enabled', true)
    */
  }

  async export(events: TelemetryEvent[]): Promise<void> {
    this.batchedEvents.push(...events)

    if (this.batchedEvents.length >= (this.config.batchSize || 50)) {
      await this.flush()
    }
  }

  private async flush(): Promise<void> {
    if (this.batchedEvents.length === 0) return

    const eventsToFlush = [...this.batchedEvents]
    this.batchedEvents = []

    try {
      if (this.config.apiKey) {
        await this.sendToNewRelic(eventsToFlush)
      } else {
        this.logToConsole(eventsToFlush)
      }
    } catch (error) {
      console.error('[NewRelicExporter] Failed to export events:', error)
      this.batchedEvents.unshift(...eventsToFlush.slice(0, 25)) // Keep 25 for retry
    }
  }

  private async sendToNewRelic(events: TelemetryEvent[]): Promise<void> {
    // New Relic uses different endpoints for different data types
    const spanEvents = events.filter(e => e.eventType === 'span')
    const customEvents = events.filter(e => e.eventType === 'metric' || e.eventType === 'log')
    const errorEvents = events.filter(e => e.eventType === 'error')

    // Send spans to New Relic APM
    if (spanEvents.length > 0) {
      await this.sendSpansToNewRelic(spanEvents)
    }

    // Send custom events to New Relic Insights
    if (customEvents.length > 0) {
      await this.sendCustomEventsToNewRelic(customEvents)
    }

    // Send errors to New Relic Browser/APM
    if (errorEvents.length > 0) {
      await this.sendErrorsToNewRelic(errorEvents)
    }
  }

  private async sendSpansToNewRelic(events: TelemetryEvent[]): Promise<void> {
    const newRelicSpans = events.map(event => this.convertToNewRelicSpan(event))

    const response = await fetch(`${this.config.endpoint}/trace/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.config.apiKey!,
        'Data-Format': 'newrelic',
        'Data-Format-Version': '1',
        ...this.config.customHeaders
      },
      body: JSON.stringify([{
        common: {
          attributes: {
            'service.name': 'observ-metrics-app',
            'service.version': '1.0.0'
          }
        },
        spans: newRelicSpans
      }])
    })

    if (!response.ok) {
      throw new Error(`New Relic Trace API error: ${response.status}`)
    }
  }

  private async sendCustomEventsToNewRelic(events: TelemetryEvent[]): Promise<void> {
    const newRelicEvents = events.map(event => this.convertToNewRelicCustomEvent(event))

    const response = await fetch(`${this.config.endpoint}/v1/accounts/${this.config.accountId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': this.config.apiKey!,
        ...this.config.customHeaders
      },
      body: JSON.stringify(newRelicEvents)
    })

    if (!response.ok) {
      throw new Error(`New Relic Events API error: ${response.status}`)
    }
  }

  private async sendErrorsToNewRelic(events: TelemetryEvent[]): Promise<void> {
    const newRelicErrors = events.map(event => this.convertToNewRelicError(event))

    const response = await fetch(`${this.config.endpoint}/v1/accounts/${this.config.accountId}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
        'Api-Key': this.config.apiKey!,
        ...this.config.customHeaders
      },
      body: JSON.stringify(newRelicErrors)
    })

    if (!response.ok) {
      throw new Error(`New Relic Error API error: ${response.status}`)
    }
  }

  private convertToNewRelicSpan(event: TelemetryEvent): any {
    return {
      id: event.id,
      'trace.id': event.attributes['trace.id'] || event.id,
      timestamp: new Date(event.timestamp).getTime() * 1000, // microseconds
      name: event.name,
      'service.name': event.domain,
      'duration.ms': event.attributes['http.response_time_ms'] || 0,
      
      // Business context attributes (New Relic's strength)
      attributes: {
        // Domain context
        'business.domain': event.domain,
        'business.impact': event.businessContext.businessImpact,
        'business.feature': event.businessContext.feature,
        'business.priority': event.attributes['domain.priority'],
        
        // User context
        'user.segment': event.attributes['user.segment'],
        'user.authenticated': event.attributes['user.authenticated'],
        'user.device': event.attributes['user.device_type'],
        
        // Journey context
        'journey.name': event.businessContext.userJourney,
        'journey.step': event.attributes['journey.step'],
        
        // Technical context
        'http.method': event.attributes['http.method'],
        'http.status_code': event.attributes['http.status_code'],
        'http.url': event.attributes['http.url'],
        
        // SLA context
        'sla.target': event.attributes['domain.sla_target_ms'],
        'sla.violated': event.attributes['sla.violated'],
        'sla.violation_severity': event.attributes['sla.violation_severity'],
        
        // Custom business metrics
        ...this.extractBusinessMetrics(event.attributes)
      }
    }
  }

  private convertToNewRelicCustomEvent(event: TelemetryEvent): any {
    const eventType = event.eventType === 'metric' ? 'BusinessMetric' : 'ObservMetricsEvent'
    
    return {
      eventType,
      timestamp: new Date(event.timestamp).getTime(),
      
      // Core attributes
      name: event.name,
      domain: event.domain,
      businessImpact: event.businessContext.businessImpact,
      
      // Metric-specific attributes
      ...(event.eventType === 'metric' && {
        metricName: event.attributes['metric.name'],
        metricValue: event.attributes['metric.value'],
        metricType: 'business'
      }),
      
      // User context
      userSegment: event.attributes['user.segment'],
      userAuthenticated: event.attributes['user.authenticated'],
      deviceType: event.attributes['user.device_type'],
      
      // Journey context
      journeyName: event.businessContext.userJourney,
      journeyStep: event.attributes['journey.step'],
      
      // Business context
      feature: event.businessContext.feature,
      priority: event.attributes['domain.priority'],
      
      // Additional context
      ...this.extractRelevantAttributes(event.attributes)
    }
  }

  private convertToNewRelicError(event: TelemetryEvent): any {
    return {
      eventType: 'JavaScriptError',
      timestamp: new Date(event.timestamp).getTime(),
      
      // Error details
      errorClass: event.attributes['error.type'],
      errorMessage: event.attributes['error.message'],
      stackTrace: event.attributes['error.stack'],
      
      // Business context (key differentiator)
      businessDomain: event.domain,
      businessImpact: event.businessContext.businessImpact,
      businessFeature: event.businessContext.feature,
      businessCritical: this.isBusinessCriticalError(event),
      
      // User context
      userSegment: event.attributes['user.segment'],
      userAuthenticated: event.attributes['user.authenticated'],
      userSession: event.attributes['user.session_id'],
      
      // Journey context
      journeyName: event.businessContext.userJourney,
      journeyStep: event.attributes['journey.step'],
      
      // Technical context
      url: event.attributes['http.url'] || (typeof window !== 'undefined' && window.location ? window.location.href : 'unknown'),
      userAgent: navigator.userAgent,
      
      // Additional business context
      domainPriority: event.attributes['domain.priority'],
      ...this.extractRelevantAttributes(event.attributes)
    }
  }

  private isBusinessCriticalError(event: TelemetryEvent): boolean {
    const criticalDomains = ['authentication', 'ecommerce']
    const criticalFeatures = ['login', 'checkout', 'payment']
    
    return criticalDomains.includes(event.domain) ||
           (event.businessContext.feature && criticalFeatures.includes(event.businessContext.feature))
  }

  private extractBusinessMetrics(attributes: Record<string, any>): Record<string, any> {
    const businessMetrics: Record<string, any> = {}
    
    // Extract SLA metrics
    if (attributes['sla.violated']) {
      businessMetrics['sla_violation'] = 1
      businessMetrics['sla_violation_ms'] = attributes['sla.actual_ms'] - attributes['sla.target_ms']
    }
    
    // Extract performance metrics
    if (attributes['http.response_time_ms']) {
      businessMetrics['response_time_category'] = this.categorizeResponseTime(attributes['http.response_time_ms'])
    }
    
    // Extract conversion metrics
    if (attributes['journey.step']) {
      businessMetrics['journey_step_completed'] = 1
    }
    
    return businessMetrics
  }

  private categorizeResponseTime(responseTime: number): string {
    if (responseTime < 100) return 'excellent'
    if (responseTime < 300) return 'good'
    if (responseTime < 1000) return 'acceptable'
    if (responseTime < 3000) return 'slow'
    return 'very_slow'
  }

  private extractRelevantAttributes(attributes: Record<string, any>): Record<string, any> {
    const relevantKeys = [
      'api.name', 'api.success',
      'http.method', 'http.status_code',
      'domain.sla_target_ms', 'domain.error_threshold'
    ]

    const relevant: Record<string, any> = {}
    for (const key of relevantKeys) {
      if (attributes[key] !== undefined) {
        // New Relic prefers camelCase
        const newRelicKey = key.replace(/\./g, '_')
        relevant[newRelicKey] = attributes[key]
      }
    }
    
    return relevant
  }

  private logToConsole(events: TelemetryEvent[]): void {
    console.group(`[NewRelicExporter] Exporting ${events.length} events (console fallback)`)
    
    events.forEach(event => {
      const businessContext = `[${event.domain}:${event.businessContext.businessImpact}]`
      const logData = {
        eventType: event.eventType,
        name: event.name,
        timestamp: event.timestamp,
        businessContext: event.businessContext,
        relevantAttributes: this.extractRelevantAttributes(event.attributes)
      }
      
      if (event.severity === 'error' || event.severity === 'critical') {
        console.error(`${businessContext} ${event.name}`, logData)
      } else if (event.severity === 'warn') {
        console.warn(`${businessContext} ${event.name}`, logData)
      } else {
        console.info(`${businessContext} ${event.name}`, logData)
      }
    })
    
    console.groupEnd()
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      if (this.batchedEvents.length > 0) {
        this.flush()
      }
    }, this.config.flushInterval || 10000)
  }

  async forceFlush(): Promise<void> {
    await this.flush()
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
    
    if (this.batchedEvents.length > 0) {
      this.flush()
    }
  }
}