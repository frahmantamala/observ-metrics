/**
 * Datadog integration for observ-metrics
 * Exports clean, business-contextualized telemetry to Datadog RUM and APM
 */

import type { TelemetryEvent, PlatformConfig, ExporterPlugin } from '../types'

export class DatadogExporter implements ExporterPlugin {
  name = 'datadog'
  private config: PlatformConfig
  private batchedEvents: TelemetryEvent[] = []
  private flushTimer?: NodeJS.Timeout

  constructor() {
    this.config = {
      platform: 'datadog',
      batchSize: 100,
      flushInterval: 5000
    }
  }

  configure(config: PlatformConfig): void {
    this.config = { ...this.config, ...config }
    
    if (!this.config.apiKey) {
      console.warn('[DatadogExporter] No API key provided. Events will be logged to console.')
    }

    // Initialize Datadog RUM if running in browser
    if (typeof window !== 'undefined' && this.config.apiKey) {
      this.initializeDatadogRUM()
    }

    // Start flush timer
    this.startFlushTimer()
  }

  private initializeDatadogRUM(): void {
    // Initialize Datadog RUM SDK
    // This would typically use the actual Datadog SDK
    console.log('[DatadogExporter] Initializing Datadog RUM with enhanced business context')
    
    // Example of how Datadog RUM would be initialized
    /*
    import { datadogRum } from '@datadog/browser-rum'
    
    datadogRum.init({
      applicationId: this.config.applicationId,
      clientToken: this.config.apiKey,
      site: 'datadoghq.com',
      service: 'observ-metrics-app',
      env: process.env.NODE_ENV,
      version: '1.0.0',
      sessionSampleRate: 100,
      sessionReplaySampleRate: 20,
      trackUserInteractions: true,
      trackResources: true,
      trackLongTasks: true,
      defaultPrivacyLevel: 'mask-user-input'
    })
    */
  }

  async export(events: TelemetryEvent[]): Promise<void> {
    // Add events to batch
    this.batchedEvents.push(...events)

    // Flush if batch size reached
    if (this.batchedEvents.length >= (this.config.batchSize || 100)) {
      await this.flush()
    }
  }

  private async flush(): Promise<void> {
    if (this.batchedEvents.length === 0) return

    const eventsToFlush = [...this.batchedEvents]
    this.batchedEvents = []

    try {
      if (this.config.apiKey && this.config.endpoint) {
        await this.sendToDatadog(eventsToFlush)
      } else {
        // Fallback to console logging with structured format
        this.logToConsole(eventsToFlush)
      }
    } catch (error) {
      console.error('[DatadogExporter] Failed to export events:', error)
      
      // Re-add events to batch for retry (implement retry logic)
      this.batchedEvents.unshift(...eventsToFlush.slice(0, 50)) // Keep max 50 for retry
    }
  }

