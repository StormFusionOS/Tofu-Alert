import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis error:', err)
})

redis.on('connect', () => {
  console.log('Redis connected')
})

export interface CacheOptions {
  ttl?: number // Time to live in seconds
  prefix?: string
}

export class CacheService {
  private static instance: CacheService
  private redis: Redis

  private constructor() {
    this.redis = redis
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  private getKey(key: string, prefix?: string): string {
    return prefix ? `${prefix}:${key}` : key
  }

  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const fullKey = this.getKey(key, options.prefix)
      const value = await this.redis.get(fullKey)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, options.prefix)
      const serialized = JSON.stringify(value)

      if (options.ttl) {
        await this.redis.setex(fullKey, options.ttl, serialized)
      } else {
        await this.redis.set(fullKey, serialized)
      }

      return true
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
      return false
    }
  }

  async del(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const fullKey = this.getKey(key, options.prefix)
      await this.redis.del(fullKey)
      return true
    } catch (error) {
      console.error(`Cache del error for key ${key}:`, error)
      return false
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern)
      if (keys.length === 0) return 0

      await this.redis.del(...keys)
      return keys.length
    } catch (error) {
      console.error(`Cache invalidate pattern error for ${pattern}:`, error)
      return 0
    }
  }

  async remember<T>(
    key: string,
    ttl: number,
    callback: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options)
    if (cached !== null) {
      return cached
    }

    const value = await callback()
    await this.set(key, value, { ...options, ttl })
    return value
  }
}

export const cache = CacheService.getInstance()

// Predefined cache prefixes and TTLs
export const CACHE_KEYS = {
  USER: 'user',
  SUBSCRIPTION: 'subscription',
  SETTINGS: 'settings',
  ALERT: 'alert',
  MEDIA_PROBE: 'probe',
} as const

export const CACHE_TTL = {
  USER_PROFILE: 30 * 60, // 30 minutes
  SUBSCRIPTION: 5 * 60, // 5 minutes
  SETTINGS: 1 * 60, // 1 minute
  ALERT_METADATA: 60 * 60, // 1 hour
  MEDIA_PROBE: 60 * 60, // 1 hour
} as const
