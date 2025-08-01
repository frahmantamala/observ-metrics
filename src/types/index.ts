/**
 * Core types for observ-metrics library
 */

export interface UserContext {
  userId?: string
  sessionId: string
  userSegment: string
  isAuthenticated: boolean
  deviceType: 'mobile' | 'tablet' | 'desktop'
  customAttributes?: Record<string, any>
}

export interface DomainConfig {
  name: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  slaTarget: number
  errorThreshold: number
  features: string[]
  customAttributes?: Record<string, any>
}

export interface FilterConfig {
  enableBotDetection: boolean
  domainWhitelist: string[]
  errorThreshold: number
  samplingRate: number
  excludeExtensions: boolean
  excludeThirdPartyErrors: boolean
  customFilters?: FilterFunction[]
}

export interface PlatformConfig {
  platform: 'datadog' | 'newrelic' | 'grafana' | 'jaeger' | 'console'
  endpoint?: string
  apiKey?: string
  customHeaders?: Record<string, string>
  batchSize?: number
  flushInterval?: number
}

export interface ObservMetricsConfig {
  userContext: Partial<UserContext>
  domains: DomainConfig[]
  filtering: FilterConfig
  platform: PlatformConfig
  debug?: boolean
}

export interface TelemetryEvent {
  id: string
  timestamp: string
  domain: string
  eventType: 'span' | 'metric' | 'log' | 'error'
  name: string
  attributes: Record<string, any>
  businessContext: BusinessContext
  severity?: 'info' | 'warn' | 'error' | 'critical'
}

export interface BusinessContext {
  domain: string
  feature?: string
  userJourney?: string
  businessImpact: 'revenue' | 'engagement' | 'performance' | 'reliability'
  customMetrics?: Record<string, number>
}

export interface ApiCallContext {
  endpoint: string
  method: string
  journeyName?: string
  stepName?: string
  customAttributes?: Record<string, any>
}

export interface UserJourneyStep {
  name: string
  startTime: number
  endTime?: number
  success?: boolean
  errorMessage?: string
  customAttributes?: Record<string, any>
}

export interface FilterFunction {
  (event: TelemetryEvent, context: UserContext): boolean
}

export interface ExporterPlugin {
  name: string
  export(events: TelemetryEvent[]): Promise<void>
  configure(config: PlatformConfig): void
}

export interface InstrumentationResult {
  success: boolean
  duration: number
  error?: Error
  customMetrics?: Record<string, number>
}

export interface DomainInstrumentor {
  instrumentApiCall(
    name: string,
    endpoint: string,
    method: string,
    context?: ApiCallContext
  ): Promise<InstrumentationResult>
  
  instrumentUserJourney(
    journeyName: string,
    stepName: string,
    operation: () => Promise<any>
  ): Promise<InstrumentationResult>
  
  recordBusinessMetric(
    metricName: string,
    value: number,
    context?: Record<string, any>
  ): void
  
  trackError(
    error: Error,
    context?: Record<string, any>
  ): void
}