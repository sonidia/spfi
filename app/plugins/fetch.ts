import { defineNuxtPlugin } from '#imports'

export default defineNuxtPlugin((nuxtApp) => {
  const customFetch = $fetch.create({
    onRequest({ request, options }: { request: any, options: any }) {
      if (typeof window === 'undefined') return;
      
      const url = request.toString()
      if (!url.startsWith('/api')) return;

      let storeId: string | null = null;
      if (options.body && typeof options.body === 'object') {
        storeId = (options.body as any).storeId;
      } else if (options.query && typeof options.query === 'object') {
        storeId = (options.query as any).storeId;
      } else if (options.params && typeof options.params === 'object') {
        storeId = (options.params as any).storeId;
      }

      if (!storeId) {
        storeId = useLocalStorage("active_store_id", "").state.value;
      }

      if (storeId && typeof storeId === 'string') {
        const cookieData = useLocalStorage<any>(storeId, {}).state.value;
        if (cookieData && Object.keys(cookieData).length > 0) {
          options.headers = new Headers(options.headers || {})
          options.headers.set('x-store-data', encodeURIComponent(JSON.stringify(cookieData)))
        }
      }
    }
  })

  // Override global $fetch
  globalThis.$fetch = customFetch
  
  // Expose it to Nuxt context so useFetch also picks it up
  return {
    provide: {
      fetch: customFetch
    }
  }
})
