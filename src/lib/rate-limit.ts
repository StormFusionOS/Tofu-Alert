import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export interface RateLimitConfig {
  limit: number // Max requests
  window: number // Time window in seconds
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export class RateLimiter {
  private static instance: RateLimiter
  private redis: Redis

  private constructor() {
    this.redis = redis
  }

  public static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter()
    }
    return RateLimiter.instance
  }

  async check(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const now = Date.now()
    const windowStart = now - config.window * 1000
    const redisKey = `ratelimit:${key}`

    try {
      // Remove old entries outside the window
      await this.redis.zremrangebyscore(redisKey, 0, windowStart)

      // Count current requests in window
      const current = await this.redis.zcard(redisKey)

      if (current >= config.limit) {
        // Get oldest request to calculate reset time
        const oldest = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES')
        const resetAt = new Date(parseInt(oldest[1]) + config.window * 1000)

        return {
          allowed: false,
          remaining: 0,
          resetAt,
        }
      }

      // Add current request
      await this.redis.zadd(redisKey, now, `${now}-${Math.random()}`)

      // Set expiry on the key
      await this.redis.expire(redisKey, config.window)

      return {
        allowed: true,
        remaining: config.limit - current - 1,
        resetAt: new Date(now + config.window * 1000),
      }
    } catch (error) {
      console.error('Rate limit error:', error)
      // On error, allow the request (fail open)
      return {
        allowed: true,
        remaining: config.limit,
        resetAt: new Date(now + config.window * 1000),
      }
    }
  }

  async reset(key: string): Promise<void> {
    const redisKey = `ratelimit:${key}`
    await this.redis.del(redisKey)
  }
}

export const rateLimiter = RateLimiter.getInstance()

// Predefined rate limits
export const RATE_LIMITS = {
  UPLOAD: { limit: 3, window: 3600 }, // 3 uploads per hour
  TRIGGER: { limit: 1, window: 86400 }, // 1 trigger per 24 hours
  API: { limit: 60, window: 60 }, // 60 requests per minute
  ANONYMOUS: { limit: 10, window: 60 }, // 10 requests per minute
} as const

// Helper function for middleware
export async function checkRateLimit(
  identifier: string,
  type: keyof typeof RATE_LIMITS
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[type]
  return rateLimiter.check(`${type}:${identifier}`, config)
}
