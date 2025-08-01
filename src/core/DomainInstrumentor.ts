/**
 * Domain-driven instrumentation that adds business context to telemetry
 * Organizes monitoring by business domains rather than technical components
 */

import { trace, metrics, Span, Meter, Tracer } from '@opentelemetry/api'
import type { 
  DomainConfig, 
  UserContext, 
  BusinessContext, 
  ApiCallContext,
  InstrumentationResult,
  DomainInstrumentor as IDomainInstrumentor,
  TelemetryEvent
} from '../types'

export class DomainInstrumentor implements IDomainInstrumentor {
  private tracer: Tracer
  private meter: Meter
  private domainMetrics: Map<string, any> = new Map()

  constructor(
    private domain: DomainConfig,
    private userContext: UserContext,
    private onEvent?: (event: TelemetryEvent) => void
  ) {
    this.tracer = trace.getTracer(`observ-metrics-${domain.name}`)
    this.meter = metrics.getMeter(`observ-metrics-${domain.name}`)
    this.initializeMetrics()
  }

  private initializeMetrics() {
    // Create domain-specific counters
    this.domainMetrics.set('api_calls', this.meter.createCounter(`${this.domain.name}_api_calls_total`, {
      description: `Total API calls for ${this.domain.name} domain`
    }))

    this.domainMetrics.set('api_duration', this.meter.createHistogram(`${this.domain.name}_api_duration_ms`, {
      description: `API call duration for ${this.domain.name} domain`
    }))

    this.domainMetrics.set('errors', this.meter.createCounter(`${this.domain.name}_errors_total`, {
      description: `Total errors for ${this.domain.name} domain`
    }))

    this.domainMetrics.set('journey_steps', this.meter.createCounter(`${this.domain.name}_journey_steps_total`, {
      description: `Total journey steps for ${this.domain.name} domain`
    }))

    this.domainMetrics.set('journey_duration', this.meter.createHistogram(`${this.domain.name}_journey_duration_ms`, {
      description: `Journey step duration for ${this.domain.name} domain`
    }))

    this.domainMetrics.set('business_metrics', this.meter.createHistogram(`${this.domain.name}_business_metrics`, {
      description: `Business metrics for ${this.domain.name} domain`
    }))
  }

  /**
   * Instrument API calls with business context
   */
  async instrumentApiCall(
    name: string,
    endpoint: string,
    method: string = 'GET',
    context: ApiCallContext = {}
  ): Promise<InstrumentationResult> {
    const spanName = `${this.domain.name}.${name}`
    const span = this.tracer.startSpan(spanName)
    const startTime = Date.now()

    try {
      // Set comprehensive span attributes
      const attributes = {
        // Domain context
        'domain.name': this.domain.name,
        'domain.priority': this.domain.priority,
        'domain.sla_target_ms': this.domain.slaTarget,
        'domain.error_threshold': this.domain.errorThreshold,
        
        // API context
        'api.name': name,
        'http.method': method,
        'http.url': endpoint,
        
        // User context
        'user.session_id': this.userContext.sessionId,
        'user.segment': this.userContext.userSegment,
        'user.authenticated': this.userContext.isAuthenticated,
        'user.device_type': this.userContext.deviceType,
        
        // Journey context (if applicable)
        ...(context.journeyName && {
          'journey.name': context.journeyName,
          'journey.step': context.stepName || 'unknown'
        }),
        
        // Custom attributes
        ...context.customAttributes,
        ...this.domain.customAttributes
      }

      span.setAttributes(attributes)

      // Simulate API call (in real implementation, this would be actual HTTP call)
      const response = await this.executeApiCall(endpoint, method)
      const duration = Date.now() - startTime

      // Record metrics
      this.domainMetrics.get('api_calls')?.add(1, {
        domain: this.domain.name,
        api_name: name,
        method,
        status: response.status.toString(),
        user_segment: this.userContext.userSegment
      })

      this.domainMetrics.get('api_duration')?.record(duration, {
        domain: this.domain.name,
        api_name: name,
        method,
        user_segment: this.userContext.userSegment
      })

      // Check SLA violations
      const slaViolated = duration > this.domain.slaTarget
      if (slaViolated) {
        span.setAttributes({
          'sla.violated': true,
          'sla.target_ms': this.domain.slaTarget,
          'sla.actual_ms': duration,
          'sla.violation_severity': this.getSlaViolationSeverity(duration)
        })
      }

      // Set response attributes
      span.setAttributes({
        'http.status_code': response.status,
        'http.response_time_ms': duration,
        'api.success': response.success
      })

      // Emit telemetry event
      this.emitTelemetryEvent({
        eventType: 'span',
        name: spanName,
        attributes,
        businessContext: this.createBusinessContext(name, context),
        severity: slaViolated ? 'warn' : 'info'
      })

      return {
        success: true,
        duration,
        customMetrics: {
          sla_violated: slaViolated ? 1 : 0,
          response_status: response.status
        }
      }

    } catch (error: any) {
      const duration = Date.now() - startTime
      
      // Record error
      span.recordException(error)
      span.setStatus({ code: 2, message: error.message })
      
      // Record error metrics
      this.domainMetrics.get('errors')?.add(1, {
        domain: this.domain.name,
        api_name: name,
        error_type: error.name,
        user_segment: this.userContext.userSegment
      })

      // Emit error event
      this.emitTelemetryEvent({
        eventType: 'error',
        name: `${spanName}_error`,
        attributes: {
          'error.type': error.name,
          'error.message': error.message,
          'error.stack': error.stack
        },
        businessContext: this.createBusinessContext(name, context),
        severity: 'error'
      })

      return {
        success: false,
        duration,
        error,
        customMetrics: {
          error_occurred: 1
        }
      }

    } finally {
      span.end()
    }
  }

