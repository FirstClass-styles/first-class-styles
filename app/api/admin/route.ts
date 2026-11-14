import { NextRequest, NextResponse } from "next/server";
import { bookingDateTime, sendEmail } from "@/lib/email";
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
  else if (body.action === "reject_deposit") update = { deposit_status: "rejected", status: "cancelled" };
  else if (body.action === "cancel") update = { status: "cancelled" };
  else if (body.action === "mark_test") update = { customer_notes: "[TEST RECORD]" };
  else return replyError("Choose a valid appointment action.");

  try {
    const lookup = new URLSearchParams({
      id: "eq." + body.id,
      select: "id,customer_name,customer_email,service,starts_at,ends_at,status,deposit_status,customer_notes",
    });
    const beforeResponse = await database("appointments?" + lookup.toString());
    if (!beforeResponse.ok) {
      console.error("Admin appointment lookup failed:", beforeResponse.status);
      return replyError("The appointment could not be loaded.", 503);
    }
    const beforeRows = await beforeResponse.json();
    if (!Array.isArray(beforeRows) || beforeRows.length === 0) return replyError("Appointment not found.", 404);
    const previous = beforeRows[0];
    if (body.action === "mark_test" && previous.status !== "cancelled") return replyError("Cancel the appointment before marking it as a test record.", 409);
    if (body.action === "mark_test") update.customer_notes = "[TEST RECORD] " + (previous.customer_notes || "");

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

    const changed = previous.status !== rows[0].status || previous.deposit_status !== rows[0].deposit_status;
    let emailNotification: "sent" | "failed" | "not_applicable" = "not_applicable";
    if (changed && previous.customer_email) {
      const appointmentTime = bookingDateTime(previous.starts_at);
      let subject = "";
      let message = "";
      if (body.action === "verify_deposit") {
        subject = "Your appointment is confirmed — First Class Styles";
        message = [
          "Hello " + previous.customer_name + ",",
          "",
          "Your $25 deposit has been verified and your appointment at First Class Styles is now confirmed.",
          "",
          "Service: " + previous.service,
          "Appointment: " + appointmentTime,
          "",
          "Please pay the remaining balance in cash at the salon.",
          "We look forward to seeing you!",
          "",
          "First Class Styles",
          "+1 (240) 370-1128",
        ].join("\n");
      } else if (body.action === "reject_deposit") {
        subject = "Update about your salon deposit — First Class Styles";
        message = [
          "Hello " + previous.customer_name + ",",
          "",
          "We could not verify the $25 deposit for your requested appointment.",
          "Your appointment is not confirmed. Please contact First Class Styles on WhatsApp at +1 (240) 370-1128 to discuss the next step.",
          "",
          "Requested appointment: " + appointmentTime,
          "Service: " + previous.service,
          "",
          "First Class Styles",
        ].join("\n");
      } else {
        subject = "Your salon appointment has been cancelled — First Class Styles";
        message = [
          "Hello " + previous.customer_name + ",",
          "",
          "Your appointment at First Class Styles has been cancelled and the time has been released for other clients.",
          previous.deposit_status === "verified" ? "Your $25 deposit is non-refundable under the salon policy and will be retained." : "No deposit was verified for this appointment.",
          "",
          "Appointment: " + appointmentTime,
          "Service: " + previous.service,
          "",
          "Please contact us on WhatsApp at +1 (240) 370-1128 if you have questions.",
          "",
          "First Class Styles",
        ].join("\n");
      }

      try {
        await sendEmail(previous.customer_email, subject, message);
        emailNotification = "sent";
      } catch (emailError) {
        emailNotification = "failed";
        console.error("Appointment status email failed:", emailError);
      }
    }

    return NextResponse.json({ success: true, appointment: rows[0], email_notification: emailNotification }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin appointment update error:", error);
    return replyError("The appointment could not be updated.", 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return replyError("Request origin could not be verified.", 403);
  if (!validAdminSession(request)) return replyError("Your admin session has expired. Please sign in again.", 401);
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return replyError("Invalid appointment reference.");
  try {
    const check = await database("appointments?id=eq." + encodeURIComponent(id) + "&select=id,status,customer_notes"); if (!check.ok) return replyError("The record could not be checked before deletion.", 503); const checked = await check.json(); if (!Array.isArray(checked) || checked.length === 0) return replyError("Appointment not found.", 404); if (checked[0].status !== "cancelled" || !String(checked[0].customer_notes || "").startsWith("[TEST RECORD]")) return replyError("Only cancelled records explicitly marked as test records can be permanently deleted.", 409); const query = new URLSearchParams({ id: "eq." + id, status: "eq.cancelled", select: "id" });
    const response = await database("appointments?" + query.toString(), { method: "DELETE" });
    if (!response.ok) {
      console.error("Admin appointment delete failed:", response.status, await response.text());
      return replyError("The test record could not be deleted.", 503);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return replyError("Appointment not found.", 404);
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin appointment delete error:", error);
    return replyError("The test record could not be deleted.", 503);
  }
}
