/**
 * Unit tests for main ObservMetrics class
 */

import { ObservMetrics, createObservMetrics, defaultConfigs } from '../src/index'
import type { ObservMetricsConfig, UserContext } from '../src/types'

// Mock OpenTelemetry SDK
jest.mock('@opentelemetry/sdk-trace-web', () => ({
  WebTracerProvider: jest.fn().mockImplementation(() => ({
    register: jest.fn(),
    shutdown: jest.fn()
  }))
}))

jest.mock('@opentelemetry/auto-instrumentations-web', () => ({
  getWebAutoInstrumentations: jest.fn().mockReturnValue([])
}))

describe('ObservMetrics', () => {
  let mockConfig: ObservMetricsConfig
  let observMetrics: ObservMetrics

  beforeEach(() => {
    mockConfig = {
      userContext: {
        sessionId: 'test-session',
        userSegment: 'premium',
        isAuthenticated: true,
        deviceType: 'desktop'
      },
      domains: [
        {
          name: 'authentication',
          priority: 'critical',
          slaTarget: 2000,
          errorThreshold: 0.1,
          features: ['login', 'register']
        },
        {
          name: 'ecommerce',
          priority: 'critical',
          slaTarget: 3000,
          errorThreshold: 0.05,
          features: ['cart', 'checkout']
        }
      ],
      filtering: {
        enableBotDetection: true,
        excludeExtensions: true,
        samplingRate: 1.0,
        domainWhitelist: ['localhost']
      },
      platform: {
        platform: 'console'
      },
      debug: false
    }

    observMetrics = new ObservMetrics(mockConfig)
  })

  afterEach(() => {
    observMetrics.destroy()
  })

  describe('initialization', () => {
    it('should create instance with valid config', () => {
      expect(observMetrics).toBeInstanceOf(ObservMetrics)
      expect(observMetrics.getStats().initialized).toBe(false)
    })

    it('should initialize successfully for real user sessions', async () => {
      // Mock real user session
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })

      await observMetrics.initialize()
      expect(observMetrics.getStats().initialized).toBe(true)
    })

    it('should skip initialization for bot sessions', async () => {
      // Mock bot user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Googlebot/2.1',
        configurable: true
      })

      await observMetrics.initialize()
      expect(observMetrics.getStats().initialized).toBe(false)
    })

    it('should not initialize twice', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      // Mock real user session for both initializations
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      
      await observMetrics.initialize()
      await observMetrics.initialize()
      
      expect(consoleSpy).toHaveBeenCalledWith('[ObservMetrics] Already initialized')
      consoleSpy.mockRestore()
    })
  })

  describe('domain instrumentors', () => {
    beforeEach(async () => {
      // Mock real user session for initialization
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      await observMetrics.initialize()
    })

    it('should get domain instrumentor by name', () => {
      const authInstrumentor = observMetrics.getDomainInstrumentor('authentication')
      expect(authInstrumentor).toBeDefined()
    })

    it('should throw error for non-existent domain', () => {
      expect(() => {
        observMetrics.getDomainInstrumentor('non-existent')
      }).toThrow('Domain instrumentor not found: non-existent')
    })

    it('should provide convenience methods for common domains', () => {
      const authInstrumentor = observMetrics.auth()
      const ecommerceInstrumentor = observMetrics.ecommerce()
      
      expect(authInstrumentor).toBeDefined()
      expect(ecommerceInstrumentor).toBeDefined()
    })
  })

  describe('user context management', () => {
    beforeEach(async () => {
      // Mock real user session for initialization
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      await observMetrics.initialize()
    })

    it('should update user context', () => {
      const newContext: Partial<UserContext> = {
        userSegment: 'enterprise',
        isAuthenticated: true
      }

      observMetrics.updateUserContext(newContext)
      
      const stats = observMetrics.getStats()
      expect(stats.userContext.userSegment).toBe('enterprise')
      expect(stats.userContext.isAuthenticated).toBe(true)
    })

    it('should preserve existing context when updating', () => {
      const originalSessionId = observMetrics.getStats().userContext.sessionId
      
      observMetrics.updateUserContext({ userSegment: 'basic' })
      
      const stats = observMetrics.getStats()
      expect(stats.userContext.sessionId).toBe(originalSessionId || 'test-session')
      expect(stats.userContext.userSegment).toBe('basic')
    })
  })

  describe('filtering', () => {
    beforeEach(async () => {
      // Mock real user session for initialization
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      await observMetrics.initialize()
    })

    it('should add custom filters', () => {
      const customFilter = jest.fn().mockReturnValue(true)
      observMetrics.addFilter(customFilter)
      
      // Filter is added but we need to trigger an event to test it
      const stats = observMetrics.getStats()
      expect(stats).toBeDefined()
    })
  })

  describe('statistics and monitoring', () => {
    it('should return comprehensive stats', async () => {
      // Mock real user session and initialize
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      await observMetrics.initialize()
      const stats = observMetrics.getStats()
      
      expect(stats).toHaveProperty('initialized')
      expect(stats).toHaveProperty('domains')
      expect(stats).toHaveProperty('eventsProcessed')
      expect(stats).toHaveProperty('filterStats')
      expect(stats).toHaveProperty('userContext')
      expect(stats).toHaveProperty('exporters')
      
      expect(stats.eventsProcessed).toBe(0)
      expect(stats.exporters).toContain('console')
    })

    it('should track domain names', async () => {
      // Mock real user session for initialization
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      await observMetrics.initialize()
      const stats = observMetrics.getStats()
      
      expect(stats.domains).toContain('authentication')
      expect(stats.domains).toContain('ecommerce')
    })
  })

  describe('cleanup', () => {
    it('should clean up resources on destroy', async () => {
      // Mock real user session for initialization
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      await observMetrics.initialize()
      
      const statsBefore = observMetrics.getStats()
      expect(statsBefore.initialized).toBe(true)
      
      observMetrics.destroy()
      
      const statsAfter = observMetrics.getStats()
      expect(statsAfter.initialized).toBe(false)
      expect(statsAfter.eventsProcessed).toBe(0)
    })
  })

  describe('platform configurations', () => {
    it('should configure console exporter by default', () => {
      const stats = observMetrics.getStats()
      expect(stats.exporters).toContain('console')
    })

    it('should configure datadog exporter when specified', () => {
      const datadogConfig = {
        ...mockConfig,
        platform: {
          platform: 'datadog' as const,
          apiKey: 'test-key'
        }
      }
      
      const datadogObserv = new ObservMetrics(datadogConfig)
      const stats = datadogObserv.getStats()
      expect(stats.exporters).toContain('datadog')
      
      datadogObserv.destroy()
    })

    it('should configure newrelic exporter when specified', () => {
      const newrelicConfig = {
        ...mockConfig,
        platform: {
          platform: 'newrelic' as const,
          apiKey: 'test-key',
          accountId: 'test-account'
        }
      }
      
      const newrelicObserv = new ObservMetrics(newrelicConfig)
      const stats = newrelicObserv.getStats()
      expect(stats.exporters).toContain('newrelic')
      
      newrelicObserv.destroy()
    })
  })

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const errorConfig = {
        ...mockConfig,
        domains: [] // Invalid config
      }
      
      const errorObserv = new ObservMetrics(errorConfig)
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Should not throw but log error
      await expect(errorObserv.initialize()).resolves.not.toThrow()
      
      consoleSpy.mockRestore()
      errorObserv.destroy()
    })
  })
})