  /**
   * Instrument user journey steps with conversion tracking
   */
  async instrumentUserJourney(
    journeyName: string,
    stepName: string,
    operation: () => Promise<any>
  ): Promise<InstrumentationResult> {
    const spanName = `${this.domain.name}.journey.${journeyName}.${stepName}`
    const span = this.tracer.startSpan(spanName)
    const startTime = Date.now()

    try {
      const attributes = {
        'domain.name': this.domain.name,
        'journey.name': journeyName,
        'journey.step': stepName,
        'journey.step_number': this.getStepNumber(journeyName, stepName),
        'user.session_id': this.userContext.sessionId,
        'user.segment': this.userContext.userSegment,
        'conversion.tracking': true
      }

      span.setAttributes(attributes)

      const result = await operation()
      const duration = Date.now() - startTime

      // Record journey metrics
      this.domainMetrics.get('journey_steps')?.add(1, {
        domain: this.domain.name,
        journey: journeyName,
        step: stepName,
        success: 'true',
        user_segment: this.userContext.userSegment
      })

      this.domainMetrics.get('journey_duration')?.record(duration, {
        domain: this.domain.name,
        journey: journeyName,
        step: stepName,
        user_segment: this.userContext.userSegment
      })

      // Emit journey event
      this.emitTelemetryEvent({
        eventType: 'span',
        name: spanName,
        attributes,
        businessContext: {
          domain: this.domain.name,
          userJourney: journeyName,
          businessImpact: this.getJourneyBusinessImpact(journeyName)
        },
        severity: 'info'
      })

      return {
        success: true,
        duration,
        customMetrics: {
          journey_step_completed: 1,
          step_duration_ms: duration
        }
      }

    } catch (error: any) {
      const duration = Date.now() - startTime

      span.recordException(error)
      span.setStatus({ code: 2, message: error.message })

      // Record journey failure
      this.domainMetrics.get('journey_steps')?.add(1, {
        domain: this.domain.name,
        journey: journeyName,
        step: stepName,
        success: 'false',
        error_type: error.name,
        user_segment: this.userContext.userSegment
      })

      return {
        success: false,
        duration,
        error,
        customMetrics: {
          journey_step_failed: 1
        }
      }

    } finally {
      span.end()
    }
  }

  /**
   * Record business-specific metrics
   */
  recordBusinessMetric(
    metricName: string,
    value: number,
    context: Record<string, any> = {}
  ): void {
    const labels = {
      domain: this.domain.name,
      metric_name: metricName,
      user_segment: this.userContext.userSegment,
      ...context
    }

    this.domainMetrics.get('business_metrics')?.record(value, labels)

    // Emit business metric event
    this.emitTelemetryEvent({
      eventType: 'metric',
      name: `${this.domain.name}.business.${metricName}`,
      attributes: {
        'metric.name': metricName,
        'metric.value': value,
        ...labels
      },
      businessContext: {
        domain: this.domain.name,
        businessImpact: this.getMetricBusinessImpact(metricName)
      },
      severity: 'info'
    })
  }

