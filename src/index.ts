/**
 * observ-metrics -  frontend monitoring library
 * 
 * Eliminates noise and adds business context to OpenTelemetry data
 * Compatible with Datadog, New Relic, Grafana, and other observability platforms
 */

import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web'

import { Filter } from './core/SmartFilter'
import { DomainInstrumentor } from './core/DomainInstrumentor'
import { DatadogExporter } from './integrations/DatadogExporter'
import { NewRelicExporter } from './integrations/NewRelicExporter'

import type { 
  ObservMetricsConfig, 
  UserContext, 
  DomainConfig, 
  TelemetryEvent,
  ExporterPlugin,
  DomainInstrumentor as IDomainInstrumentor
} from './types'

export class ObservMetrics {
  private Filter: Filter
  private instrumentors: Map<string, DomainInstrumentor> = new Map()
  private exporters: ExporterPlugin[] = []
  private events: TelemetryEvent[] = []
  private isInitialized = false

  constructor(private config: ObservMetricsConfig) {
    // Ensure platform config has default values if not provided
    this.config = {
      userContext: {},
      ...config,
      platform: {
        platform: 'console',
        ...config.platform
      }
    }
    
    this.Filter = new Filter(this.config.filtering)
    this.setupExporters()
  }

  /**
   * Initialize the monitoring system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn('[ObservMetrics] Already initialized')
      return
    }

    // Only initialize if we have real user session
    if (!this.Filter.isRealUserSession()) {
      if (this.config.debug) {
        console.log('[ObservMetrics] Bot/automated session detected, skipping initialization')
      }
      return
    }

    try {
      // Initialize OpenTelemetry Web SDK with  filtering
      await this.initializeOpenTelemetry()
      
      // Initialize domain instrumentors
      this.initializeDomainInstrumentors()
      
      this.isInitialized = true
      
      if (this.config.debug) {
        console.log('[ObservMetrics] Successfully initialized with business context monitoring')
        this.logConfiguration()
      }

    } catch (error) {
      console.error('[ObservMetrics] Failed to initialize:', error)
      throw error
    }
  }

  private async initializeOpenTelemetry(): Promise<void> {
    const provider = new WebTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'observ-metrics-app',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
      })
    })

    // Register instrumentations
    const instrumentations = getWebAutoInstrumentations({
      // Configure auto-instrumentations with smart filtering
      '@opentelemetry/instrumentation-fetch': {
        requestHook: (span, request) => {
          // Apply smart filtering at the instrumentation level
          const event = this.createEventFromSpan(span, 'fetch')
          if (!this.Filter.shouldProcess(event, this.getCurrentUserContext())) {
            // Don't process this span
            span.end()
            return
          }
          
          // Add business context
          this.enrichSpanWithBusinessContext(span, request)
        }
      },
      
      '@opentelemetry/instrumentation-xml-http-request': {
        requestHook: (span, request) => {
          const event = this.createEventFromSpan(span, 'xhr')
          if (!this.Filter.shouldProcess(event, this.getCurrentUserContext())) {
            span.end()
            return
          }
          
          this.enrichSpanWithBusinessContext(span, request)
        }
      }
    })

    // Register the provider and instrumentations
    provider.register()
    instrumentations.forEach(instrumentation => {
      if ('enable' in instrumentation) {
        instrumentation.enable()
      }
    })
  }

  private setupExporters(): void {
    switch (this.config.platform.platform) {
      case 'datadog':
        const datadogExporter = new DatadogExporter()
        datadogExporter.configure(this.config.platform)
        this.exporters.push(datadogExporter)
        break
        
      case 'newrelic':
        const newrelicExporter = new NewRelicExporter()
        newrelicExporter.configure(this.config.platform)
        this.exporters.push(newrelicExporter)
        break
        
      case 'console':
      default:
        // Console exporter for development/demo
        this.exporters.push({
          name: 'console',
          configure: () => {},
          export: async (events) => {
            console.group(`[ObservMetrics] ${events.length} business events`)
            events.forEach(event => {
              const context = `[${event.domain}:${event.businessContext.businessImpact}]`
              console.log(`${context} ${event.name}`, event.attributes)
            })
            console.groupEnd()
          }
        })
    }
  }

  private initializeDomainInstrumentors(): void {
    this.config.domains.forEach(domain => {
      const instrumentor = new DomainInstrumentor(
        domain,
        this.getCurrentUserContext(),
        (event) => this.handleTelemetryEvent(event)
      )
      
      this.instrumentors.set(domain.name, instrumentor)
    })
  }

  /**
   * Get instrumentor for specific domain
   */
  getDomainInstrumentor(domainName: string): IDomainInstrumentor {
    const instrumentor = this.instrumentors.get(domainName)
    if (!instrumentor) {
      throw new Error(`Domain instrumentor not found: ${domainName}. Available domains: ${Array.from(this.instrumentors.keys()).join(', ')}`)
    }
    return instrumentor
  }

  /**
   * Convenience methods for common domains
   */
  auth(): IDomainInstrumentor {
    return this.getDomainInstrumentor('authentication') || this.getDomainInstrumentor('auth')
  }

  ecommerce(): IDomainInstrumentor {
    return this.getDomainInstrumentor('ecommerce') || this.getDomainInstrumentor('commerce')
  }

  content(): IDomainInstrumentor {
    return this.getDomainInstrumentor('content')
  }

