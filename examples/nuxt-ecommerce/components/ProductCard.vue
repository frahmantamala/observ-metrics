<template>
  <div class="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border group">
    <!-- Product Image -->
    <div class="aspect-square overflow-hidden rounded-t-lg bg-gray-100">
      <img 
        :src="safeGet('image', '/placeholder.jpg')" 
        :alt="safeGet('title', 'Product Image')"
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
        @click="handleViewProduct"
        @error="handleImageError"
        loading="lazy"
      >
    </div>
    
    <!-- Product Info -->
    <div class="p-4 space-y-3">
      <!-- Title -->
      <h3 
        class="font-medium text-gray-900 line-clamp-2 cursor-pointer hover:text-blue-600 transition-colors" 
        @click="handleViewProduct"
        :title="safeGet('title', 'Unknown Product')"
      >
        {{ safeGet('title', 'Unknown Product') }}
      </h3>
      
      <!-- Category -->
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full capitalize">
          {{ safeGet('category', 'uncategorized') }}
        </span>
        
        <!-- Rating -->
        <div v-if="safeGet('rating.rate')" class="flex items-center space-x-1">
          <div class="flex items-center">
            <span class="text-yellow-400 text-sm">★</span>
            <span class="text-xs text-gray-600 ml-1">
              {{ safeGet('rating.rate', 0).toFixed(1) }}
            </span>
          </div>
          <span class="text-xs text-gray-500">
            ({{ safeGet('rating.count', 0) }})
          </span>
        </div>
      </div>
      
      <!-- Price and Action -->
      <div class="flex items-center justify-between pt-2">
        <div class="flex flex-col">
          <span class="text-xl font-bold text-gray-900">
            ${{ formatPrice(safeGet('price', 0)) }}
          </span>
          <span v-if="showSavings" class="text-xs text-green-600">
            Save {{ getSavingsPercentage() }}%
          </span>
        </div>
        
        <button 
          @click="handleAddToCart"
          :disabled="isAddingToCart"
          class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center space-x-2"
          :class="{ 'animate-pulse': isAddingToCart }"
        >
          <span v-if="!isAddingToCart">Add to Cart</span>
          <span v-else class="flex items-center space-x-1">
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Adding...</span>
          </span>
        </button>
      </div>
      
      <!-- Quick Actions (Hover) -->
      <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pt-2 border-t">
        <div class="flex items-center justify-between text-sm">
          <button 
            @click="handleQuickView"
            class="text-gray-600 hover:text-blue-600 transition-colors"
          >
            Quick View
          </button>
          <button 
            @click="handleAddToWishlist"
            class="text-gray-600 hover:text-red-600 transition-colors"
          >
            ♡ Wishlist
          </button>
        </div>
      </div>
    </div>
    
    <!-- Stock Indicator -->
    <div v-if="showStockInfo" class="px-4 pb-4">
      <div class="flex items-center justify-between text-xs">
        <span :class="stockStatus.color">{{ stockStatus.text }}</span>
        <span class="text-gray-500">{{ getRandomStock() }} left</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-1 mt-1">
        <div 
          :class="stockStatus.barColor" 
          class="h-1 rounded-full transition-all duration-300"
          :style="{ width: stockStatus.percentage }"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Props and emits