  private async sendToDatadog(events: TelemetryEvent[]): Promise<void> {
    const datadogEvents = events.map(event => this.convertToDatadogFormat(event))

    const response = await fetch(this.config.endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.config.apiKey!,
        ...this.config.customHeaders
      },
      body: JSON.stringify(datadogEvents)
    })

    if (!response.ok) {
      throw new Error(`Datadog API error: ${response.status} ${response.statusText}`)
    }

    console.log(`[DatadogExporter] Successfully exported ${events.length} events to Datadog`)
  }

  private convertToDatadogFormat(event: TelemetryEvent): any {
    // Convert observ-metrics event to Datadog format
    const baseEvent = {
      timestamp: new Date(event.timestamp).getTime(),
      source: 'observ-metrics',
      service: 'frontend-app',
      host: typeof window !== 'undefined' && window.location ? window.location.hostname : 'unknown',
      
      // Business context tags (key differentiator)
      tags: [
        `domain:${event.domain}`,
        `business_impact:${event.businessContext.businessImpact}`,
        `user_segment:${event.attributes['user.segment'] || 'unknown'}`,
        `device_type:${event.attributes['user.device_type'] || 'unknown'}`,
        `priority:${event.attributes['domain.priority'] || 'medium'}`,
        ...(event.businessContext.feature ? [`feature:${event.businessContext.feature}`] : []),
        ...(event.businessContext.userJourney ? [`journey:${event.businessContext.userJourney}`] : [])
      ]
    }

    switch (event.eventType) {
      case 'span':
        return {
          ...baseEvent,
          message: `${event.name} - ${event.attributes['api.name'] || 'Unknown API'}`,
          level: this.mapSeverityToDatadogLevel(event.severity),
          
          // APM span data
          span: {
            trace_id: event.attributes['trace.id'],
            span_id: event.attributes['span.id'],
            service: event.domain,
            name: event.name,
            resource: event.attributes['http.url'] || event.name,
            duration: event.attributes['http.response_time_ms'] || 0,
            
            // Business context in span tags
            meta: {
              'business.domain': event.domain,
              'business.impact': event.businessContext.businessImpact,
              'business.feature': event.businessContext.feature,
              'business.journey': event.businessContext.userJourney,
              'sla.target': event.attributes['domain.sla_target_ms'],
              'sla.violated': event.attributes['sla.violated'],
              ...this.extractRelevantAttributes(event.attributes)
            }
          }
        }

      case 'metric':
        return {
          ...baseEvent,
          metric: event.attributes['metric.name'],
          points: [[baseEvent.timestamp / 1000, event.attributes['metric.value']]],
          type: 'gauge',
          
          // Business context in metric tags
          tags: [
            ...baseEvent.tags,
            `metric_type:business`,
            `impact_category:${event.businessContext.businessImpact}`
          ]
        }

      case 'error':
        return {
          ...baseEvent,
          message: event.attributes['error.message'] || 'Unknown error',
          level: 'error',
          
          // Error context
          error: {
            kind: event.attributes['error.type'],
            message: event.attributes['error.message'],
            stack: event.attributes['error.stack']
          },
          
          // Business context for error impact analysis
          attributes: {
            'business.domain': event.domain,
            'business.impact': event.businessContext.businessImpact,
            'business.feature': event.businessContext.feature,
            'error.business_critical': this.isBusinessCriticalError(event),
            ...this.extractRelevantAttributes(event.attributes)
          }
        }

      default:
        return {
          ...baseEvent,
          message: event.name,
          level: this.mapSeverityToDatadogLevel(event.severity),
          attributes: event.attributes
        }
    }
  }

  private mapSeverityToDatadogLevel(severity?: string): string {
    const levelMap: Record<string, string> = {
      'critical': 'error',
      'error': 'error', 
      'warn': 'warn',
      'info': 'info'
    }
    return levelMap[severity || 'info'] || 'info'
  }

  private isBusinessCriticalError(event: TelemetryEvent): boolean {
    const criticalDomains = ['authentication', 'ecommerce']
    const criticalFeatures = ['login', 'checkout', 'payment']
    
    return criticalDomains.includes(event.domain) ||
           (event.businessContext.feature && criticalFeatures.includes(event.businessContext.feature))
  }

  private extractRelevantAttributes(attributes: Record<string, any>): Record<string, any> {
    // Extract only business-relevant attributes to avoid noise
    const relevantKeys = [
      'user.session_id', 'user.segment', 'user.authenticated',
      'journey.name', 'journey.step',
      'http.method', 'http.status_code', 'http.response_time_ms',
      'api.name', 'api.success',
      'domain.priority', 'domain.sla_target_ms'
    ]

    const relevant: Record<string, any> = {}
    for (const key of relevantKeys) {
      if (attributes[key] !== undefined) {
        relevant[key] = attributes[key]
      }
    }
    
    return relevant
  }

  private logToConsole(events: TelemetryEvent[]): void {
    console.group(`[DatadogExporter] Exporting ${events.length} events (console fallback)`)
    
    events.forEach(event => {
      const logLevel = this.mapSeverityToLogLevel(event.severity)
      const businessContext = `[${event.domain}:${event.businessContext.businessImpact}]`
      
      console[logLevel](
        `${businessContext} ${event.name}`,
        {
          timestamp: event.timestamp,
          eventType: event.eventType,
          attributes: this.extractRelevantAttributes(event.attributes),
          businessContext: event.businessContext
        }
      )
    })
    
    console.groupEnd()
  }

  private mapSeverityToLogLevel(severity?: string): 'error' | 'warn' | 'info' | 'log' {
    const levelMap: Record<string, 'error' | 'warn' | 'info' | 'log'> = {
      'critical': 'error',
      'error': 'error',
      'warn': 'warn', 
      'info': 'info'
    }
    return levelMap[severity || 'info'] || 'log'
  }

  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    this.flushTimer = setInterval(() => {
      if (this.batchedEvents.length > 0) {
        this.flush()
      }
    }, this.config.flushInterval || 5000)
  }

  /**
   * Manual flush for immediate export
   */
  async forceFlush(): Promise<void> {
    await this.flush()
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }
    
    // Flush remaining events
    if (this.batchedEvents.length > 0) {
      this.flush()
    }
  }
}