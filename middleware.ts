import { NextRequest, NextResponse } from "next/server";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// V1: best-effort in-memory rate limiting per IP.
// Works reliably in single-process environments (local dev, single-instance Node).
// On Vercel Edge (stateless per-invocation), counts do not persist across Edge nodes.
// Upgrade path: replace requestCounts with @upstash/ratelimit + Upstash Redis.
const WINDOW_MS = 60_000; // 1 minute
const MAX_WRITE_REQUESTS = 20; // per IP per window

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): {
  limited: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = requestCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + WINDOW_MS;
    requestCounts.set(ip, { count: 1, resetAt });
    return { limited: false, remaining: MAX_WRITE_REQUESTS - 1, resetAt };
  }

  entry.count++;
  const remaining = Math.max(0, MAX_WRITE_REQUESTS - entry.count);
  return {
    limited: entry.count > MAX_WRITE_REQUESTS,
    remaining,
    resetAt: entry.resetAt,
  };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { method } = request;

  if (pathname.startsWith("/api/") && WRITE_METHODS.has(method)) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const { limited, remaining, resetAt } = checkRateLimit(ip);

    if (limited) {
      return NextResponse.json(
        {
          error:
            "Trop de requêtes. Veuillez réessayer dans quelques instants.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(MAX_WRITE_REQUESTS),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(MAX_WRITE_REQUESTS));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set(
      "X-RateLimit-Reset",
      String(Math.ceil(resetAt / 1000))
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
