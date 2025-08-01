/**
 * Unit tests for SmartFilter class
 */

import { Filter } from '../../src/core/SmartFilter'
import type { TelemetryEvent, UserContext, FilterConfig } from '../../src/types'

describe('SmartFilter', () => {
  let filter: Filter
  let mockEvent: TelemetryEvent
  let mockContext: UserContext

  beforeEach(() => {
    const config: FilterConfig = {
      enableBotDetection: true,
      excludeExtensions: true,
      samplingRate: 1.0,
      domainWhitelist: ['localhost']
    }
    
    filter = new Filter(config)
    
    mockEvent = {
      name: 'test-event',
      timestamp: Date.now(),
      severity: 'info',
      attributes: {
        'http.url': 'http://localhost:3000/test'
      }
    }

    mockContext = {
      sessionId: 'test-session',
      userSegment: 'premium',
      isAuthenticated: true,
      deviceType: 'desktop'
    }
  })

  describe('shouldProcess', () => {
    it('should always process error events', () => {
      const errorEvent = { ...mockEvent, severity: 'error' as const }
      const result = filter.shouldProcess(errorEvent, mockContext)
      expect(result).toBe(true)
    })

    it('should always process critical events', () => {
      const criticalEvent = { ...mockEvent, severity: 'critical' as const }
      const result = filter.shouldProcess(criticalEvent, mockContext)
      expect(result).toBe(true)
    })

    it('should process normal events when all filters pass', () => {
      const result = filter.shouldProcess(mockEvent, mockContext)
      expect(result).toBe(true)
    })

    it('should reject events from disallowed domains', () => {
      const config: FilterConfig = {
        enableBotDetection: false,
        excludeExtensions: false,
        samplingRate: 1.0,
        domainWhitelist: ['example.com']
      }
      const restrictiveFilter = new Filter(config)
      
      const result = restrictiveFilter.shouldProcess(mockEvent, mockContext)
      expect(result).toBe(false)
    })

    it('should reject noise events (static assets)', () => {
      const noiseEvent = {
        ...mockEvent,
        attributes: {
          'http.url': 'http://localhost:3000/assets/style.css'
        }
      }
      
      const result = filter.shouldProcess(noiseEvent, mockContext)
      expect(result).toBe(false)
    })

    it('should reject extension events when configured', () => {
      const extensionEvent = {
        ...mockEvent,
        attributes: {
          'http.url': 'chrome-extension://abc123/content.js'
        }
      }
      
      const result = filter.shouldProcess(extensionEvent, mockContext)
      expect(result).toBe(false)
    })

    it('should apply custom filters', () => {
      const customFilter = jest.fn().mockReturnValue(false)
      const config: FilterConfig = {
        enableBotDetection: false,
        excludeExtensions: false,
        samplingRate: 1.0,
        customFilters: [customFilter]
      }
      const customFilterInstance = new Filter(config)
      
      const result = customFilterInstance.shouldProcess(mockEvent, mockContext)
      expect(result).toBe(false)
      expect(customFilter).toHaveBeenCalledWith(mockEvent, mockContext)
    })

    it('should apply sampling rate', () => {
      const config: FilterConfig = {
        enableBotDetection: false,
        excludeExtensions: false,
        samplingRate: 0.0, // No events should pass
        domainWhitelist: ['localhost']
      }
      const samplingFilter = new Filter(config)
      
      const result = samplingFilter.shouldProcess(mockEvent, mockContext)
      expect(result).toBe(false)
    })
  })

  describe('bot detection', () => {
    it('should detect bot user agents', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Googlebot/2.1',
        configurable: true
      })
      
      const result = filter.isRealUserSession(mockContext)
      expect(result).toBe(false)
    })

    it('should detect headless browsers', () => {
      Object.defineProperty(navigator, 'webdriver', {
        value: true,
        configurable: true
      })
      
      const result = filter.isRealUserSession(mockContext)
      expect(result).toBe(false)
    })

    it('should detect real user sessions', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      })
      Object.defineProperty(navigator, 'webdriver', {
        value: undefined,
        configurable: true
      })
      
      const result = filter.isRealUserSession(mockContext)
      expect(result).toBe(true)
    })
  })

  describe('noise filtering', () => {
    const noiseUrls = [
      'http://localhost:3000/style.css',
      'http://localhost:3000/script.js',
      'http://localhost:3000/image.png',
      'http://localhost:3000/favicon.ico',
      'http://localhost:3000/manifest.json'
    ]

    noiseUrls.forEach(url => {
      it(`should filter noise URL: ${url}`, () => {
        const noiseEvent = {
          ...mockEvent,
          attributes: { 'http.url': url }
        }
        
        const result = filter.shouldProcess(noiseEvent, mockContext)
        expect(result).toBe(false)
      })
    })
  })

  describe('extension filtering', () => {
    const extensionUrls = [
      'chrome-extension://abc123/content.js',
      'moz-extension://def456/popup.html',
      'safari-extension://ghi789/inject.js'
    ]

    extensionUrls.forEach(url => {
      it(`should filter extension URL: ${url}`, () => {
        const extensionEvent = {
          ...mockEvent,
          attributes: { 'http.url': url }
        }
        
        const result = filter.shouldProcess(extensionEvent, mockContext)
        expect(result).toBe(false)
      })
    })
  })

  describe('configuration management', () => {
    it('should return filtering statistics', () => {
      const stats = filter.getStats()
      
      expect(stats).toHaveProperty('botPatternsCount')
      expect(stats).toHaveProperty('extensionPatternsCount')
      expect(stats).toHaveProperty('noisePatternsCount')
      expect(stats).toHaveProperty('samplingRate')
      expect(stats).toHaveProperty('config')
      expect(stats.samplingRate).toBe(1.0)
    })

    it('should add custom filters at runtime', () => {
      const customFilter = jest.fn().mockReturnValue(true)
      filter.addCustomFilter(customFilter)
      
      filter.shouldProcess(mockEvent, mockContext)
      expect(customFilter).toHaveBeenCalled()
    })

    it('should update configuration', () => {
      filter.updateConfig({ samplingRate: 0.5 })
      const stats = filter.getStats()
      expect(stats.samplingRate).toBe(0.5)
    })
  })

  describe('edge cases', () => {
    it('should handle missing window object', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window
      
      const result = filter.isRealUserSession(mockContext)
      expect(result).toBe(false)
      
      global.window = originalWindow
    })

    it('should handle events without URLs', () => {
      const eventWithoutUrl = {
        ...mockEvent,
        attributes: {}
      }
      
      const result = filter.shouldProcess(eventWithoutUrl, mockContext)
      expect(result).toBe(true)
    })

    it('should handle empty domain whitelist', () => {
      const config: FilterConfig = {
        enableBotDetection: false,
        excludeExtensions: false,
        samplingRate: 1.0,
        domainWhitelist: []
      }
      const permissiveFilter = new Filter(config)
      
      const result = permissiveFilter.shouldProcess(mockEvent, mockContext)
      expect(result).toBe(true)
    })
  })
})