/**
 * React E-commerce Example using observ-metrics
 * Shows how to integrate the library into a real React application
 */

import React, { useEffect, useState } from 'react'
import { createObservMetrics, defaultConfigs, ObservMetrics } from 'observ-metrics'

// Initialize observ-metrics with Datadog integration
const monitoring = createObservMetrics({
  userContext: {
    userSegment: 'premium_user',
    isAuthenticated: true,
    deviceType: 'desktop'
  },
  domains: defaultConfigs.ecommerce.domains,
  filtering: defaultConfigs.ecommerce.filtering,
  platform: {
    platform: 'datadog',
    apiKey: process.env.REACT_APP_DATADOG_API_KEY,
    endpoint: 'https://api.datadoghq.com/api/v1/logs'
  },
  debug: process.env.NODE_ENV === 'development'
})

export const EcommerceApp: React.FC = () => {
  const [products, setProducts] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Initialize monitoring
    monitoring.initialize()
    
    // Load initial data
    loadProducts()
  }, [])

  const loadProducts = async () => {
    setLoading(true)
    
    try {
      // Instrument the API call with business context
      const result = await monitoring.ecommerce().instrumentApiCall(
        'browse_products',
        '/api/products',
        'GET',
        {
          customAttributes: {
            section: 'homepage',
            limit: 12
          }
        }
      )

      // Simulate API call
      const response = await fetch('/api/products?limit=12')
      const productsData = await response.json()
      
      setProducts(productsData)
      
      // Record business metric
      monitoring.ecommerce().recordBusinessMetric(
        'product_catalog_loaded',
        productsData.length,
        { section: 'homepage' }
      )

    } catch (error) {
      // Track error with business context
      monitoring.ecommerce().trackError(error, {
        operation: 'load_products',
        impact: 'user_cannot_browse'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (email: string, password: string) => {
    try {
      // Instrument the complete login journey
      const result = await monitoring.auth().instrumentUserJourney(
        'user_login_flow',
        'submit_login',
        async () => {
          // API call instrumentation
          return await monitoring.auth().instrumentApiCall(
            'login',
            '/api/auth/login', 
            'POST',
            {
              journeyName: 'user_login_flow',
              stepName: 'submit_login'
            }
          )
        }
      )

      // Simulate login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
        
        // Update user context after successful login
        monitoring.updateUserContext({
          userId: userData.id.toString(),
          isAuthenticated: true,
          userSegment: userData.isPremium ? 'premium_user' : 'regular_user'
        })

        // Record successful login metric
        monitoring.auth().recordBusinessMetric(
          'login_success',
          1,
          { method: 'email_password' }
        )
      }

    } catch (error) {
      monitoring.auth().trackError(error, {
        operation: 'user_login',
        credentials_type: 'email_password'
      })
    }
  }

  const handleAddToCart = async (product: any) => {
    try {
      // Instrument add to cart with conversion tracking
      await monitoring.ecommerce().instrumentApiCall(
        'add_to_cart',
        '/api/cart/add',
        'POST',
        {
          customAttributes: {
            product_id: product.id,
            product_category: product.category,
            product_price: product.price
          }
        }
      )

      // Simulate API call
      await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      })

      setCartItems(prev => [...prev, product])

      // Record business metrics
      monitoring.ecommerce().recordBusinessMetric(
        'add_to_cart_success',
        1,
        {
          product_category: product.category,
          price_range: product.price > 100 ? 'high' : 'low'
        }
      )

    } catch (error) {
      monitoring.ecommerce().trackError(error, {
        operation: 'add_to_cart',
        product_id: product.id
      })
    }
  }

  const handleCheckout = async () => {
    try {
      // Instrument the complete checkout journey
      const result = await monitoring.ecommerce().instrumentUserJourney(
        'purchase_flow',
        'complete_purchase',
        async () => {
          // Multiple API calls in the journey
          await monitoring.ecommerce().instrumentApiCall(
            'validate_cart',
            '/api/cart/validate',
            'POST'
          )

          await monitoring.ecommerce().instrumentApiCall(
            'process_payment',
            '/api/payment/process',
            'POST'
          )

          return await monitoring.ecommerce().instrumentApiCall(
            'complete_order',
            '/api/orders',
            'POST'
          )
        }
      )

      // Simulate checkout process
      const total = cartItems.reduce((sum, item) => sum + item.price, 0)
      
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cartItems, total })
      })

      if (response.ok) {
        const order = await response.json()
        
        // Clear cart
        setCartItems([])
        
        // Record conversion metrics
        monitoring.ecommerce().recordBusinessMetric(
          'purchase_completed',
          total,
          {
            order_id: order.id,
            items_count: cartItems.length,
            user_segment: user?.isPremium ? 'premium' : 'regular'
          }
        )

        alert(`Order ${order.id} placed successfully!`)
      }

    } catch (error) {
      monitoring.ecommerce().trackError(error, {
        operation: 'checkout_process',
        cart_value: cartItems.reduce((sum, item) => sum + item.price, 0)
      })
    }
  }

  const handleSearch = async (query: string) => {
    try {
      // Instrument search with user journey tracking
      await monitoring.content().instrumentUserJourney(
        'product_discovery',
        'search_query',
        async () => {
          return await monitoring.content().instrumentApiCall(
            'search_products',
            '/api/search',
            'GET',
            {
              journeyName: 'product_discovery',
              stepName: 'search_query',
              customAttributes: { query, query_length: query.length }
            }
          )
        }
      )

      // Simulate search
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const results = await response.json()

      // Record search metrics
      monitoring.content().recordBusinessMetric(
        'search_performed',
        results.length,
        {
          query_type: query.length > 10 ? 'detailed' : 'simple',
          has_results: results.length > 0 ? 'yes' : 'no'
        }
      )

      setProducts(results)

    } catch (error) {
      monitoring.content().trackError(error, {
        operation: 'product_search',
        query
      })
    }
  }

  return (
    <div className="app">
      <header>
        <h1>E-commerce Demo with observ-metrics</h1>
        <div className="user-section">
          {user ? (
            <span>Welcome, {user.name}!</span>
          ) : (
            <button onClick={() => handleLogin('user@example.com', 'password')}>
              Login
            </button>
          )}
        </div>
        <div className="cart">
          Cart ({cartItems.length}) 
          {cartItems.length > 0 && (
            <button onClick={handleCheckout}>Checkout</button>
          )}
        </div>
      </header>

      <main>
        <div className="search-section">
          <input 
            type="text" 
            placeholder="Search products..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch(e.target.value)
              }
            }}
          />
        </div>

        <div className="products-grid">
          {loading ? (
            <div>Loading products...</div>
          ) : (
            products.map(product => (
              <div key={product.id} className="product-card">
                <img src={product.image} alt={product.title} />
                <h3>{product.title}</h3>
                <p>${product.price}</p>
                <button onClick={() => handleAddToCart(product)}>
                  Add to Cart
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Debug panel showing monitoring stats */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-panel">
          <h4>Monitoring Stats</h4>
          <pre>{JSON.stringify(monitoring.getStats(), null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

export default EcommerceApp