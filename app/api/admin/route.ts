import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, clearAdminSession, sameOrigin, setAdminSession, validAdminSession } from "@/lib/admin-auth";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

function replyError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

function equalSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function database(path: string, init?: RequestInit) {
  if (!URL || !KEY) throw new Error("The appointment database is not configured.");
  return fetch(URL + "/rest/v1/" + path, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
  });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return replyError("Request origin could not be verified.", 403);
  if (!adminConfigured()) return replyError("Admin login is not configured yet. Add the two admin environment variables in Vercel.", 503);

  let body: { action?: string; password?: string };
  try { body = await request.json(); } catch { return replyError("Invalid request."); }

  if (body.action === "logout") {
    const response = NextResponse.json({ success: true });
    clearAdminSession(response);
    return response;
  }

  if (body.action !== "login" || typeof body.password !== "string" || body.password.length > 200) {
    return replyError("Enter your admin password.");
  }

  if (!equalSecret(body.password, process.env.ADMIN_PASSWORD || "")) {
    return replyError("That password is not correct.", 401);
  }

  const response = NextResponse.json({ success: true });
  setAdminSession(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  if (!validAdminSession(request)) return replyError("Please sign in to the admin dashboard.", 401);
  try {
    const query = new URLSearchParams({
      select: "id,customer_name,customer_phone,customer_email,service,starts_at,ends_at,status,deposit_amount,deposit_status,customer_notes,created_at",
      order: "starts_at.desc",
      limit: "200",
    });
    const response = await database("appointments?" + query.toString());
    if (!response.ok) {
      console.error("Admin appointments query failed:", response.status, await response.text());
      return replyError("Could not load appointments. Please try again.", 503);
    }
    return NextResponse.json({ appointments: await response.json() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin appointments error:", error);
    return replyError("Could not connect to the appointment database.", 503);
  }
}

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return replyError("Request origin could not be verified.", 403);
  if (!validAdminSession(request)) return replyError("Your admin session has expired. Please sign in again.", 401);

  let body: { id?: string; action?: string };
  try { body = await request.json(); } catch { return replyError("Invalid request."); }
  if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) return replyError("Invalid appointment reference.");

  let update: Record<string, string>;
  if (body.action === "verify_deposit") update = { deposit_status: "verified", status: "confirmed" };
  else if (body.action === "reject_deposit") update = { deposit_status: "rejected", status: "pending_payment" };
  else if (body.action === "cancel") update = { status: "cancelled" };
  else return replyError("Choose a valid appointment action.");

  try {
    const query = new URLSearchParams({ id: "eq." + body.id, select: "id,status,deposit_status" });
    const response = await database("appointments?" + query.toString(), {
      method: "PATCH",
      body: JSON.stringify(update),
    });
    if (!response.ok) {
      console.error("Admin appointment update failed:", response.status, await response.text());
      return replyError("The appointment could not be updated.", 503);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return replyError("Appointment not found.", 404);
    return NextResponse.json({ success: true, appointment: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin appointment update error:", error);
    return replyError("The appointment could not be updated.", 503);
  }
}
