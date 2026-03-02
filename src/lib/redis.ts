import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'

// This is the ONLY file that instantiates new Redis().

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Rate limit for join code attempts: 5 requests per hour (sliding window)
export const joinRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:',
})
