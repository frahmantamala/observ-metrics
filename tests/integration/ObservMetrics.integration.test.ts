/**
 * Integration tests for ObservMetrics library
 */

import { createObservMetrics, defaultConfigs } from '../../src/index'
import type { ObservMetricsConfig } from '../../src/types'

// Mock OpenTelemetry SDK for integration tests
jest.mock('@opentelemetry/sdk-trace-web', () => ({
  WebTracerProvider: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    shutdown: jest.fn()
  }))
}))

jest.mock('@opentelemetry/auto-instrumentations-web', () => ({
  getWebAutoInstrumentations: jest.fn().mockReturnValue([
    { enable: jest.fn() }
  ])
}))

describe('ObservMetrics Integration Tests', () => {
  let mockConfig: ObservMetricsConfig

  beforeEach(() => {
    // Use default ecommerce config as base
    mockConfig = {
      userContext: {
        sessionId: 'integration-test-session',
        userSegment: 'test-user',
        isAuthenticated: false,
        deviceType: 'desktop'
      },
      domains: defaultConfigs.ecommerce.domains,
      filtering: defaultConfigs.ecommerce.filtering,
      platform: {
        platform: 'console'
      },
      debug: true
    }

    // Mock console methods to capture logs
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'group').mockImplementation()
    jest.spyOn(console, 'groupEnd').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    jest.spyOn(console, 'error').mockImplementation()

    // Mock real user session
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      configurable: true
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Complete E-commerce Flow', () => {
    it('should handle complete user purchase journey', async () => {
      const observMetrics = createObservMetrics(mockConfig)
      
      try {
        // Initialize monitoring
        await observMetrics.initialize()
        expect(observMetrics.getStats().initialized).toBe(true)

        // Update user context after login
        observMetrics.updateUserContext({
          isAuthenticated: true,
          userSegment: 'premium'
        })

        // 1. Authentication flow
        const authInstrumentor = observMetrics.auth()
        await authInstrumentor.instrumentUserJourney(
          'user_login_flow',
          'submit_login',
          async () => {
            await authInstrumentor.instrumentApiCall(
              'login',
              '/api/auth/login',
              'POST'
            )
            return { success: true }
          }
        )

        // 2. Product browsing
        const contentInstrumentor = observMetrics.content()
        await contentInstrumentor.instrumentApiCall(
          'search',
          '/api/products/search',
          'GET',
          {
            journeyName: 'product_discovery',
            stepName: 'search_products',
            customAttributes: {
              search_query: 'laptop',
              category: 'electronics'
            }
          }
        )

        // 3. E-commerce flow
        const ecommerceInstrumentor = observMetrics.ecommerce()
        
        // Add to cart
        const addToCartResult = await ecommerceInstrumentor.instrumentApiCall(
          'add_to_cart',
          '/api/cart/add',
          'POST',
          {
            journeyName: 'purchase_flow',
            stepName: 'add_items',
            customAttributes: {
              product_id: 'laptop-123',
              quantity: 1,
              price: 999.99
            }
          }
        )
        expect(addToCartResult.success).toBe(true)

        // Record business metrics
        ecommerceInstrumentor.recordBusinessMetric('cart_value', 999.99, {
          currency: 'USD',
          items_count: 1
        })

        // Complete purchase journey
        await ecommerceInstrumentor.instrumentUserJourney(
          'purchase_flow',
          'checkout',
          async () => {
            const checkoutResult = await ecommerceInstrumentor.instrumentApiCall(
              'checkout',
              '/api/checkout',
              'POST'
            )
            
            if (checkoutResult.success) {
              ecommerceInstrumentor.recordBusinessMetric('purchase_completed', 1, {
                revenue: 999.99,
                payment_method: 'credit_card'
              })
            }
            
            return checkoutResult
          }
        )

        // Verify comprehensive statistics
        const stats = observMetrics.getStats()
        expect(stats.domains).toContain('authentication')
        expect(stats.domains).toContain('ecommerce')
        expect(stats.domains).toContain('content')
        expect(stats.userContext.isAuthenticated).toBe(true)
        expect(stats.userContext.userSegment).toBe('premium')

      } finally {
        observMetrics.destroy()
      }
    })

    it('should handle error scenarios gracefully', async () => {
      const observMetrics = createObservMetrics(mockConfig)
      
      try {
        await observMetrics.initialize()

        const ecommerceInstrumentor = observMetrics.ecommerce()

        // Test API call failure
        const mockError = new Error('Payment processing failed')
        ecommerceInstrumentor.trackError(mockError, {
          payment_method: 'credit_card',
          amount: 199.99,
          transaction_id: 'tx-123'
        })

        // Test journey step failure
        const journeyResult = await ecommerceInstrumentor.instrumentUserJourney(
          'purchase_flow',
          'payment_processing',
          async () => {
            throw new Error('Payment gateway timeout')
          }
        )

        expect(journeyResult.success).toBe(false)
        expect(journeyResult.error).toBeInstanceOf(Error)
        expect(journeyResult.customMetrics?.journey_step_failed).toBe(1)

      } finally {
        observMetrics.destroy()
      }
    })
  })

  describe('Platform Integration Tests', () => {
    it('should work with Datadog configuration', async () => {
      const datadogConfig = {
        ...mockConfig,
        platform: {
          platform: 'datadog' as const,
          apiKey: 'test-datadog-key'
        }
      }

      const observMetrics = createObservMetrics(datadogConfig)
      
      try {
        await observMetrics.initialize()
        
        const stats = observMetrics.getStats()
        expect(stats.exporters).toContain('datadog')

      } finally {
        observMetrics.destroy()
      }
    })

    it('should work with New Relic configuration', async () => {
      const newrelicConfig = {
        ...mockConfig,
        platform: {
          platform: 'newrelic' as const,
          apiKey: 'test-newrelic-key',
          accountId: 'test-account'
        }
      }

      const observMetrics = createObservMetrics(newrelicConfig)
      
      try {
        await observMetrics.initialize()
        
        const stats = observMetrics.getStats()
        expect(stats.exporters).toContain('newrelic')

      } finally {
        observMetrics.destroy()
      }
    })
  })

  describe('Filtering Integration', () => {
    it('should apply smart filtering across entire flow', async () => {
      const observMetrics = createObservMetrics(mockConfig)
      
      try {
        await observMetrics.initialize()

        // Add custom filter
        let customFilterCalled = false
        observMetrics.addFilter((event, context) => {
          customFilterCalled = true
          return !event.name.includes('filtered_out')
        })

        const ecommerceInstrumentor = observMetrics.ecommerce()

        // This should be processed
        await ecommerceInstrumentor.instrumentApiCall(
          'valid_api',
          '/api/cart/add',
          'POST'
        )

        // This should be filtered out
        await ecommerceInstrumentor.instrumentApiCall(
          'filtered_out_api',
          '/api/cart/add',
          'POST'
        )

        expect(customFilterCalled).toBe(true)

      } finally {
        observMetrics.destroy()
      }
    })

    it('should filter bot traffic', async () => {
      // Mock bot user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
        configurable: true
      })

      const observMetrics = createObservMetrics(mockConfig)
      
      try {
        await observMetrics.initialize()
        
        // Should not initialize for bot traffic
        expect(observMetrics.getStats().initialized).toBe(false)

      } finally {
        observMetrics.destroy()
      }
    })
  })

  describe('Performance and Reliability', () => {
    it('should handle concurrent operations', async () => {
      const observMetrics = createObservMetrics(mockConfig)
      
      try {
        await observMetrics.initialize()

        const ecommerceInstrumentor = observMetrics.ecommerce()

        // Run multiple concurrent operations
        const operations = Array.from({ length: 10 }, (_, i) =>
          ecommerceInstrumentor.instrumentApiCall(
            `concurrent_api_${i}`,
            `/api/test/${i}`,
            'GET'
          )
        )

        const results = await Promise.all(operations)
        
        // All operations should complete
        expect(results).toHaveLength(10)
        results.forEach(result => {
          expect(result).toHaveProperty('success')
          expect(result).toHaveProperty('duration')
        })

      } finally {
        observMetrics.destroy()
      }
    })

    it('should cleanup resources properly', async () => {
      const observMetrics = createObservMetrics(mockConfig)
      
      await observMetrics.initialize()
      
      const statsBefore = observMetrics.getStats()
      expect(statsBefore.initialized).toBe(true)
      expect(statsBefore.domains.length).toBeGreaterThan(0)

      // Cleanup
      observMetrics.destroy()

      const statsAfter = observMetrics.getStats()
      expect(statsAfter.initialized).toBe(false)
      expect(statsAfter.eventsProcessed).toBe(0)
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle typical SaaS application flow', async () => {
      const saasConfig = {
        ...mockConfig,
        domains: [
          {
            name: 'authentication',
            priority: 'critical' as const,
            slaTarget: 1000,
            errorThreshold: 0.01,
            features: ['login', 'sso', 'mfa']
          },
          {
            name: 'dashboard',
            priority: 'high' as const,
            slaTarget: 2000,
            errorThreshold: 0.1,
            features: ['analytics', 'reports', 'widgets']
          }
        ]
      }

      const observMetrics = createObservMetrics(saasConfig)
      
      try {
        await observMetrics.initialize()

        // Login flow
        const authInstrumentor = observMetrics.auth()
        await authInstrumentor.instrumentApiCall('sso_login', '/api/auth/sso', 'POST')

        // Dashboard loading
        const dashboardInstrumentor = observMetrics.getDomainInstrumentor('dashboard')
        await dashboardInstrumentor.instrumentApiCall('load_dashboard', '/api/dashboard', 'GET')

        // Record usage metrics
        dashboardInstrumentor.recordBusinessMetric('daily_active_users', 1)
        dashboardInstrumentor.recordBusinessMetric('feature_usage', 1, {
          feature: 'analytics_widget'
        })

        const stats = observMetrics.getStats()
        expect(stats.domains).toContain('authentication')
        expect(stats.domains).toContain('dashboard')

      } finally {
        observMetrics.destroy()
      }
    })
  })
})