  /**
   * Track errors with business context
   */
  trackError(error: Error, context: Record<string, any> = {}): void {
    const span = this.tracer.startSpan(`${this.domain.name}.error`)
    
    try {
      span.recordException(error)
      span.setAttributes({
        'domain.name': this.domain.name,
        'error.type': error.name,
        'error.message': error.message,
        'user.session_id': this.userContext.sessionId,
        ...context
      })

      // Record error metric
      this.domainMetrics.get('errors')?.add(1, {
        domain: this.domain.name,
        error_type: error.name,
        user_segment: this.userContext.userSegment
      })

      // Emit error event
      this.emitTelemetryEvent({
        eventType: 'error',
        name: `${this.domain.name}.error`,
        attributes: {
          'error.type': error.name,
          'error.message': error.message,
          'error.stack': error.stack,
          ...context
        },
        businessContext: {
          domain: this.domain.name,
          businessImpact: 'reliability'
        },
        severity: 'error'
      })

    } finally {
      span.end()
    }
  }

  // Helper methods
  private async executeApiCall(endpoint: string, method: string) {
    // Simulate realistic API behavior based on domain priority
    const baseLatency = this.domain.priority === 'critical' ? 100 : 200
    const jitter = Math.random() * 300
    const duration = baseLatency + jitter

    await new Promise(resolve => setTimeout(resolve, duration))

    // Simulate errors based on domain error threshold
    if (Math.random() < this.domain.errorThreshold) {
      throw new Error(`API call failed: ${endpoint}`)
    }

    return {
      status: 200,
      success: true,
      data: { message: 'Success' }
    }
  }

  private createBusinessContext(apiName: string, context: ApiCallContext): BusinessContext {
    return {
      domain: this.domain.name,
      feature: apiName,
      userJourney: context.journeyName,
      businessImpact: this.getApiBusinessImpact(apiName)
    }
  }

  private getApiBusinessImpact(apiName: string): BusinessContext['businessImpact'] {
    // Map API names to business impact
    const impactMap: Record<string, BusinessContext['businessImpact']> = {
      'login': 'engagement',
      'register': 'engagement', 
      'checkout': 'revenue',
      'payment': 'revenue',
      'search': 'engagement',
      'cart': 'revenue'
    }

    return impactMap[apiName] || 'performance'
  }

  private getJourneyBusinessImpact(journeyName: string): BusinessContext['businessImpact'] {
    const impactMap: Record<string, BusinessContext['businessImpact']> = {
      'user_login_flow': 'engagement',
      'purchase_flow': 'revenue',
      'product_discovery': 'engagement'
    }

    return impactMap[journeyName] || 'engagement'
  }

  private getMetricBusinessImpact(metricName: string): BusinessContext['businessImpact'] {
    if (metricName.includes('revenue') || metricName.includes('purchase')) return 'revenue'
    if (metricName.includes('login') || metricName.includes('engagement')) return 'engagement'
    if (metricName.includes('latency') || metricName.includes('performance')) return 'performance'
    return 'reliability'
  }

  private getSlaViolationSeverity(duration: number): string {
    const ratio = duration / this.domain.slaTarget
    if (ratio > 3) return 'critical'
    if (ratio > 2) return 'high'
    if (ratio > 1.5) return 'medium'
    return 'low'
  }

  private getStepNumber(journeyName: string, stepName: string): number {
    // This would be configurable in a real implementation
    const journeySteps: Record<string, string[]> = {
      'user_login_flow': ['load_login_page', 'enter_credentials', 'submit_login', 'redirect_dashboard'],
      'purchase_flow': ['add_to_cart', 'view_cart', 'enter_shipping', 'select_payment', 'complete_purchase'],
      'product_discovery': ['search_query', 'view_results', 'filter_results', 'select_product']
    }

    const steps = journeySteps[journeyName] || []
    return steps.indexOf(stepName) + 1
  }

  private emitTelemetryEvent(eventData: Partial<TelemetryEvent>): void {
    if (this.onEvent) {
      const event: TelemetryEvent = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        domain: this.domain.name,
        eventType: 'span',
        name: '',
        attributes: {},
        businessContext: {
          domain: this.domain.name,
          businessImpact: 'performance'
        },
        ...eventData
      }
      
      this.onEvent(event)
    }
  }

  /**
   * Get domain-specific statistics
   */
  getStats() {
    return {
      domain: this.domain.name,
      priority: this.domain.priority,
      slaTarget: this.domain.slaTarget,
      errorThreshold: this.domain.errorThreshold,
      features: this.domain.features,
      userContext: {
        segment: this.userContext.userSegment,
        authenticated: this.userContext.isAuthenticated,
        deviceType: this.userContext.deviceType
      }
    }
  }
}