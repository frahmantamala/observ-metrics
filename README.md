# observ-metrics

**Frontend monitoring library that eliminates noise and adds business context to OpenTelemetry data**

[![npm version](https://img.shields.io/npm/v/observ-metrics.svg)](https://www.npmjs.com/package/observ-metrics)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/observ-metrics)](https://bundlephobia.com/package/observ-metrics)

> **Was come from frustration with noisy monitoring data.** Turn your frontend observability from overwhelming noise into actionable business insights.

## Key Features

### ** Filtering Engine**
- **Bot Detection**: Multi-signal approach to eliminate automated traffic
- **Extension Filtering**: Ignore browser extension interference  
- **Domain Whitelisting**: Only track your application requests
- **Noise Reduction**: Filter static assets, third-party errors, and irrelevant events

### **Business Context Tagging**
- **Domain-Driven Architecture**: Organize monitoring by business domains (auth, ecommerce, content)
- **Impact Classification**: Tag every metric with impact (revenue, engagement, performance, reliability)
- **User Journey Tracking**: Complete funnel analysis with conversion tracking
- **SLA Monitoring**: Domain-specific performance targets and alerting

### **Platform Agnostic**
- **Universal Integration**: Works with Datadog, New Relic, Grafana, Jaeger, and any OpenTelemetry-compatible platform
- **Framework Agnostic**: React, Vue, Angular, vanilla JS - works everywhere
- **Zero Vendor Lock-in**: Switch platforms without changing your instrumentation code

## Installation

```bash
npm install observ-metrics
# or
yarn add observ-metrics
```

## ⚡ Quick Start

### Basic Setup (5 minutes)

```typescript
import { createObservMetrics, defaultConfigs } from 'observ-metrics'

// Initialize with  defaults
const monitoring = createObservMetrics({
  userContext: {
    userSegment: 'premium_user',
    isAuthenticated: true
  },
  domains: defaultConfigs.ecommerce.domains, // Pre-configured for e-commerce
  filtering: defaultConfigs.ecommerce.filtering, //  filtering enabled
  platform: {
    platform: 'datadog', // or 'newrelic', 'grafana', 'console'
    apiKey: process.env.DATADOG_API_KEY,
    endpoint: 'https://api.datadoghq.com/api/v1/logs'
  },
  debug: process.env.NODE_ENV === 'development'
})

// Initialize (automatically filters out bots)
await monitoring.initialize()
```

### Instrument Business Operations

```typescript
// Authentication domain
const loginResult = await monitoring.auth().instrumentUserJourney(
  'user_login_flow', 
  'submit_login',
  async () => {
    return await monitoring.auth().instrumentApiCall(
      'login',
      '/api/auth/login',
      'POST'
    )
  }
)

// E-commerce domain  
await monitoring.ecommerce().instrumentUserJourney(
  'purchase_flow',
  'complete_purchase', 
  async () => {
    const order = await processCheckout()
    
    // Record business metrics
    monitoring.ecommerce().recordBusinessMetric(
      'revenue_generated',
      order.total,
      { payment_method: 'credit_card' }
    )
    
    return order
  }
)

// Content domain
await monitoring.content().instrumentApiCall(
  'search_products',
  '/api/search',
  'GET',
  { customAttributes: { query: 'electronics' } }
)
```

## 🎨 Framework Examples

<details>
<summary><b>React E-commerce App</b></summary>

```tsx
import React, { useEffect } from 'react'
import { createObservMetrics, defaultConfigs } from 'observ-metrics'

const monitoring = createObservMetrics({
  userContext: { userSegment: 'customer' },
  domains: defaultConfigs.ecommerce.domains,
  filtering: defaultConfigs.ecommerce.filtering,
  platform: { platform: 'datadog', apiKey: process.env.REACT_APP_DATADOG_KEY }
})

export const EcommerceApp = () => {
  useEffect(() => {
    monitoring.initialize()
  }, [])

  const handleAddToCart = async (product) => {
    await monitoring.ecommerce().instrumentApiCall(
      'add_to_cart',
      `/api/cart/add`,
      'POST',
      { customAttributes: { product_id: product.id, price: product.price } }
    )
    
    monitoring.ecommerce().recordBusinessMetric(
      'cart_add_success',
      1,
      { product_category: product.category }
    )
  }

  const handleCheckout = async () => {
    await monitoring.ecommerce().instrumentUserJourney(
      'purchase_flow',
      'complete_purchase',
      async () => {
        const order = await processPayment()
        monitoring.ecommerce().recordBusinessMetric('revenue', order.total)
        return order
      }
    )
  }

  return <YourEcommerceUI onAddToCart={handleAddToCart} onCheckout={handleCheckout} />
}
```
</details>

<details>
<summary><b>Vue.js Application</b></summary>

```vue
<template>
  <div class="app">
    <button @click="handleSearch">Search Products</button>
    <button @click="handleLogin">Login</button>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { createObservMetrics, defaultConfigs } from 'observ-metrics'

const monitoring = createObservMetrics({
  userContext: { userSegment: 'visitor' },
  domains: defaultConfigs.ecommerce.domains,
  filtering: defaultConfigs.ecommerce.filtering,
  platform: { platform: 'newrelic', apiKey: process.env.VUE_APP_NEWRELIC_KEY }
})

onMounted(async () => {
  await monitoring.initialize()
})

const handleSearch = async () => {
  await monitoring.content().instrumentUserJourney(
    'product_discovery',
    'search_query',
    async () => {
      const results = await searchAPI('electronics')
      monitoring.content().recordBusinessMetric('search_results', results.length)
      return results
    }
  )
}

const handleLogin = async () => {
  await monitoring.auth().instrumentUserJourney(
    'user_login_flow',
    'submit_login',
    async () => {
      const user = await loginAPI()
      monitoring.updateUserContext({ isAuthenticated: true, userId: user.id })
      return user
    }
  )
}
</script>
```
</details>

<details>
<summary><b>Vanilla JavaScript</b></summary>

```javascript
import { createObservMetrics, defaultConfigs } from 'observ-metrics'

const monitoring = createObservMetrics({
  userContext: { userSegment: 'anonymous' },
  domains: defaultConfigs.ecommerce.domains,
  filtering: defaultConfigs.ecommerce.filtering,
  platform: { platform: 'console' } // Development mode
})

// Initialize monitoring
await monitoring.initialize()

// Instrument user interactions
document.getElementById('loginBtn').addEventListener('click', async () => {
  await monitoring.auth().instrumentUserJourney('user_login_flow', 'submit_login', async () => {
    const response = await fetch('/api/login', { method: 'POST', body: formData })
    if (response.ok) {
      monitoring.updateUserContext({ isAuthenticated: true })
      monitoring.auth().recordBusinessMetric('login_success', 1)
    }
    return response.json()
  })
})
```
</details>

## 🔧 Configuration

### Domain Configuration

```typescript
const config = {
  domains: [
    {
      name: 'authentication',
      priority: 'critical', // critical, high, medium, low
      slaTarget: 2000, // milliseconds
      errorThreshold: 0.1, // 0.1% error rate
      features: ['login', 'register', 'password-reset'],
      customAttributes: { team: 'identity' }
    },
    {
      name: 'ecommerce',
      priority: 'critical',
      slaTarget: 3000,
      errorThreshold: 0.05,
      features: ['cart', 'checkout', 'payment', 'inventory']
    },
    {
      name: 'content',
      priority: 'medium',
      slaTarget: 2000,
      errorThreshold: 1.0,
      features: ['search', 'browse', 'recommendations']
    }
  ]
}
```

###  Filtering Configuration

```typescript
const filtering = {
  enableBotDetection: true, // Multi-signal bot detection
  domainWhitelist: ['myapp.com', 'staging.myapp.com'],
  errorThreshold: 5.0, // Error rate % before filtering
  samplingRate: 1.0, // 100% sampling for critical paths
  excludeExtensions: true, // Filter browser extensions
  excludeThirdPartyErrors: true, // Filter external errors
  customFilters: [
    // Custom filter functions
    (event, context) => {
      // Filter out test users
      return !context.userSegment?.includes('test')
    }
  ]
}
```

### Platform Integrations

<details>
<summary><b>Datadog Configuration</b></summary>

```typescript
const platform = {
  platform: 'datadog',
  apiKey: process.env.DATADOG_API_KEY,
  endpoint: 'https://api.datadoghq.com/api/v1/logs',
  customHeaders: {
    'DD-API-KEY': process.env.DATADOG_API_KEY
  },
  batchSize: 100,
  flushInterval: 5000
}
```

**Datadog Dashboard Setup:**
```json
{
  "widgets": [
    {
      "definition": {
        "type": "timeseries",
        "title": "Business Revenue Impact",
        "requests": [{
          "q": "avg:observ_metrics.ecommerce.revenue{business_impact:revenue} by {user_segment}"
        }]
      }
    },
    {
      "definition": {
        "type": "query_value", 
        "title": "Login Success Rate",
        "requests": [{
          "q": "avg:observ_metrics.authentication.login_success_rate{business_impact:engagement}"
        }]
      }
    }
  ]
}
```
</details>

<details>
<summary><b>New Relic Configuration</b></summary>

```typescript
const platform = {
  platform: 'newrelic',
  apiKey: process.env.NEWRELIC_API_KEY,
  accountId: process.env.NEWRELIC_ACCOUNT_ID,
  endpoint: 'https://insights-collector.newrelic.com',
  batchSize: 50,
  flushInterval: 10000
}
```

**New Relic Query Examples:**
```sql
-- Impact analysis
SELECT average(duration) FROM BusinessMetric 
WHERE businessImpact = 'revenue' 
FACET userSegment SINCE 1 hour ago

-- Conversion funnel analysis  
SELECT count(*) FROM ObservMetricsEvent 
WHERE journeyName = 'purchase_flow' 
FACET journeyStep SINCE 1 day ago
```
</details>

<details>
<summary><b>Grafana/Prometheus Configuration</b></summary>

```typescript
const platform = {
  platform: 'grafana',
  endpoint: 'http://prometheus:9090/api/v1/write',
  customHeaders: {
    'Authorization': `Bearer ${process.env.GRAFANA_TOKEN}`
  }
}
```

**Grafana Dashboard Queries:**
```promql
# Business SLA violations
rate(observ_metrics_sla_violations_total{domain="ecommerce"}[5m])

# Revenue conversion rate
rate(observ_metrics_business_revenue_total[1h]) / rate(observ_metrics_journey_steps_total{journey="purchase_flow"}[1h])
```
</details>

## Impact Tracking

### Impact Metrics
```typescript
// Track metrics that directly impact revenue
monitoring.ecommerce().recordBusinessMetric('cart_abandonment_rate', 25.5, {
  step: 'payment_selection',
  user_segment: 'premium'
})

monitoring.ecommerce().recordBusinessMetric('conversion_rate', 3.2, {
  traffic_source: 'organic',
  device_type: 'mobile'
})
```

### Engagement Impact Metrics
```typescript
// Track user engagement and retention
monitoring.auth().recordBusinessMetric('login_success_rate', 94.8, {
  authentication_method: 'sso'
})

monitoring.content().recordBusinessMetric('search_success_rate', 87.3, {
  query_type: 'product_search'
})
```

### Performance Impact Metrics  
```typescript
// Track performance that affects business outcomes
monitoring.ecommerce().recordBusinessMetric('page_load_impact_on_conversion', 0.85, {
  page_load_time_bucket: 'under_2s'
})
```

##  Filtering in Action

### Bot Detection
```typescript
// Automatically filtered out:
Googlebot crawling your site
Selenium automation scripts  
Browser extension errors
Third-party script failures
Static asset requests

// Kept and monitored:
Real user interactions
Business-critical API calls
User journey completions
Revenue-generating events
Engagement metrics
```

### Business Context Tagging
Every event automatically includes:
```json
{
  "domain": "ecommerce",
  "businessImpact": "revenue", 
  "userSegment": "premium_user",
  "journeyName": "purchase_flow",
  "journeyStep": "complete_purchase",
  "slaTarget": 3000,
  "priority": "critical"
}
```

## Debugging & Development

### Debug Mode
```typescript
const monitoring = createObservMetrics({
  // ... config
  debug: true // Enables console logging and validation
})
```

### Live Statistics
```typescript
// Get real-time monitoring statistics
const stats = monitoring.getStats()
console.log(stats)
// {
//   initialized: true,
//   domains: ['authentication', 'ecommerce', 'content'],
//   eventsProcessed: 1250,
//   filterStats: {
//     botPatternsCount: 25,
//     samplingRate: 1.0,
//     eventsFiltered: 8750,
//     eventsProcessed: 1250
//   },
//   userContext: {
//     userSegment: 'premium_user',
//     isAuthenticated: true
//   }
// }
```

### Custom Filters
```typescript
// Add runtime filters
monitoring.addFilter((event, context) => {
  // Filter out test environments
  if (window.location.hostname.includes('test')) {
    return false
  }
  
  // Only track authenticated user checkout events
  if (event.domain === 'ecommerce' && !context.isAuthenticated) {
    return false
  }
  
  return true
})
```

## Use Cases

### **E-commerce Platforms**
- **Conversion Tracking**: Monitor complete purchase funnels with business context
- **Revenue Attribution**: Connect performance metrics to actual revenue impact
- **Cart Abandonment**: Track where users drop off and why
- **Payment Success Rates**: Monitor payment provider performance vs business outcomes

### **SaaS Applications**  
- **Feature Adoption**: Track which features drive engagement and retention
- **Onboarding Funnels**: Monitor user activation journeys
- **Subscription Conversions**: Measure trial-to-paid conversion rates
- **Churn Prediction**: Identify performance issues that correlate with churn

### **Content Platforms**
- **Content Engagement**: Track which content types drive the most engagement
- **Search Performance**: Monitor search success rates and user satisfaction
- **Recommendation Effectiveness**: Measure recommendation click-through rates
- **User Journey Analysis**: Understand how users navigate your content

### **Financial Applications**
- **Transaction Success Rates**: Monitor payment processing with impact context
- **Security Event Tracking**: Track authentication and fraud prevention effectiveness  
- **Compliance Monitoring**: Ensure regulatory requirements are met with audit trails
- **Customer Experience**: Connect technical performance to customer satisfaction

## Best Practices

### **DO:  Data Collection**
```typescript
// Focus on business-critical events
await monitoring.ecommerce().instrumentUserJourney('purchase_flow', 'payment_processing', async () => {
  return await processPayment()
})

// Tag events with business context  
monitoring.ecommerce().recordBusinessMetric('revenue_per_visit', 45.30, {
  traffic_source: 'organic_search',
  user_segment: 'returning_customer'
})

// Use sampling for non-critical paths
const monitoring = createObservMetrics({
  filtering: {
    samplingRate: 0.1 // 10% sampling for content browsing
  }
})
```

### **DON'T: Common Anti-Patterns**
```javascript
// Don't track every network request
fetch('/api/health-check') // This creates noise

// Don't include PII in metrics
monitoring.recordBusinessMetric('user_email', user.email) // Security risk

// Don't track third-party script errors  
window.onerror = (error) => {
  if (error.filename.includes('google-analytics')) {
    // Don't track this - it's noise
  }
}

// Don't create metrics without business context
monitoring.recordMetric('random_technical_metric', 42) // What business impact?
```

### **Business Context Guidelines**
```typescript
// Every metric should answer: "How does this affect the business?"
monitoring.ecommerce().recordBusinessMetric('checkout_latency', 1200, {
  businessImpact: 'revenue', // Clear business connection
  affectedUsers: 'premium_customers', // Who is impacted
  expectedImpact: 'conversion_rate_decrease' // What business outcome
})

// Use consistent taxonomy
const BUSINESS_DOMAINS = {
  REVENUE: ['ecommerce', 'payments', 'subscriptions'],
  ENGAGEMENT: ['authentication', 'content', 'social'], 
  PERFORMANCE: ['api', 'frontend', 'infrastructure'],
  RELIABILITY: ['errors', 'availability', 'security']
}
```

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests  
```bash
npm run test:integration
```

### E2E Tests with Real Platforms
```bash
# Test with Datadog
DATADOG_API_KEY=your_key npm run test:e2e:datadog

# Test with New Relic  
NEWRELIC_API_KEY=your_key npm run test:e2e:newrelic
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/frahmantamala/observ-metrics.git
cd observ-metrics
npm install
npm run dev
```

### Running Examples
```bash
# React example
cd examples/react-ecommerce && npm start

# Vanilla JS example  
cd examples/vanilla-js && open index.html

# Vue example
cd examples/vue-app && npm run serve
```

## License

MIT © [Fadhil](https://github.com/frahmantamala)

## 🔗 Links

- [Documentation](https://observ-metrics.dev/docs)
- [Issues](https://github.com/frahmantamala/observ-metrics/issues)
- [Discussions](https://github.com/frahmantamala/observ-metrics/discussions)
- [NPM Package](https://www.npmjs.com/package/observ-metrics)

---

<div align="center">

**Built by developers, for developers, to solve real monitoring problems.**

[Star on GitHub](https://github.com/frahmantamala/observ-metrics) • [Read the Docs](https://observ-metrics.dev) • [Try the Demo](https://observ-metrics.dev/demo)

</div>