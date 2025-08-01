/**
 * Pinia Cart Store with observ-metrics integration
 * Demonstrates business context tracking in state management
 */

import { defineStore } from 'pinia'

interface CartItem {
  id: number
  title: string
  price: number
  image: string
  category: string
  quantity: number
}

interface CartState {
  items: CartItem[]
  lastAddedItem: CartItem | null
}

export const useCartStore = defineStore('cart', {
  state: (): CartState => ({
    items: [],
    lastAddedItem: null
  }),

  getters: {
    total: (state) => {
      return state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    },
    
    itemCount: (state) => {
      return state.items.reduce((sum, item) => sum + item.quantity, 0)
    },
    
    categories: (state) => {
      return [...new Set(state.items.map(item => item.category))]
    },
    
    isEmpty: (state) => state.items.length === 0
  },

  actions: {
    async addItem(product: Omit<CartItem, 'quantity'>) {
      const { $observMetrics } = useNuxtApp()
      
      try {
        // Instrument cart operation with business context
        await $observMetrics.ecommerce().instrumentApiCall(
          'add_to_cart',
          '/api/cart/add',
          'POST',
          {
            customAttributes: {
              product_id: product.id,
              product_category: product.category,
              product_price: product.price,
              current_cart_value: this.total,
              current_item_count: this.itemCount
            }
          }
        )

        // Check if item already exists in cart
        const existingItem = this.items.find(item => item.id === product.id)
        
        if (existingItem) {
          existingItem.quantity += 1
          this.lastAddedItem = existingItem
          
          // Track quantity increase
          $observMetrics.ecommerce().recordBusinessMetric(
            'cart_item_quantity_increased',
            existingItem.quantity,
            {
              product_id: product.id.toString(),
              product_category: product.category,
              action_type: 'quantity_increase'
            }
          )
        } else {
          const newItem: CartItem = {
            ...product,
            quantity: 1
          }
          
          this.items.push(newItem)
          this.lastAddedItem = newItem
          
          // Track new item addition
          $observMetrics.ecommerce().recordBusinessMetric(
            'cart_item_added',
            1,
            {
              product_id: product.id.toString(),
              product_category: product.category,
              product_price_range: product.price > 100 ? 'high' : 'low',
              action_type: 'new_item'
            }
          )
        }

        // Track overall cart metrics
        $observMetrics.ecommerce().recordBusinessMetric(
          'cart_value_updated',
          this.total,
          {
            item_count: this.itemCount,
            categories_count: this.categories.length,
            operation: 'add_item'
          }
        )

        // Check for cart abandonment risk (high value cart)
        if (this.total > 200 && this.itemCount > 3) {
          $observMetrics.ecommerce().recordBusinessMetric(
            'high_value_cart_created',
            this.total,
            {
              abandonment_risk: 'high',
              intervention_recommended: true
            }
          )
        }

        return { success: true, item: this.lastAddedItem }

      } catch (error) {
        // Track cart operation errors
        $observMetrics.ecommerce().trackError(error as Error, {
          operation: 'add_to_cart',
          product_id: product.id,
          cart_value: this.total,
          item_count: this.itemCount
        })
        
        throw error
      }
    },

    async removeItem(productId: number) {
      const { $observMetrics } = useNuxtApp()
      
      try {
        const itemToRemove = this.items.find(item => item.id === productId)
        
        if (!itemToRemove) {
          throw new Error(`Item with id ${productId} not found in cart`)
        }

        // Instrument removal operation
        await $observMetrics.ecommerce().instrumentApiCall(
          'remove_from_cart',
          '/api/cart/remove',
          'DELETE',
          {
            customAttributes: {
              product_id: productId,
              product_category: itemToRemove.category,
              quantity_removed: itemToRemove.quantity,
              value_removed: itemToRemove.price * itemToRemove.quantity
            }
          }
        )

        // Remove item from cart
        this.items = this.items.filter(item => item.id !== productId)

        // Track removal metrics
        $observMetrics.ecommerce().recordBusinessMetric(
          'cart_item_removed',
          itemToRemove.quantity,
          {
            product_id: productId.toString(),
            product_category: itemToRemove.category,
            removal_reason: 'manual',
            value_lost: itemToRemove.price * itemToRemove.quantity
          }
        )

        // Track updated cart state
        $observMetrics.ecommerce().recordBusinessMetric(
          'cart_value_updated', 
          this.total,
          {
            item_count: this.itemCount,
            categories_count: this.categories.length,
            operation: 'remove_item'
          }
        )

        // Track potential cart abandonment signal
        if (this.isEmpty) {
          $observMetrics.ecommerce().recordBusinessMetric(
            'cart_emptied',
            1,
            {
              abandonment_type: 'manual_removal',
              last_item_category: itemToRemove.category
            }
          )
        }

        return { success: true, removedItem: itemToRemove }

      } catch (error) {
        $observMetrics.ecommerce().trackError(error as Error, {
          operation: 'remove_from_cart',
          product_id: productId,
          cart_value: this.total
        })
        
        throw error
      }
    },

    async updateQuantity(productId: number, newQuantity: number) {
      const { $observMetrics } = useNuxtApp()
      
      if (newQuantity <= 0) {
        return this.removeItem(productId)
      }

      try {
        const item = this.items.find(item => item.id === productId)
        
        if (!item) {
          throw new Error(`Item with id ${productId} not found in cart`)
        }

        const oldQuantity = item.quantity
        const quantityDiff = newQuantity - oldQuantity

        // Instrument quantity update
        await $observMetrics.ecommerce().instrumentApiCall(
          'update_cart_quantity',
          '/api/cart/update',
          'PUT',
          {
            customAttributes: {
              product_id: productId,
              old_quantity: oldQuantity,
              new_quantity: newQuantity,
              quantity_change: quantityDiff
            }
          }
        )

        // Update quantity
        item.quantity = newQuantity

        // Track quantity change metrics
        $observMetrics.ecommerce().recordBusinessMetric(
          'cart_quantity_updated',
          quantityDiff,
          {
            product_id: productId.toString(),
            product_category: item.category,
            update_type: quantityDiff > 0 ? 'increase' : 'decrease',
            new_quantity: newQuantity
          }
        )

        // Track cart value change
        $observMetrics.ecommerce().recordBusinessMetric(
          'cart_value_updated',
          this.total,
          {
            item_count: this.itemCount,
            operation: 'quantity_update',
            value_change: quantityDiff * item.price
          }
        )

        return { success: true, item }

      } catch (error) {
        $observMetrics.ecommerce().trackError(error as Error, {
          operation: 'update_cart_quantity',
          product_id: productId,
          attempted_quantity: newQuantity
        })
        
        throw error
      }
    },

    async clearCart() {
      const { $observMetrics } = useNuxtApp()
      
      try {
        const itemsBeforeClear = [...this.items]
        const valueBeforeClear = this.total
        const countBeforeClear = this.itemCount

        // Instrument cart clearing
        await $observMetrics.ecommerce().instrumentApiCall(
          'clear_cart',
          '/api/cart/clear',
          'DELETE',
          {
            customAttributes: {
              items_cleared: countBeforeClear,
              value_cleared: valueBeforeClear,
              categories_cleared: this.categories.length
            }
          }
        )

        // Clear all items
        this.items = []
        this.lastAddedItem = null

        // Track cart clearing
        $observMetrics.ecommerce().recordBusinessMetric(
          'cart_cleared',
          1,
          {
            items_lost: countBeforeClear,
            value_lost: valueBeforeClear,
            clear_type: 'manual',
            categories_affected: itemsBeforeClear.map(item => item.category).join(',')
          }
        )

        // This could indicate cart abandonment
        if (valueBeforeClear > 50) {
          $observMetrics.ecommerce().recordBusinessMetric(
            'potential_cart_abandonment',
            valueBeforeClear,
            {
              abandonment_value: valueBeforeClear,
              abandonment_stage: 'pre_checkout',
              items_abandoned: countBeforeClear
            }
          )
        }

        return { success: true, clearedItems: itemsBeforeClear }

      } catch (error) {
        $observMetrics.ecommerce().trackError(error as Error, {
          operation: 'clear_cart',
          cart_value: this.total,
          item_count: this.itemCount
        })
        
        throw error
      }
    },

    // Business intelligence method for cart analytics
    getCartAnalytics() {
      return {
        value: this.total,
        itemCount: this.itemCount,
        categories: this.categories,
        averageItemPrice: this.itemCount > 0 ? this.total / this.itemCount : 0,
        highestPriceItem: this.items.reduce((max, item) => 
          item.price > max.price ? item : max, 
          this.items[0] || { price: 0 }
        ),
        abandonnmentRisk: this.getAbandonmentRisk()
      }
    },

    // Calculate abandonment risk based on cart characteristics
    getAbandonmentRisk(): 'low' | 'medium' | 'high' {
      if (this.isEmpty) return 'low'
      
      const avgItemPrice = this.total / this.itemCount
      const hasHighValueItems = this.items.some(item => item.price > 100)
      
      if (this.total > 300 || (hasHighValueItems && this.itemCount > 2)) {
        return 'high'
      } else if (this.total > 100 || avgItemPrice > 50) {
        return 'medium'
      }
      
      return 'low'
    }
  },

  // Persist cart state
  persist: {
    key: 'observ-metrics-cart',
    storage: persistedState.localStorage,
    
    // Custom serializer that includes analytics
    serializer: {
      deserialize: (value) => {
        const parsed = JSON.parse(value)
        
        // Track cart restoration from storage
        if (parsed.items?.length > 0) {
          const { $observMetrics } = useNuxtApp()
          
          $observMetrics?.ecommerce()?.recordBusinessMetric(
            'cart_restored_from_storage',
            parsed.items.length,
            {
              restoration_value: parsed.items.reduce((sum: number, item: CartItem) => 
                sum + (item.price * item.quantity), 0
              ),
              storage_type: 'localStorage'
            }
          )
        }
        
        return parsed
      },
      serialize: JSON.stringify
    }
  }
})