  /**
   * Update user context (e.g., after login)
   */
  updateUserContext(newContext: Partial<UserContext>): void {
    this.config.userContext = { ...this.config.userContext, ...newContext }
    
    // Update all instrumentors with new context
    this.instrumentors.forEach(instrumentor => {
      // Recreate instrumentor with new context
      const domain = this.config.domains.find(d => d.name === instrumentor.getStats().domain)
      if (domain) {
        const newInstrumentor = new DomainInstrumentor(
          domain,
          this.getCurrentUserContext(),
          (event) => this.handleTelemetryEvent(event)
        )
        this.instrumentors.set(domain.name, newInstrumentor)
      }
    })
  }

  /**
   * Add custom filter at runtime
   */
  addFilter(filter: (event: TelemetryEvent, context: UserContext) => boolean): void {
    this.Filter.addCustomFilter(filter)
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      domains: Array.from(this.instrumentors.keys()),
      eventsProcessed: this.events.length,
      filterStats: this.Filter.getStats(),
      userContext: this.getCurrentUserContext(),
      exporters: this.exporters.map(e => e.name)
    }
  }

  private handleTelemetryEvent(event: TelemetryEvent): void {
    const userContext = this.getCurrentUserContext()
    
    // Apply  filtering
    if (!this.Filter.shouldProcess(event, userContext)) {
      if (this.config.debug) {
        console.log(`[ObservMetrics] Event filtered out: ${event.name}`)
      }
      return
    }

    // Store event
    this.events.push(event)
    
    // Export to configured platforms
    this.exporters.forEach(async (exporter) => {
      try {
        await exporter.export([event])
      } catch (error) {
        console.error(`[ObservMetrics] Export failed for ${exporter.name}:`, error)
      }
    })
  }

  private getCurrentUserContext(): UserContext {
    return {
      sessionId: `session_${Date.now()}`,
      userSegment: 'anonymous',
      isAuthenticated: false,
      deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      ...this.config.userContext
    }
  }

  private createEventFromSpan(span: any, type: string): TelemetryEvent {
    return {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      domain: 'unknown',
      eventType: 'span',
      name: span.name || type,
      attributes: span.attributes || {},
      businessContext: {
        domain: 'unknown',
        businessImpact: 'performance'
      }
    }
  }

  private enrichSpanWithBusinessContext(span: any, request: any): void {
    // Add business context based on URL patterns
    const url = request.url || request.requestURL || ''
    const domain = this.inferDomainFromUrl(url)
    
    if (domain) {
      span.setAttributes({
        'business.domain': domain.name,
        'business.priority': domain.priority,
        'business.sla_target': domain.slaTarget
      })
    }
  }

  private inferDomainFromUrl(url: string): DomainConfig | null {
    // Simple domain inference based on URL patterns
    if (url.includes('/auth/') || url.includes('/login') || url.includes('/register')) {
      return this.config.domains.find(d => d.name === 'authentication') || null
    }
    
    if (url.includes('/cart') || url.includes('/checkout') || url.includes('/payment')) {
      return this.config.domains.find(d => d.name === 'ecommerce') || null
    }
    
    if (url.includes('/search') || url.includes('/products') || url.includes('/content')) {
      return this.config.domains.find(d => d.name === 'content') || null
    }
    
    return null
  }

  private logConfiguration(): void {
    console.group('[ObservMetrics] Configuration')
    console.log('Domains:', this.config.domains.map(d => `${d.name} (${d.priority})`))
    console.log('Platform:', this.config.platform.platform)
    console.log('Filtering:', {
      botDetection: this.config.filtering.enableBotDetection,
      domainWhitelist: this.config.filtering.domainWhitelist,
      samplingRate: this.config.filtering.samplingRate
    })
    console.log('User Context:', this.getCurrentUserContext())
    console.groupEnd()
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.exporters.forEach(exporter => {
      if ('destroy' in exporter && typeof exporter.destroy === 'function') {
        exporter.destroy()
      }
    })
    
    this.instrumentors.clear()
    this.exporters = []
    this.events = []
    this.isInitialized = false
  }
}

// Re-export types and core classes
export { Filter, DomainInstrumentor, DatadogExporter, NewRelicExporter }
export type { 
  ObservMetricsConfig, 
  UserContext, 
  DomainConfig, 
  TelemetryEvent,
  BusinessContext,
  ApiCallContext,
  InstrumentationResult,
  FilterConfig,
  PlatformConfig
} from './types'

// Factory function for easy initialization
export function createObservMetrics(config: ObservMetricsConfig): ObservMetrics {
  return new ObservMetrics(config)
}

// Default configurations for common setups
export const defaultConfigs = {
  ecommerce: {
    domains: [
      {
        name: 'authentication',
        priority: 'critical' as const,
        slaTarget: 2000,
        errorThreshold: 0.1,
        features: ['login', 'register', 'profile']
      },
      {
        name: 'ecommerce',
        priority: 'critical' as const,
        slaTarget: 3000,
        errorThreshold: 0.05,
        features: ['cart', 'checkout', 'payment']
      },
      {
        name: 'content',
        priority: 'medium' as const,
        slaTarget: 2000,
        errorThreshold: 1.0,
        features: ['search', 'browse', 'recommendations']
      }
    ],
    filtering: {
      enableBotDetection: true,
      domainWhitelist: [typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost'],
      errorThreshold: 5.0,
      samplingRate: 1.0,
      excludeExtensions: true,
      excludeThirdPartyErrors: true
    }
  }
}