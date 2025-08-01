<template>
  <div class="space-y-8">
    <!-- Hero Section -->
    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8 text-center">
      <h1 class="text-4xl font-bold text-gray-900 mb-4">
        observ-metrics Demo Store
      </h1>
      <p class="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
        Experience  frontend monitoring that eliminates noise and adds business context. 
        Every interaction you make is being intelligently tracked and filtered.
      </p>
      <div class="flex flex-wrap justify-center gap-4 text-sm">
        <div class="bg-white px-4 py-2 rounded-full shadow-sm">
          <span class="text-green-600 font-medium">✓ Bot Detection</span>
        </div>
        <div class="bg-white px-4 py-2 rounded-full shadow-sm">
          <span class="text-blue-600 font-medium">✓ Business Context</span>
        </div>
        <div class="bg-white px-4 py-2 rounded-full shadow-sm">
          <span class="text-purple-600 font-medium">✓ SLA Monitoring</span>
        </div>
        <div class="bg-white px-4 py-2 rounded-full shadow-sm">
          <span class="text-orange-600 font-medium">✓ Revenue Tracking</span>
        </div>
      </div>
    </div>

    <!-- Search Results (if searching) -->
    <div v-if="searchResults.length > 0" class="space-y-4">
      <h2 class="text-2xl font-bold text-gray-900">
        Search Results for "{{ $route.query.q }}" ({{ searchResults.length }} items)
      </h2>
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ProductCard 
          v-for="product in searchResults" 
          :key="product.id"
          :product="product"
          @add-to-cart="handleAddToCart"
          @view-product="handleViewProduct"
        />
      </div>
    </div>

    <!-- Featured Products -->
    <div v-else class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-3xl font-bold text-gray-900">Featured Products</h2>
        <div class="flex items-center space-x-4">
          <select 
            v-model="selectedCategory" 
            @change="filterByCategory"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            <option v-for="category in categories" :key="category" :value="category">
              {{ category }}
            </option>
          </select>
          <button 
            @click="loadProducts"
            :disabled="loading"
            class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {{ loading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          v-for="i in 8" 
          :key="i" 
          class="bg-white rounded-lg shadow-sm animate-pulse"
        >
          <div class="h-48 bg-gray-200 rounded-t-lg"></div>
          <div class="p-4 space-y-3">
            <div class="h-4 bg-gray-200 rounded"></div>
            <div class="h-4 bg-gray-200 rounded w-2/3"></div>
            <div class="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Products Grid -->
      <div v-else-if="displayedProducts.length > 0" class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ProductCard 
          v-for="product in displayedProducts" 
          :key="product.id"
          :product="product"
          @add-to-cart="handleAddToCart"
          @view-product="handleViewProduct"
        />
      </div>

      <!-- Empty State -->
      <div v-else class="text-center py-12">
        <div class="text-6xl mb-4">🛍️</div>
        <h3 class="text-xl font-semibold text-gray-900 mb-2">No products found</h3>
        <p class="text-gray-600 mb-4">Try adjusting your search or category filter</p>
        <button 
          @click="loadProducts"
          class="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
        >
          Load Products
        </button>
      </div>
    </div>

    <!-- Business Metrics Dashboard (Development Only) -->
    <div v-if="$config.public.isDev" class="bg-white rounded-lg shadow-sm border p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">Live Business Metrics</h3>
      <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-blue-600">{{ businessMetrics.productViews }}</div>
          <div class="text-sm text-gray-600">Product Views</div>
        </div>
        <div class="bg-green-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-green-600">{{ businessMetrics.cartAdditions }}</div>
          <div class="text-sm text-gray-600">Cart Additions</div>
        </div>
        <div class="bg-purple-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-purple-600">{{ businessMetrics.searchQueries }}</div>
          <div class="text-sm text-gray-600">Search Queries</div>
        </div>
        <div class="bg-orange-50 p-4 rounded-lg text-center">
          <div class="text-2xl font-bold text-orange-600">${{ businessMetrics.totalValue }}</div>
          <div class="text-sm text-gray-600">Total Cart Value</div>
        </div>
      </div>
    </div>

    <!-- Performance Insights -->
    <div class="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">⚡ Performance Insights</h3>
      <div class="grid md:grid-cols-3 gap-6">
        <div class="text-center">
          <div class="text-sm text-gray-600 mb-1">Page Load Time</div>
          <div class="text-xl font-bold" :class="performanceMetrics.loadTime < 2000 ? 'text-green-600' : 'text-orange-600'">
            {{ performanceMetrics.loadTime }}ms
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-gray-600 mb-1">API Response Time</div>
          <div class="text-xl font-bold" :class="performanceMetrics.apiResponseTime < 1000 ? 'text-green-600' : 'text-orange-600'">
            {{ performanceMetrics.apiResponseTime }}ms
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-gray-600 mb-1">SLA Status</div>
          <div class="text-xl font-bold" :class="performanceMetrics.slaStatus === 'good' ? 'text-green-600' : 'text-red-600'">
            {{ performanceMetrics.slaStatus.toUpperCase() }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Nuxt composables
const { $observMetrics } = useNuxtApp()
const cartStore = useCartStore()
const route = useRoute()
const config = useRuntimeConfig()

// Reactive state
const products = ref([])
const searchResults = ref([])
const categories = ref([])
const selectedCategory = ref('')
const loading = ref(false)

// Business metrics for demo
const businessMetrics = ref({
  productViews: 0,
  cartAdditions: 0,
  searchQueries: 0,
  totalValue: 0
})

// Performance metrics
const performanceMetrics = ref({
  loadTime: 1200,
  apiResponseTime: 450,
  slaStatus: 'good'
})

// Computed
const displayedProducts = computed(() => {
  if (selectedCategory.value) {
    return products.value.filter(product => 
      product.category.toLowerCase() === selectedCategory.value.toLowerCase()
    )
  }
  return products.value
})

// Load products with instrumentation
const loadProducts = async () => {
  loading.value = true
  
  try {
    // Instrument the product loading operation
    const result = await $observMetrics.content().instrumentApiCall(
      'load_featured_products',
      '/api/products/featured',
      'GET',
      {
        customAttributes: {
          section: 'homepage',
          category_filter: selectedCategory.value || 'all',
          limit: 12
        }
      }
    )

    // Simulate API call to FakeStore API
    const response = await fetch('https://fakestoreapi.com/products?limit=12')
    const productsData = await response.json()
    
    products.value = productsData
    categories.value = [...new Set(productsData.map(p => p.category))]
    
    // Update performance metrics
    performanceMetrics.value.apiResponseTime = result.duration || 450
    performanceMetrics.value.slaStatus = result.duration < 2000 ? 'good' : 'poor'
    
    // Track business metrics
    $observMetrics.content().recordBusinessMetric(
      'product_catalog_loaded',
      productsData.length,
      {
        section: 'homepage',
        load_type: 'featured',
        performance_ms: result.duration
      }
    )

  } catch (error) {
    // Track loading errors
    $observMetrics.content().trackError(error, {
      operation: 'load_featured_products',
      section: 'homepage'
    })
    
    console.error('Failed to load products:', error)
  } finally {
    loading.value = false
  }
}

// Handle product view
const handleViewProduct = async (product) => {
  try {
    // Instrument product view
    await $observMetrics.content().instrumentApiCall(
      'view_product',
      `/api/products/${product.id}`,
      'GET',
      {
        customAttributes: {
          product_id: product.id,
          product_category: product.category,
          product_price: product.price,
          view_context: 'product_grid'
        }
      }
    )

    // Track business metrics
    $observMetrics.content().recordBusinessMetric(
      'product_view',
      1,
      {
        product_id: product.id.toString(),
        product_category: product.category,
        price_range: product.price > 50 ? 'high' : 'low'
      }
    )

    businessMetrics.value.productViews++
    
    // Navigate to product detail (would be implemented)
    console.log('Viewing product:', product.title)
    
  } catch (error) {
    $observMetrics.content().trackError(error, {
      operation: 'view_product',
      product_id: product.id
    })
  }
}

// Handle add to cart
const handleAddToCart = async (product) => {
  try {
    // Use cart store method (which has its own instrumentation)
    await cartStore.addItem(product)
    
    // Update business metrics
    businessMetrics.value.cartAdditions++
    businessMetrics.value.totalValue = cartStore.total
    
    // Show success feedback
    if (process.client) {
      // Simple toast notification (you could use a proper toast library)
      const toast = document.createElement('div')
      toast.textContent = `${product.title} added to cart!`
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      document.body.appendChild(toast)
      
      setTimeout(() => {
        document.body.removeChild(toast)
      }, 3000)
    }
    
  } catch (error) {
    console.error('Failed to add to cart:', error)
    
    // Error feedback
    if (process.client) {
      const toast = document.createElement('div')
      toast.textContent = 'Failed to add item to cart'
      toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50'
      document.body.appendChild(toast)
      
      setTimeout(() => {
        document.body.removeChild(toast)
      }, 3000)
    }
  }
}

// Filter by category
const filterByCategory = async () => {
  try {
    // Track category filtering
    await $observMetrics.content().instrumentApiCall(
      'filter_products',
      '/api/products/filter',
      'GET',
      {
        customAttributes: {
          filter_type: 'category',
          filter_value: selectedCategory.value || 'all',
          products_before: products.value.length,
          products_after: displayedProducts.value.length
        }
      }
    )

    // Record filtering metrics
    $observMetrics.content().recordBusinessMetric(
      'product_filter_applied',
      displayedProducts.value.length,
      {
        filter_type: 'category',
        filter_value: selectedCategory.value || 'all',
        engagement_type: 'product_discovery'
      }
    )

  } catch (error) {
    $observMetrics.content().trackError(error, {
      operation: 'filter_products',
      filter_category: selectedCategory.value
    })
  }
}

// Handle search from URL params
const handleSearchFromUrl = async () => {
  const query = route.query.q
  if (query) {
    try {
      // Instrument search operation
      await $observMetrics.content().instrumentUserJourney(
        'product_discovery',
        'search_query',
        async () => {
          return await $observMetrics.content().instrumentApiCall(
            'search_products',
            '/api/search',
            'GET',
            {
              customAttributes: {
                query: query,
                query_length: query.length,
                search_context: 'url_param'
              }
            }
          )
        }
      )

      // Simulate search API call
      const response = await fetch('https://fakestoreapi.com/products')
      const allProducts = await response.json()
      
      // Filter products based on search query
      searchResults.value = allProducts.filter(product =>
        product.title.toLowerCase().includes(query.toLowerCase()) ||
        product.description.toLowerCase().includes(query.toLowerCase()) ||
        product.category.toLowerCase().includes(query.toLowerCase())
      )

      // Track search metrics
      $observMetrics.content().recordBusinessMetric(
        'search_executed',
        searchResults.value.length,
        {
          query: query,
          results_count: searchResults.value.length,
          search_success: searchResults.value.length > 0 ? 'yes' : 'no'
        }
      )

      businessMetrics.value.searchQueries++

    } catch (error) {
      $observMetrics.content().trackError(error, {
        operation: 'search_products',
        query: query
      })
    }
  }
}

// Watch for cart changes
watch(() => cartStore.total, (newTotal) => {
  businessMetrics.value.totalValue = newTotal
})

// Initialize page
onMounted(async () => {
  const startTime = Date.now()
  
  try {
    // Track page initialization
    $observMetrics.content().recordBusinessMetric(
      'homepage_initialized',
      1,
      {
        user_agent: navigator.userAgent,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight
      }
    )

    // Handle search if coming from URL
    await handleSearchFromUrl()
    
    // Load products if not searching
    if (!route.query.q) {
      await loadProducts()
    }
    
    // Calculate and track page load time
    const loadTime = Date.now() - startTime
    performanceMetrics.value.loadTime = loadTime
    
    $observMetrics.content().recordBusinessMetric(
      'page_load_time',
      loadTime,
      {
        page: 'homepage',
        performance_category: loadTime < 2000 ? 'good' : 'needs_improvement'
      }
    )

  } catch (error) {
    $observMetrics.content().trackError(error, {
      operation: 'homepage_initialization'
    })
  }
})

// SEO
useHead({
  title: 'observ-metrics Demo Store -  Frontend Monitoring',
  meta: [
    { 
      name: 'description', 
      content: 'Experience  frontend monitoring with our demo e-commerce store. See how observ-metrics eliminates noise and adds business context to your telemetry data.' 
    }
  ]
})
</script>