describe('Factory function', () => {
  it('should create ObservMetrics instance', () => {
    const config: ObservMetricsConfig = {
      userContext: {
        sessionId: 'test',
        userSegment: 'test',
        isAuthenticated: false,
        deviceType: 'desktop'
      },
      domains: [],
      filtering: {
        enableBotDetection: true,
        excludeExtensions: true,
        samplingRate: 1.0
      },
      platform: {
        platform: 'console'
      }
    }
    
    const instance = createObservMetrics(config)
    expect(instance).toBeInstanceOf(ObservMetrics)
    
    instance.destroy()
  })
})

describe('Default configurations', () => {
  it('should provide ecommerce default config', () => {
    const config = defaultConfigs.ecommerce
    
    expect(config).toHaveProperty('domains')
    expect(config).toHaveProperty('filtering')
    expect(config.domains).toHaveLength(3)
    
    const domainNames = config.domains.map(d => d.name)
    expect(domainNames).toContain('authentication')
    expect(domainNames).toContain('ecommerce')
    expect(domainNames).toContain('content')
  })

  it('should have valid domain configurations', () => {
    const config = defaultConfigs.ecommerce
    
    config.domains.forEach(domain => {
      expect(domain).toHaveProperty('name')
      expect(domain).toHaveProperty('priority')
      expect(domain).toHaveProperty('slaTarget')
      expect(domain).toHaveProperty('errorThreshold')
      expect(domain).toHaveProperty('features')
      
      expect(['critical', 'high', 'medium', 'low']).toContain(domain.priority)
      expect(domain.slaTarget).toBeGreaterThan(0)
      expect(domain.errorThreshold).toBeGreaterThan(0)
      expect(Array.isArray(domain.features)).toBe(true)
    })
  })
})