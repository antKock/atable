import { NextRequest, NextResponse } from "next/server";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// V1: best-effort rate limiting via request structure validation.
// Upgrade path: replace with @upstash/ratelimit + Upstash Redis for true per-IP sliding window.
export function middleware(request: NextRequest) {
  const { pathname, method } = request.nextUrl
    ? { pathname: request.nextUrl.pathname, method: request.method }
    : { pathname: "", method: request.method };

  if (pathname.startsWith("/api/") && WRITE_METHODS.has(method)) {
    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Policy", "best-effort-v1");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
