import { createHash } from "node:crypto";
import { NextRequest } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

function clientAddress(request: NextRequest): string | null {
  // Trust only the single client-IP header supplied by the hosting proxy.
  // Never fall back to X-Forwarded-For: its chain may contain user-supplied values.
  const trustedProxyIp = request.headers.get("x-real-ip")?.trim();
  return trustedProxyIp || null;
}

/** Persistent Supabase/Postgres rate limit. Fails closed when the backing store is unavailable. */
export async function consumeRateLimit(request: NextRequest, scope: string, maximum: number, windowSeconds: number): Promise<RateLimitResult | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const address = clientAddress(request);
  // If the trusted proxy header is missing, fail closed instead of sharing a
  // single "unknown" bucket across every visitor.
  if (!address) return null;
  const key = createHash("sha256").update(scope + ":" + address).digest("hex");
  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/consume_rate_limit", {
      method: "POST", cache: "no-store",
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: key, p_limit: maximum, p_window_seconds: windowSeconds }),
    });
    if (!response.ok) {
      console.error("Rate limit database request failed with status:", response.status);
      return null;
    }
    const data = await response.json();
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.allowed !== "boolean") return null;
    const retry = Number(result.retry_after_seconds);
    return { allowed: result.allowed, retryAfterSeconds: Number.isFinite(retry) ? Math.max(0, retry) : 0 };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    return null;
  }
}