const props = defineProps({
  product: {
    type: Object,
    required: true
  },
  showSavings: {
    type: Boolean,
    default: false
  },
  showStockInfo: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['add-to-cart', 'view-product', 'quick-view', 'add-to-wishlist'])

// Nuxt composables
const { $observMetrics } = useNuxtApp()

// Reactive state
const isAddingToCart = ref(false)
const imageError = ref(false)

// Safe property access with error handling and monitoring
const safeGet = (path, fallback = null) => {
  try {
    const value = path.split('.').reduce((obj, key) => obj?.[key], props.product)
    
    if (value === null || value === undefined) {
      // Track missing property for business intelligence
      $observMetrics?.content()?.recordBusinessMetric(
        'product_property_missing',
        1,
        {
          property_path: path,
          product_id: props.product?.id?.toString() || 'unknown',
          fallback_used: fallback !== null ? 'yes' : 'no'
        }
      )
      
      return fallback
    }
    
    return value
  } catch (error) {
    // Track property access errors
    $observMetrics?.content()?.trackError(error, {
      operation: 'safe_property_access',
      property_path: path,
      product_id: props.product?.id?.toString() || 'unknown'
    })
    
    return fallback
  }
}

// Format price safely with business context
const formatPrice = (price) => {
  try {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price
    
    if (isNaN(numPrice)) {
      // Track price formatting issues
      $observMetrics?.ecommerce()?.recordBusinessMetric(
        'price_format_error',
        1,
        {
          invalid_price: price,
          product_id: props.product?.id?.toString() || 'unknown'
        }
      )
      
      return '0.00'
    }
    
    return numPrice.toFixed(2)
  } catch (error) {
    $observMetrics?.ecommerce()?.trackError(error, {
      operation: 'price_formatting',
      price_value: price
    })
    
    return '0.00'
  }
}

// Handle image loading errors with monitoring
const handleImageError = (event) => {
  imageError.value = true
  
  // Track image loading failures
  $observMetrics?.content()?.recordBusinessMetric(
    'product_image_load_error',
    1,
    {
      product_id: props.product?.id?.toString() || 'unknown',
      image_url: props.product?.image || 'unknown',
      error_type: 'image_load_failure'
    }
  )
  
  // Set fallback image
  event.target.src = '/placeholder.jpg'
  
  console.warn(`[ProductCard] Image load failed for product ${props.product?.id}`)
}

// Calculate mock savings percentage
const getSavingsPercentage = () => {
  if (!props.showSavings) return 0
  
  const price = safeGet('price', 0)
  const mockOriginalPrice = price * 1.2 // 20% higher original price
  const savings = ((price / mockOriginalPrice) * 100)
  
  return Math.round(20) // Always show 20% savings for demo
}

// Mock stock information
const getRandomStock = () => {
  return Math.floor(Math.random() * 15) + 1
}

const stockStatus = computed(() => {
  const stock = getRandomStock()
  
  if (stock > 10) {
    return {
      text: 'In Stock',
      color: 'text-green-600',
      barColor: 'bg-green-500',
      percentage: '80%'
    }
  } else if (stock > 5) {
    return {
      text: 'Low Stock', 
      color: 'text-orange-600',
      barColor: 'bg-orange-500',
      percentage: '40%'
    }
  } else {
    return {
      text: 'Limited Stock',
      color: 'text-red-600', 
      barColor: 'bg-red-500',
      percentage: '20%'
    }
  }
})

// Event handlers with instrumentation
const handleViewProduct = async () => {
  try {
    // Track product view interaction
    await $observMetrics.content().instrumentApiCall(
      'product_card_view',
      `/api/products/${props.product?.id}/view`,
      'POST',
      {
        customAttributes: {
          product_id: props.product?.id,
          product_category: safeGet('category'),
          product_price: safeGet('price'),
          interaction_type: 'card_click',
          view_context: 'product_grid'
        }
      }
    )

    // Record business metrics
    $observMetrics.content().recordBusinessMetric(
      'product_card_engagement',
      1,
      {
        engagement_type: 'view_click',
        product_id: props.product?.id?.toString() || 'unknown',
        product_category: safeGet('category', 'unknown'),
        price_range: safeGet('price', 0) > 50 ? 'high' : 'low'
      }
    )
    
    emit('view-product', props.product)
    
  } catch (error) {
    $observMetrics.content().trackError(error, {
      operation: 'product_card_view',
      product_id: props.product?.id
    })
  }
}

const handleAddToCart = async () => {
  if (isAddingToCart.value) return
  
  isAddingToCart.value = true
  
  try {
    // Track add to cart interaction with detailed context
    await $observMetrics.ecommerce().instrumentApiCall(
      'product_card_add_to_cart',
      `/api/cart/add`,
      'POST',
      {
        customAttributes: {
          product_id: props.product?.id,
          product_category: safeGet('category'),
          product_price: safeGet('price'),
          interaction_source: 'product_card',
          stock_status: stockStatus.value.text
        }
      }
    )

    // Record conversion metrics
    $observMetrics.ecommerce().recordBusinessMetric(
      'add_to_cart_from_card',
      1,
      {
        product_id: props.product?.id?.toString() || 'unknown',
        product_category: safeGet('category', 'unknown'),
        product_price: safeGet('price', 0),
        conversion_source: 'product_card',
        user_intent: 'purchase_consideration'
      }
    )
    
    emit('add-to-cart', props.product)
    
  } catch (error) {
    $observMetrics.ecommerce().trackError(error, {
      operation: 'product_card_add_to_cart',
      product_id: props.product?.id
    })
  } finally {
    isAddingToCart.value = false
  }
}

const handleQuickView = async () => {
  try {
    // Track quick view engagement
    await $observMetrics.content().instrumentApiCall(
      'product_quick_view',
      `/api/products/${props.product?.id}/quick-view`,
      'GET',
      {
        customAttributes: {
          product_id: props.product?.id,
          interaction_type: 'quick_view',
          engagement_level: 'high'
        }
      }
    )

    $observMetrics.content().recordBusinessMetric(
      'product_quick_view',
      1,
      {
        product_id: props.product?.id?.toString() || 'unknown',
        engagement_type: 'quick_view',
        interaction_depth: 'detailed'
      }
    )
    
    emit('quick-view', props.product)
    
  } catch (error) {
    $observMetrics.content().trackError(error, {
      operation: 'product_quick_view',
      product_id: props.product?.id
    })
  }
}

const handleAddToWishlist = async () => {
  try {
    // Track wishlist addition
    await $observMetrics.content().instrumentApiCall(
      'add_to_wishlist',
      `/api/wishlist/add`,
      'POST',
      {
        customAttributes: {
          product_id: props.product?.id,
          product_category: safeGet('category'),
          wishlist_source: 'product_card'
        }
      }
    )

    $observMetrics.content().recordBusinessMetric(
      'wishlist_addition',
      1,
      {
        product_id: props.product?.id?.toString() || 'unknown',
        product_category: safeGet('category', 'unknown'),
        engagement_type: 'wishlist_save',
        future_purchase_intent: 'high'
      }
    )
    
    emit('add-to-wishlist', props.product)
    
    // Simple feedback
    if (process.client) {
      const heart = document.querySelector(`[data-product-id="${props.product?.id}"] .wishlist-heart`)
      if (heart) {
        heart.textContent = '♥'
        heart.classList.add('text-red-500')
      }
    }
    
  } catch (error) {
    $observMetrics.content().trackError(error, {
      operation: 'add_to_wishlist',
      product_id: props.product?.id
    })
  }
}

// Track product card impression when it comes into view
onMounted(() => {
  if (process.client && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Track product card impression
            $observMetrics.content().recordBusinessMetric(
              'product_card_impression',
              1,
              {
                product_id: props.product?.id?.toString() || 'unknown',
                product_category: safeGet('category', 'unknown'),
                product_price: safeGet('price', 0),
                impression_type: 'viewport_enter'
              }
            )
            
            observer.disconnect() // Only track once per product
          }
        })
      },
      { threshold: 0.5 } // Track when 50% of card is visible
    )
    
    const cardElement = document.querySelector(`[data-product-id="${props.product?.id}"]`)
    if (cardElement) {
      observer.observe(cardElement)
    }
  }
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Smooth transitions for interactive elements */
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

/* Custom animations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Hover effects */
.group:hover .group-hover\:scale-105 {
  transform: scale(1.05);
}

.group:hover .group-hover\:opacity-100 {
  opacity: 1;
}

/* Loading spinner */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>