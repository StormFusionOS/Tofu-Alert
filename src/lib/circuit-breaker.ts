import CircuitBreaker from 'opossum'

export interface CircuitBreakerOptions {
  timeout?: number
  errorThresholdPercentage?: number
  resetTimeout?: number
  rollingCountTimeout?: number
  rollingCountBuckets?: number
}

const defaultOptions: CircuitBreakerOptions = {
  timeout: 30000, // 30 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 60000, // Try again after 1 minute
  rollingCountTimeout: 10000, // 10 second window
  rollingCountBuckets: 10,
}

export function createCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: CircuitBreakerOptions = {},
  fallback?: (...args: Parameters<T>) => Promise<ReturnType<T>>
): CircuitBreaker<Parameters<T>, ReturnType<T>> {
  const breaker = new CircuitBreaker(fn, {
    ...defaultOptions,
    ...options,
  })

  // Add event listeners
  breaker.on('open', () => {
    console.warn(`Circuit breaker opened for ${fn.name}`)
  })

  breaker.on('halfOpen', () => {
    console.info(`Circuit breaker half-open for ${fn.name}`)
  })

  breaker.on('close', () => {
    console.info(`Circuit breaker closed for ${fn.name}`)
  })

  breaker.on('fallback', (result) => {
    console.info(`Circuit breaker fallback triggered for ${fn.name}`)
  })

  // Set fallback if provided
  if (fallback) {
    breaker.fallback(fallback)
  }

  return breaker
}

// Predefined circuit breakers for external services

// OpenAI API breaker
export const openaiBreaker = createCircuitBreaker(
  async (prompt: string) => {
    // This will be wrapped around actual OpenAI calls
    throw new Error('Not implemented - wrap actual API call')
  },
  {
    timeout: 60000, // 1 minute for LLM calls
    errorThresholdPercentage: 50,
    resetTimeout: 120000, // 2 minutes
  },
  async () => {
    // Fallback to rule-based moderation
    console.warn('OpenAI circuit breaker open - using fallback moderation')
    return {
      verdict: 'UNSAFE',
      confidence: 0.5,
      categories: ['circuit_breaker_open'],
      notes: 'OpenAI API unavailable, denied by default',
    }
  }
)

// Twitch API breaker
export const twitchBreaker = createCircuitBreaker(
  async (endpoint: string, options: any) => {
    throw new Error('Not implemented - wrap actual API call')
  },
  {
    timeout: 10000, // 10 seconds
    errorThresholdPercentage: 60,
    resetTimeout: 30000, // 30 seconds
  }
)

// S3 breaker
export const s3Breaker = createCircuitBreaker(
  async (operation: string, params: any) => {
    throw new Error('Not implemented - wrap actual API call')
  },
  {
    timeout: 30000, // 30 seconds
    errorThresholdPercentage: 70,
    resetTimeout: 60000, // 1 minute
  }
)

// Helper to wrap any async function with circuit breaker
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  name: string,
  fn: T,
  options?: CircuitBreakerOptions,
  fallback?: (...args: Parameters<T>) => Promise<ReturnType<T>>
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  const breaker = createCircuitBreaker(fn, options, fallback)

  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return breaker.fire(...args)
  }
}
