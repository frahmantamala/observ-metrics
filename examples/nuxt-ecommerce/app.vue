<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b">
      <div class="container mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-8">
            <h1 class="text-2xl font-bold text-gray-900">
              🛍️ Nuxt E-commerce Demo
            </h1>
            <nav class="hidden md:flex space-x-6">
              <NuxtLink to="/" class="text-gray-600 hover:text-gray-900">Products</NuxtLink>
              <NuxtLink to="/monitoring" class="text-gray-600 hover:text-gray-900">Monitoring</NuxtLink>
            </nav>
          </div>
          
          <div class="flex items-center space-x-4">
            <!-- Search -->
            <div class="relative">
              <input
                v-model="searchQuery"
                @keyup.enter="performSearch"
                type="text"
                placeholder="Search products..."
                class="w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
              <button 
                @click="performSearch"
                class="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                🔍
              </button>
            </div>
            
            <!-- User Section -->
            <div class="flex items-center space-x-2">
              <div v-if="user" class="flex items-center space-x-2">
                <img :src="user.avatar" :alt="user.name" class="w-8 h-8 rounded-full">
                <span class="text-sm text-gray-700">{{ user.name }}</span>
                <button 
                  @click="handleLogout"
                  class="text-sm text-gray-500 hover:text-gray-700"
                >
                  Logout
                </button>
              </div>
              <button 
                v-else 
                @click="handleLogin"
                :disabled="isLoggingIn"
                class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {{ isLoggingIn ? 'Logging in...' : 'Login' }}
              </button>
            </div>
            
            <!-- Cart -->
            <button 
              @click="showCart = !showCart"
              class="relative p-2 text-gray-600 hover:text-gray-900"
            >
              🛒
              <span 
                v-if="cartStore.items.length > 0"
                class="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
              >
                {{ cartStore.items.length }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="container mx-auto px-6 py-8">
      <NuxtPage />
    </main>

    <!-- Cart Sidebar -->
    <div v-if="showCart" class="fixed inset-0 z-50 overflow-hidden">
      <div class="absolute inset-0 bg-black bg-opacity-50" @click="showCart = false"></div>
      <div class="absolute right-0 top-0 h-full w-96 bg-white shadow-xl">
        <div class="p-6 border-b">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Shopping Cart</h3>
            <button @click="showCart = false" class="text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
        
        <div class="p-6">
          <div v-if="cartStore.items.length === 0" class="text-center text-gray-500 py-8">
            Your cart is empty
          </div>
          
          <div v-else>
            <div v-for="item in cartStore.items" :key="item.id" class="flex items-center space-x-4 mb-4">
              <img :src="item.image" :alt="item.title" class="w-16 h-16 object-cover rounded">
              <div class="flex-1">
                <h4 class="font-medium text-sm">{{ item.title.substring(0, 40) }}...</h4>
                <p class="text-gray-600 text-sm">${{ item.price }}</p>
              </div>
              <button 
                @click="cartStore.removeItem(item.id)"
                class="text-red-500 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
            
            <div class="border-t pt-4 mt-6">
              <div class="flex justify-between mb-4">
                <span class="font-semibold">Total: ${{ cartStore.total.toFixed(2) }}</span>
              </div>
              <button 
                @click="handleCheckout"
                :disabled="isCheckingOut"
                class="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50"
              >
                {{ isCheckingOut ? 'Processing...' : 'Checkout' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Success Modal -->
    <div v-if="showSuccess" class="fixed inset-0 z-60 flex items-center justify-center">
      <div class="absolute inset-0 bg-black bg-opacity-50"></div>
      <div class="bg-white rounded-lg p-8 max-w-md mx-4 z-10">
        <div class="text-center">
          <div class="text-6xl mb-4">🎉</div>
          <h3 class="text-xl font-semibold text-gray-900 mb-2">Order Placed Successfully!</h3>
          <p class="text-gray-600 mb-4">Order ID: {{ lastOrder?.id }}</p>
          <p class="text-gray-600 mb-6">Total: ${{ lastOrder?.total }}</p>
          <button 
            @click="showSuccess = false"
            class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    </div>

    <!-- Monitoring Debug Panel (Development Only) -->
    <div v-if="$config.public.isDev" class="fixed bottom-4 right-4 w-80 bg-white rounded-lg shadow-lg border p-4 max-h-96 overflow-y-auto">
      <div class="flex items-center justify-between mb-3">
        <h4 class="font-semibold text-sm">observ-metrics Debug</h4>
        <button 
          @click="showDebug = !showDebug"
          class="text-xs text-gray-500 hover:text-gray-700"
        >
          {{ showDebug ? 'Hide' : 'Show' }}
        </button>
      </div>
      
      <div v-if="showDebug" class="space-y-3">
        <div class="text-xs">
          <div class="font-medium text-gray-700 mb-1">Business Metrics:</div>
          <div class="bg-gray-50 p-2 rounded font-mono text-xs">
            <div>Login Attempts: {{ debugStats.loginAttempts }}</div>
            <div>Searches: {{ debugStats.searches }}</div>
            <div>Cart Items: {{ debugStats.cartItems }}</div>
            <div>Checkouts: {{ debugStats.checkouts }}</div>
            <div>Errors: {{ debugStats.errors }}</div>
          </div>
        </div>
        
        <div class="text-xs">
          <div class="font-medium text-gray-700 mb-1">User Context:</div>
          <pre class="bg-gray-50 p-2 rounded text-xs overflow-x-auto">{{ JSON.stringify(userContext, null, 2) }}</pre>
        </div>
        
        <div class="text-xs">
          <div class="font-medium text-gray-700 mb-1">Recent Events:</div>
          <div class="bg-gray-900 text-green-400 p-2 rounded max-h-32 overflow-y-auto font-mono text-xs">
            <div v-for="event in recentEvents.slice(-5)" :key="event.id" class="mb-1">
              [{{ event.timestamp }}] {{ event.domain }}: {{ event.message }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Nuxt 3 composables and stores
const { $observMetrics } = useNuxtApp()
const cartStore = useCartStore()
const config = useRuntimeConfig()

// Reactive state
const searchQuery = ref('')
const user = ref(null)
const showCart = ref(false)
const showSuccess = ref(false)
const showDebug = ref(true)
const isLoggingIn = ref(false)
const isCheckingOut = ref(false)
const lastOrder = ref(null)

// Debug stats
const debugStats = ref({
  loginAttempts: 0,
  searches: 0,
  cartItems: 0,
  checkouts: 0,
  errors: 0
})

const userContext = ref({
  userSegment: 'anonymous',
  isAuthenticated: false,
  deviceType: 'desktop'
})

const recentEvents = ref([])

// Add monitoring event to debug panel
const addDebugEvent = (domain, message) => {
  recentEvents.value.push({
    id: Date.now(),
    timestamp: new Date().toLocaleTimeString(),
    domain,
    message
  })
  
  // Keep only last 10 events
  if (recentEvents.value.length > 10) {
    recentEvents.value = recentEvents.value.slice(-10)
  }
}

// Search functionality
const performSearch = async () => {
  if (!searchQuery.value.trim()) return
  
  try {
    addDebugEvent('content', `Searching for "${searchQuery.value}"`)
    
    // Instrument search with user journey tracking
    await $observMetrics.content().instrumentUserJourney(
      'product_discovery',
      'search_query',
      async () => {
        return await $observMetrics.content().instrumentApiCall(
          'search_products',
          '/api/search',
          'GET',
          {
            journeyName: 'product_discovery',
            stepName: 'search_query',
            customAttributes: {
              query: searchQuery.value,
              query_length: searchQuery.value.length
            }
          }
        )
      }
    )
    
    // Navigate to search results
    await navigateTo(`/search?q=${encodeURIComponent(searchQuery.value)}`)
    
    // Record search metrics
    $observMetrics.content().recordBusinessMetric(
      'search_performed',
      1,
      {
        query_type: searchQuery.value.length > 10 ? 'detailed' : 'simple',
        user_segment: userContext.value.userSegment
      }
    )
    
    debugStats.value.searches++
    addDebugEvent('content', `Search completed successfully`)
    
  } catch (error) {
    $observMetrics.content().trackError(error, {
      operation: 'product_search',
      query: searchQuery.value
    })
    
    debugStats.value.errors++
    addDebugEvent('content', `Search failed: ${error.message}`)
  }
}

// Authentication
const handleLogin = async () => {
  isLoggingIn.value = true
  
  try {
    addDebugEvent('auth', '🔐 Starting login flow')
    
    // Instrument complete login journey
    await $observMetrics.auth().instrumentUserJourney(
      'user_login_flow',
      'submit_login',
      async () => {
        return await $observMetrics.auth().instrumentApiCall(
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
    
    // Simulate successful login
    const mockUser = {
      id: 'user_123',
      name: 'John Doe',
      email: 'john@example.com',
      avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=4F46E5&color=fff',
      isPremium: true
    }
    
    user.value = mockUser
    
    // Update user context
    const newContext = {
      userId: mockUser.id,
      isAuthenticated: true,
      userSegment: mockUser.isPremium ? 'premium_user' : 'regular_user'
    }
    
    userContext.value = { ...userContext.value, ...newContext }
    $observMetrics.updateUserContext(newContext)
    
    // Record business metrics
    $observMetrics.auth().recordBusinessMetric(
      'login_success',
      1,
      { method: 'demo_login' }
    )
    
    debugStats.value.loginAttempts++
    addDebugEvent('auth', `Login successful for ${mockUser.name}`)
    
  } catch (error) {
    $observMetrics.auth().trackError(error, {
      operation: 'user_login',
      credentials_type: 'demo'
    })
    
    debugStats.value.errors++
    addDebugEvent('auth', `Login failed: ${error.message}`)
  } finally {
    isLoggingIn.value = false
  }
}

const handleLogout = () => {
  user.value = null
  userContext.value = {
    userSegment: 'anonymous',
    isAuthenticated: false,
    deviceType: userContext.value.deviceType
  }
  
  $observMetrics.updateUserContext({
    isAuthenticated: false,
    userSegment: 'anonymous'
  })
  
  addDebugEvent('auth', '👋 User logged out')
}

// Checkout process
const handleCheckout = async () => {
  isCheckingOut.value = true
  
  try {
    addDebugEvent('ecommerce', '💳 Starting checkout process')
    
    // Instrument complete checkout journey
    const result = await $observMetrics.ecommerce().instrumentUserJourney(
      'purchase_flow',
      'complete_purchase',
      async () => {
        // Multi-step checkout simulation
        await $observMetrics.ecommerce().instrumentApiCall(
          'validate_cart',
          '/api/cart/validate',
          'POST'
        )
        
        await $observMetrics.ecommerce().instrumentApiCall(
          'process_payment',
          '/api/payment/process',
          'POST'
        )
        
        return await $observMetrics.ecommerce().instrumentApiCall(
          'create_order',
          '/api/orders',
          'POST'
        )
      }
    )
    
    // Create mock order
    const order = {
      id: `order_${Date.now()}`,
      total: cartStore.total,
      items: [...cartStore.items],
      status: 'completed',
      timestamp: new Date().toISOString()
    }
    
    lastOrder.value = order
    
    // Record business metrics
    $observMetrics.ecommerce().recordBusinessMetric(
      'revenue_generated',
      order.total,
      {
        order_id: order.id,
        items_count: order.items.length,
        user_segment: userContext.value.userSegment,
        payment_method: 'credit_card'
      }
    )
    
    $observMetrics.ecommerce().recordBusinessMetric(
      'conversion_completed',
      1,
      {
        funnel_step: 'checkout_completion',
        user_segment: userContext.value.userSegment
      }
    )
    
    // Clear cart and show success
    cartStore.clearCart()
    showCart.value = false
    showSuccess.value = true
    
    debugStats.value.checkouts++
    addDebugEvent('ecommerce', `🎉 Checkout completed! Order: ${order.id}`)
    
  } catch (error) {
    $observMetrics.ecommerce().trackError(error, {
      operation: 'checkout_process',
      cart_value: cartStore.total,
      items_count: cartStore.items.length
    })
    
    debugStats.value.errors++
    addDebugEvent('ecommerce', `Checkout failed: ${error.message}`)
  } finally {
    isCheckingOut.value = false
  }
}

// Watch cart changes for metrics
watch(() => cartStore.items.length, (newCount, oldCount) => {
  if (newCount > oldCount) {
    debugStats.value.cartItems++
    addDebugEvent('ecommerce', `🛒 Item added to cart (${newCount} items)`)
  }
})

// SEO and meta
useHead({
  title: 'Nuxt E-commerce Demo - observ-metrics',
  meta: [
    { name: 'description', content: 'Nuxt 3 e-commerce demo showcasing observ-metrics  monitoring library' }
  ]
})
</script>

<style scoped>
/* Additional styles for better UX */
.container {
  max-width: 1200px;
}

/* Smooth transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Custom scrollbar for debug panel */
.overflow-y-auto::-webkit-scrollbar {
  width: 4px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: #f1f1f1;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 2px;
}
</style>