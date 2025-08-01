/**
 * observ-metrics Nuxt 3 Plugin
 * Initializes  frontend monitoring with business context
 */

import { createObservMetrics, defaultConfigs } from 'observ-metrics'
import type { ObservMetrics } from 'observ-metrics'

export default defineNuxtPlugin(async (nuxtApp) => {
  // Only run on client-side
  if (process.server) return

  const config = useRuntimeConfig()
  
  // Initialize observ-metrics with environment-specific configuration
  const monitoring = createObservMetrics({
    userContext: {
      userSegment: 'anonymous',
      isAuthenticated: false,
      deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      customAttributes: {
        app_version: config.public.appVersion,
        environment: config.public.environment,
        framework: 'nuxt3'
      }
    },
    
    // Use pre-configured e-commerce domains
    domains: [
      {
        name: 'authentication',
        priority: 'critical' as const,
        slaTarget: 2000, // 2 seconds for auth operations
        errorThreshold: 0.1, // 0.1% error rate threshold
        features: ['login', 'register', 'logout', 'profile'],
        customAttributes: {
          business_critical: true,
          compliance_required: true
        }
      },
      {
        name: 'ecommerce',
        priority: 'critical' as const,
        slaTarget: 3000, // 3 seconds for e-commerce operations
        errorThreshold: 0.05, // 0.05% error rate threshold  
        features: ['cart', 'checkout', 'payment', 'inventory', 'orders'],
        customAttributes: {
          revenue_impact: true,
          conversion_tracking: true
        }
      },
      {
        name: 'content',
        priority: 'medium' as const,
        slaTarget: 2000, // 2 seconds for content operations
        errorThreshold: 1.0, // 1% error rate threshold
        features: ['search', 'browse', 'recommendations', 'reviews'],
        customAttributes: {
          engagement_tracking: true,
          seo_impact: true
        }
      }
    ],
    
    //  filtering configuration
    filtering: {
      enableBotDetection: true,
      domainWhitelist: [
        window.location.hostname,
        'localhost',
        '127.0.0.1'
      ],
      errorThreshold: 5.0, // 5% error rate before filtering kicks in
      samplingRate: config.public.isDev ? 1.0 : 0.8, // 100% in dev, 80% in prod
      excludeExtensions: true,
      excludeThirdPartyErrors: true,
      
      // Custom filters for Nuxt-specific scenarios
      customFilters: [
        // Filter out Nuxt hydration mismatches in development
        (event, context) => {
          if (config.public.isDev && event.attributes?.['error.message']?.includes('hydration')) {
            return false
          }
          return true
        },
        
        // Only track authenticated user checkout events in production
        (event, context) => {
          if (!config.public.isDev && 
              event.domain === 'ecommerce' && 
              event.name.includes('checkout') && 
              !context.isAuthenticated) {
            return false
          }
          return true
        }
      ]
    },
    
    // Platform configuration based on environment
    platform: (() => {
      const platform = config.public.monitoringPlatform
      
      switch (platform) {
        case 'datadog':
          return {
            platform: 'datadog' as const,
            apiKey: config.public.isDev ? undefined : config.datadogApiKey, // Server-side only in prod
            endpoint: 'https://api.datadoghq.com/api/v1/logs',
            customHeaders: {
              'DD-API-KEY': config.public.isDev ? 'dev-key' : config.datadogApiKey
            },
            batchSize: 100,
            flushInterval: 5000
          }
          
        case 'newrelic':
          return {
            platform: 'newrelic' as const,
            apiKey: config.public.isDev ? undefined : config.newrelicApiKey,
            endpoint: 'https://insights-collector.newrelic.com',
            batchSize: 50,
            flushInterval: 10000
          }
          
        case 'console':
        default:
          return {
            platform: 'console' as const,
            batchSize: 10,
            flushInterval: 2000
          }
      }
    })(),
    
    debug: config.public.isDev
  })

  try {
    // Initialize monitoring (will automatically filter out bots)
    await monitoring.initialize()
    
    if (config.public.isDev) {
      console.log('observ-metrics initialized successfully')
      console.log('Monitoring configuration:', {
        platform: config.public.monitoringPlatform,
        domains: monitoring.getStats().domains,
        userContext: monitoring.getStats().userContext
      })
    }
    
    // Track successful initialization
    monitoring.content().recordBusinessMetric(
      'app_initialization_success',
      1,
      {
        framework: 'nuxt3',
        monitoring_platform: config.public.monitoringPlatform,
        environment: config.public.environment
      }
    )
    
  } catch (error) {
    // Handle initialization errors gracefully
    console.error('Failed to initialize observ-metrics:', error)
    
    // Create a mock monitoring object for development continuity
    if (config.public.isDev) {
      const mockMonitoring = {
        auth: () => ({
          instrumentUserJourney: async () => ({ success: true }),
          instrumentApiCall: async () => ({ success: true }),
          recordBusinessMetric: () => {},
          trackError: (error: Error) => console.error('[Mock] Error tracked:', error)
        }),
        ecommerce: () => ({
          instrumentUserJourney: async () => ({ success: true }),
          instrumentApiCall: async () => ({ success: true }),
          recordBusinessMetric: () => {},
          trackError: (error: Error) => console.error('[Mock] Error tracked:', error)
        }),
        content: () => ({
          instrumentUserJourney: async () => ({ success: true }),
          instrumentApiCall: async () => ({ success: true }),
          recordBusinessMetric: () => {},
          trackError: (error: Error) => console.error('[Mock] Error tracked:', error)
        }),
        updateUserContext: () => {},
        getStats: () => ({ initialized: false, error: error.message })
      }
      
      // Provide mock monitoring for development
      nuxtApp.provide('observMetrics', mockMonitoring)
      return
    }
    
    throw error
  }

  // Make monitoring available throughout the Nuxt app
  nuxtApp.provide('observMetrics', monitoring)
  
  // Add global error handler for unhandled errors
  nuxtApp.hook('app:error', (error) => {
    try {
      // Determine which domain this error belongs to based on the route
      const route = useRoute()
      let domain = 'content' // default
      
      if (route.path.includes('/auth') || route.path.includes('/login')) {
        domain = 'authentication'
      } else if (route.path.includes('/cart') || route.path.includes('/checkout')) {
        domain = 'ecommerce'
      }
      
      // Track the error with business context
      monitoring.getDomainInstrumentor(domain).trackError(error, {
        route: route.path,
        component: 'nuxt_app',
        error_boundary: 'global',
        user_agent: navigator.userAgent
      })
      
    } catch (trackingError) {
      // Don't let monitoring errors break the app
      console.error('Failed to track error:', trackingError)
    }
  })
  
  // Add route change tracking
  nuxtApp.hook('page:finish', () => {
    try {
      const route = useRoute()
      
      // Track page views with business context
      monitoring.content().instrumentApiCall(
        'page_view',
        route.path,
        'GET',
        {
          customAttributes: {
            route_name: route.name,
            route_params: JSON.stringify(route.params),
            referrer: document.referrer || 'direct'
          }
        }
      )
      
    } catch (error) {
      console.error('Failed to track page view:', error)
    }
  })
  
  // Performance monitoring for Core Web Vitals
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      // Track Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        
        monitoring.content().recordBusinessMetric(
          'largest_contentful_paint',
          lastEntry.renderTime || lastEntry.loadTime,
          {
            metric_type: 'core_web_vital',
            performance_impact: lastEntry.renderTime > 2500 ? 'poor' : 'good'
          }
        )
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
      
      // Track Cumulative Layout Shift (CLS)
      const clsObserver = new PerformanceObserver((list) => {
        let clsValue = 0
        list.getEntries().forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        })
        
        if (clsValue > 0) {
          monitoring.content().recordBusinessMetric(
            'cumulative_layout_shift',
            clsValue,
            {
              metric_type: 'core_web_vital',
              performance_impact: clsValue > 0.1 ? 'poor' : 'good'
            }
          )
        }
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      
    } catch (error) {
      console.warn('Performance monitoring setup failed:', error)
    }
  }
  
  if (config.public.isDev) {
    console.log('observ-metrics Nuxt plugin loaded successfully')
  }
})