import { NextRequest, NextResponse } from "next/server";
import { sameOrigin, validAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
async function db(path: string, init?: RequestInit) {
  if (!URL || !KEY) throw new Error("The appointment database is not configured.");
  return fetch(URL + "/rest/v1/" + path, {
    ...init, cache: "no-store",
    headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json", Prefer: "return=representation", ...init?.headers },
  });
}
export async function GET(request: NextRequest) {
  if (!validAdminSession(request)) return error("Please sign in to the admin dashboard.", 401);
  try {
    const q = new URLSearchParams({ select: "id,closed_date,reason,created_at", order: "closed_date.asc" });
    const response = await db("salon_closed_dates?" + q.toString());
    if (!response.ok) {
      const detail = await response.text();
      console.error("Closed dates query failed:", response.status, detail);
      return error("The closure calendar database is not ready. Apply the salon_closed_dates migration in Supabase, then refresh.", 503);
    }
    return NextResponse.json({ closures: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Closure list failed:", e);
    return error("Could not load salon closure dates.", 503);
  }
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return error("Request origin could not be verified.", 403);
  if (!validAdminSession(request)) return error("Your admin session has expired. Please sign in again.", 401);
  let body: { date?: string; reason?: string };
  try { body = await request.json(); } catch { return error("Invalid request."); }
  if (typeof body.date !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(body.date)) return error("Choose a valid date.");
  const parsed = new Date(body.date + "T12:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== body.date) return error("Choose a valid date.");
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 120) : "";
  try {
    const q = new URLSearchParams({ on_conflict: "closed_date", select: "id,closed_date,reason" });
    const response = await db("salon_closed_dates?" + q.toString(), {
      method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ closed_date: body.date, reason: reason || null }),
    });
    if (!response.ok) {
      console.error("Closure save failed:", response.status, await response.text());
      return error("Could not save this closure date. Confirm the Supabase migration has been applied.", 503);
    }
    const rows = await response.json();
    return NextResponse.json({ success: true, closure: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Closure save failed:", e);
    return error("Could not save this closure date.", 503);
  }
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return error("Request origin could not be verified.", 403);
  if (!validAdminSession(request)) return error("Your admin session has expired. Please sign in again.", 401);
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return error("Invalid closure reference.");
  try {
    const q = new URLSearchParams({ id: "eq." + id, select: "id,closed_date" });
    const response = await db("salon_closed_dates?" + q.toString(), { method: "DELETE" });
    if (!response.ok) {
      console.error("Closure removal failed:", response.status, await response.text());
      return error("Could not reopen this date.", 503);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return error("Closure date not found.", 404);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Closure removal failed:", e);
    return error("Could not reopen this date.", 503);
  }
}
