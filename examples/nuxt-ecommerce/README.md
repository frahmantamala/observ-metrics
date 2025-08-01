# Nuxt E-commerce Demo

Built this to show how observ-metrics works in a real Nuxt 3 app. Not just another todo list - it's actually a working e-commerce store that tracks meaningful metrics.

## Why I built this

Got tired of monitoring tools that tell me about every bot visit and browser extension error. Wanted to show what frontend monitoring looks like when you only track stuff that matters for business.

### What it does
- Filters out bots automatically (no more fake traffic in your metrics)
- Every user action gets tagged with business context 
- Tracks complete user journeys from search to checkout
- Shows real-time performance against SLA targets
- Only alerts on errors that actually impact users

### Tech stack
- Nuxt 3 + TypeScript + Tailwind
- Real APIs (FakeStore for products, ReqRes for auth)
- Pinia for state management with instrumentation
- Works with Datadog, New Relic, or just console logs

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
open http://localhost:3000
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
# Monitoring Configuration
MONITORING_PLATFORM=console  # or 'datadog', 'newrelic'
DATADOG_API_KEY=your_datadog_key
NEWRELIC_API_KEY=your_newrelic_key

# Development
NODE_ENV=development
```

### Platform Integration

#### Datadog Setup
```env
MONITORING_PLATFORM=datadog
DATADOG_API_KEY=your_dd_api_key
```

#### New Relic Setup
```env
MONITORING_PLATFORM=newrelic
NEWRELIC_API_KEY=your_nr_api_key  
NEWRELIC_ACCOUNT_ID=your_account_id
```

## Demo Features

### What you can do
1. Browse real products from FakeStore API
2. Search with live business metrics tracking
3. Add items to cart with conversion tracking
4. Login flow with complete journey analytics
5. Full checkout process with performance monitoring

### Debug features
- Real-time business metrics display
- Live event stream showing every tracked interaction
- Performance insights with SLA status
- User context and segmentation data

## How it works

### Plugin setup
```typescript
// plugins/observ-metrics.client.ts
export default defineNuxtPlugin(async (nuxtApp) => {
  const monitoring = createObservMetrics({
    userContext: { userSegment: 'premium_user' },
    domains: defaultConfigs.ecommerce.domains,
    platform: { platform: 'datadog', apiKey: '...' }
  })
  
  await monitoring.initialize()
  nuxtApp.provide('observMetrics', monitoring)
})
```

### State management with monitoring
```typescript
// stores/cart.ts - Pinia store with instrumentation
export const useCartStore = defineStore('cart', {
  actions: {
    async addItem(product) {
      // Instrument with business context
      await $observMetrics.ecommerce().instrumentApiCall(
        'add_to_cart',
        '/api/cart/add',
        'POST',
        { customAttributes: { product_category: product.category } }
      )
      
      // Record business metrics
      $observMetrics.ecommerce().recordBusinessMetric(
        'cart_value_updated',
        this.total,
        { operation: 'add_item' }
      )
    }
  }
})
```

### Component monitoring
```vue
<!-- components/ProductCard.vue -->
<script setup>
const handleAddToCart = async (product) => {
  // Track with full business context
  await $observMetrics.ecommerce().instrumentApiCall(
    'product_card_add_to_cart',
    '/api/cart/add',
    'POST',
    {
      customAttributes: {
        product_id: product.id,
        interaction_source: 'product_card',
        user_segment: userContext.userSegment
      }
    }
  )
}
</script>
```

## What gets tracked

### Revenue stuff
- Cart value changes
- Conversion rates by user type
- Where people drop off in checkout
- Payment success rates

### User behavior  
- Which products people actually look at
- Search success rates
- How many complete the full journey
- Feature adoption patterns

### Performance data
- Core Web Vitals
- API response times
- SLA violations
- Error rates that matter

## Development tools

### Debug panel (dev mode only)
- Live business metrics
- Event stream
- User context data
- Performance stats

### Error handling
- Graceful degradation when monitoring fails
- Dev vs prod configurations
- Proper error boundaries

## Real use cases

### E-commerce monitoring
- Track product catalog performance
- Monitor cart abandonment points
- Analyze checkout flow issues
- Connect performance to revenue

### UX optimization
- See where users drop off
- Find performance bottlenecks that hurt conversion
- Track search effectiveness
- Measure feature adoption

### Business insights
- Segment analysis
- Revenue per user patterns
- Conversion funnel optimization

## Why this matters

### Traditional monitoring problems
- Tracks everything, filters later (expensive)
- Technical metrics without business context
- 80% noise, 20% signal
- Alerts on stuff that doesn't matter

### This approach
-  filtering at collection time
- Every metric tied to business impact
- 95% actionable insights
- Only alerts on things that affect users

### Portfolio value
- Production-ready patterns, not toy examples
- Shows understanding of business metrics
- Performance-conscious (reduces monitoring overhead)
- Good developer experience

## Next steps

### Extend the demo
1. Add more product categories
2. User wishlists
3. Product reviews
4. Admin dashboard

### Production deployment
1. Configure monitoring platform (Datadog/New Relic)
2. Set up proper alerting rules
3. Add automated testing
4. Error boundaries

### Advanced features
1. A/B testing integration
2. Real-time recommendations
3. Advanced user segmentation
4. Predictive analytics

## Contributing

Part of the observ-metrics library. Feel free to contribute or suggest improvements.

## License

MIT

---

Built with Nuxt 3, TypeScript, and observ-metrics to show how frontend monitoring should actually work.