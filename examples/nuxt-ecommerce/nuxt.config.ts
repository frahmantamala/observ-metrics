export default defineNuxtConfig({
  // Modern Nuxt 3 configuration for observ-metrics demo
  devtools: { enabled: true },
  
  // Styling
  css: ['~/assets/css/main.css'],
  
  // Modules
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt'
  ],
  
  // Runtime config
  runtimeConfig: {
    // Private keys (only available on server-side)
    datadogApiKey: process.env.DATADOG_API_KEY,
    newrelicApiKey: process.env.NEWRELIC_API_KEY,
    
    // Public keys (exposed to client-side)
    public: {
      isDev: process.env.NODE_ENV === 'development',
      monitoringPlatform: process.env.MONITORING_PLATFORM || 'console',
      appVersion: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    }
  },
  
  // App configuration
  app: {
    head: {
      title: 'Nuxt E-commerce Demo - observ-metrics',
      htmlAttrs: {
        lang: 'en'
      },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { 
          name: 'description', 
          content: 'Modern Nuxt 3 e-commerce application demonstrating  frontend monitoring with observ-metrics library' 
        },
        { name: 'format-detection', content: 'telephone=no' },
        
        // Open Graph
        { property: 'og:title', content: 'Nuxt E-commerce Demo - observ-metrics' },
        { property: 'og:description', content: ' frontend monitoring that eliminates noise and adds business context' },
        { property: 'og:type', content: 'website' },
        
        // Twitter Card
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'observ-metrics -  Frontend Monitoring' },
        { name: 'twitter:description', content: 'Eliminate monitoring noise, add business context' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },
  
  // Build configuration
  build: {
    transpile: ['observ-metrics'] // Ensure our library is transpiled
  },
  
  // Vite configuration
  vite: {
    define: {
      // Define global constants
      __OBSERV_METRICS_VERSION__: JSON.stringify('1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    },
    optimizeDeps: {
      include: ['observ-metrics'] // Optimize our library for dev
    }
  },
  
  // Server-side rendering
  ssr: true,
  
  // Experimental features
  experimental: {
    // Enable payload extraction for better performance
    payloadExtraction: false,
    // Enable inline route rules
    inlineSSRStyles: false
  },
  
  // Nitro configuration (for deployment)
  nitro: {
    // Enable compression
    compressPublicAssets: true,
    
    // Environment variables that should be available at runtime
    runtimeConfig: {
      // Server-side only
      datadogApiKey: process.env.DATADOG_API_KEY,
      newrelicApiKey: process.env.NEWRELIC_API_KEY,
      
      // Public (client-side accessible)
      public: {
        isDev: process.env.NODE_ENV === 'development',
        monitoringPlatform: process.env.MONITORING_PLATFORM || 'console'
      }
    }
  },
  
  // Hooks for advanced configuration
  hooks: {
    // Add custom webpack configuration if needed
    'build:before': () => {
      console.log('Building observ-metrics Nuxt demo...')
    },
    
    'render:route': (url, result, context) => {
      // Add monitoring context to each page render
      if (process.server) {
        console.log(`Rendering route: ${url}`)
      }
    }
  }
})