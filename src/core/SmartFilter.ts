/**
 *  filtering system to eliminate noise and focus on business-critical events
 * Solves the "signal vs noise" problem in frontend monitoring
 */

import type { TelemetryEvent, UserContext, FilterConfig, FilterFunction } from '../types'

export class Filter {
  private config: FilterConfig
  private botPatterns: RegExp[]
  private extensionPatterns: RegExp[]
  private noisePatterns: RegExp[]

  constructor(config: FilterConfig) {
    this.config = config
    this.initializePatterns()
  }

  private initializePatterns() {
    // Bot detection patterns
    this.botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /phantom/i, /headless/i, /selenium/i,
      /puppeteer/i, /playwright/i,
      /googlebot/i, /bingbot/i, /slurp/i,
      /facebookexternalhit/i, /twitterbot/i,
      /linkedinbot/i, /whatsapp/i, /telegrambot/i
    ]

    // Browser extension patterns
    this.extensionPatterns = [
      /chrome-extension:/i, /moz-extension:/i, /safari-extension:/i,
      /extension\//i, /addon/i, /greasemonkey/i,
      /tampermonkey/i, /adblock/i, /ublock/i,
      /ghostery/i, /privacy/i, /disconnect/i
    ]

    // Noise URL patterns  
    this.noisePatterns = [
      /\.css(\?|$)/, /\.js(\?|$)/, /\.png(\?|$)/, 
      /\.jpg(\?|$)/, /\.gif(\?|$)/, /\.svg(\?|$)/,
      /\.woff(\?|$)/, /\.ttf(\?|$)/, /\.ico(\?|$)/,
      /favicon/, /manifest\.json/, /robots\.txt/,
      /sw\.js/, /service-worker/, /workbox/
    ]
  }

  /**
   * Main filtering method - determines if event should be processed
   */
  shouldProcess(event: TelemetryEvent, context: UserContext): boolean {
    // Always process errors and critical events
    if (event.severity === 'error' || event.severity === 'critical') {
      return true
    }

    // Apply bot detection
    if (this.config.enableBotDetection && this.isBotSession(context)) {
      return false
    }

    // Apply domain whitelist
    if (!this.isDomainAllowed(event)) {
      return false
    }

    // Apply noise filtering
    if (this.isNoiseEvent(event)) {
      return false
    }

    // Apply extension filtering
    if (this.config.excludeExtensions && this.isExtensionEvent(event)) {
      return false
    }

    // Apply custom filters
    if (this.config.customFilters) {
      for (const filter of this.config.customFilters) {
        if (!filter(event, context)) {
          return false
        }
      }
    }

    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return false
    }

    return true
  }

  /**
   * Detect bot traffic using multiple signals
   */
  private isBotSession(context: UserContext): boolean {
    const userAgent = navigator.userAgent || ''
    
    // Check user agent patterns
    const hasBotPattern = this.botPatterns.some(pattern => pattern.test(userAgent))
    if (hasBotPattern) return true

    // Check for headless browser indicators
    if (this.hasHeadlessIndicators()) return true

    // Check for automation indicators
    if (this.hasAutomationIndicators()) return true

    // Check session characteristics
    if (this.hasUnusualSessionCharacteristics(context)) return true

    return false
  }

  private hasHeadlessIndicators(): boolean {
    // Check for headless browser detection
    if (typeof window === 'undefined') return false

    // Chrome headless detection
    if ((window as any).chrome && !(window as any).chrome.runtime) return true

    // PhantomJS detection
    if ((window as any).callPhantom || (window as any)._phantom) return true

    // Check for missing features typical in headless browsers
    if (!window.outerHeight || !window.outerWidth) return true

    // Check for webdriver property
    if ((navigator as any).webdriver) return true

    return false
  }

  private hasAutomationIndicators(): boolean {
    if (typeof window === 'undefined') return false

    // Selenium detection
    if ((window as any).document.$cdc_asdjflasutopfhvcZLmcfl_) return true
    if ((window as any).document.$chrome_asyncScriptInfo) return true

    // Puppeteer detection
    if ((navigator as any).permissions?.query?.toString().includes('NotSupportedError')) return true

    return false
  }

  private hasUnusualSessionCharacteristics(context: UserContext): boolean {
    // Very fast interactions (< 100ms between events)
    // This would be implemented with session tracking
    
    // No mouse movements or scrolling
    // This would require additional event tracking
    
    // Suspicious device characteristics
    if (screen.width === 0 || screen.height === 0) return true
    
    return false
  }

  /**
   * Check if domain is allowed
   */
  private isDomainAllowed(event: TelemetryEvent): boolean {
    if (!this.config.domainWhitelist || this.config.domainWhitelist.length === 0) return true

    const currentDomain = window.location.hostname
    return this.config.domainWhitelist.includes(currentDomain)
  }

  /**
   * Check if event is noise (static assets, etc.)
   */
  private isNoiseEvent(event: TelemetryEvent): boolean {
    const url = event.attributes['http.url'] || event.attributes['url'] || ''
    return this.noisePatterns.some(pattern => pattern.test(url))
  }

  /**
   * Check if event is from browser extension
   */
  private isExtensionEvent(event: TelemetryEvent): boolean {
    const url = event.attributes['http.url'] || event.attributes['url'] || ''
    const stack = event.attributes['error.stack'] || ''
    
    return this.extensionPatterns.some(pattern => 
      pattern.test(url) || pattern.test(stack)
    )
  }

  /**
   * Determine if current session represents a real user
   */
  isRealUserSession(context?: UserContext): boolean {
    if (typeof window === 'undefined') return false

    // Quick bot detection
    if (this.isBotSession(context || this.createDefaultContext())) return false

    // Check for real user indicators
    return this.hasRealUserIndicators()
  }

  private hasRealUserIndicators(): boolean {
    // Has touch capability (mobile users)
    if ('ontouchstart' in window) return true

    // Has made mouse movements (this would require tracking)
    // For now, assume real user if not detected as bot

    // Has proper viewport
    if (window.innerWidth > 0 && window.innerHeight > 0) return true

    // Has normal timezone
    const timezoneOffset = new Date().getTimezoneOffset()
    if (timezoneOffset >= -720 && timezoneOffset <= 720) return true

    return true
  }

  private createDefaultContext(): UserContext {
    return {
      sessionId: `session_${Date.now()}`,
      userSegment: 'anonymous',
      isAuthenticated: false,
      deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    }
  }

  /**
   * Get filtering statistics
   */
  getStats() {
    return {
      botPatternsCount: this.botPatterns.length,
      extensionPatternsCount: this.extensionPatterns.length,
      noisePatternsCount: this.noisePatterns.length,
      samplingRate: this.config.samplingRate,
      config: {
        enableBotDetection: this.config.enableBotDetection,
        domainWhitelist: this.config.domainWhitelist,
        excludeExtensions: this.config.excludeExtensions
      }
    }
  }

  /**
   * Add runtime custom filter
   */
  addCustomFilter(filter: FilterFunction) {
    if (!this.config.customFilters) {
      this.config.customFilters = []
    }
    this.config.customFilters.push(filter)
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FilterConfig>) {
    this.config = { ...this.config, ...newConfig }
    if (newConfig.samplingRate !== undefined || 
        newConfig.enableBotDetection !== undefined ||
        newConfig.excludeExtensions !== undefined) {
      this.initializePatterns()
    }
  }
}