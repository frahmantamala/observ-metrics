/**
 * Jest setup file for observ-metrics tests
 */

// Mock browser APIs
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  configurable: true
})

Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080
  },
  configurable: true
})

Object.defineProperty(window, 'location', {
  value: {
    hostname: 'localhost',
    href: 'http://localhost:3000'
  },
  configurable: true
})

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: jest.fn(() => Date.now()),
    timing: {},
    getEntriesByType: jest.fn(() => [])
  }
})

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}