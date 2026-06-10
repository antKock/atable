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

// Rate limit for AI imports (url/screenshot/voice): each call costs OpenAI
// tokens, so cap the daily spend per household. 50/day is far above any
// legitimate usage.
export const importRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 d'),
  prefix: 'rl:import:',
})

// Global per-code limit on join attempts: the per-IP limit above doesn't stop
// a distributed brute-force (many IPs, one code) — this one does.
export const joinCodeRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'rl:code:',
})

// Per-IP limit on public share-link lookups (/r/[token]): makes token
// enumeration impractical without slowing legitimate readers.
export const shareRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 h'),
  prefix: 'rl:share:',
})
