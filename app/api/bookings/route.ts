import { NextRequest, NextResponse } from "next/server";
import { bookingDateTime, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const TIME_ZONE = "America/New_York";
const ACTIVE_STATUSES = "pending_payment,confirmed";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function localDateTimeToUtc(dateText: string, timeText: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  const [hour, minute] = timeText.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess));
    const represented = Date.UTC(
      Number(p.year), Number(p.month) - 1, Number(p.day),
      Number(p.hour), Number(p.minute), Number(p.second)
    );
    guess += target - represented;
  }
  return new Date(guess);
}

function dateTextInNewYork(date: Date) {
  const p = localParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function validDateText(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function supabaseRequest(path: string, init?: RequestInit) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("The booking database is not configured. Please contact the salon.");
  }
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
  });
}

export async function GET() {
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(now.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString();
    const query = new URLSearchParams({
      select: "starts_at,ends_at",
      starts_at: `gte.${start}`,
      ends_at: `lte.${end}`,
      status: `in.(${ACTIVE_STATUSES})`,
      order: "starts_at.asc",
    });
    const response = await supabaseRequest(`appointments?${query.toString()}`);
    if (!response.ok) {
      console.error("Availability query failed:", response.status, await response.text());
      return jsonError("We couldn't load live availability. Please try again shortly.", 503);
    }
    const appointments = await response.json();
    return NextResponse.json({
      appointments: appointments.map((item: { starts_at: string; ends_at: string }) => ({
        starts_at: item.starts_at,
        ends_at: item.ends_at,
      })),
      time_zone: TIME_ZONE,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Availability error:", error);
    return jsonError("We couldn't load live availability. Please try again shortly.", 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const service = typeof body.service === "string" ? body.service.trim() : "";
    const date = body.date;
    const time = body.time;
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    const serviceDurations: Record<string, number> = {
      "Closure Sew-In": 270,
      "Loc Journey": 150,
      "Loc Refresh": 120,
      "Quick Weave": 150,
      "Signature Sew-In with Leave Out": 300,
      "Signature Shampoo & Blow Dry": 45,
      "Signature Silk Press": 120,
    };
    const times = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

    const phoneDigits = phone.replace(/\D/g, "");
    if (!name || name.length > 120 || !phone || phone.length > 40 || phoneDigits.length < 10 || phoneDigits.length > 15) {
      return jsonError("Please enter a valid phone number with country code, including 10 to 15 digits.");
    }
    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return jsonError("Please enter a valid email address.");
    }
    if (!(service in serviceDurations)) return jsonError("Please choose one of the listed salon services.");
    if (!validDateText(date) || !times.includes(time)) return jsonError("Please choose an available date and start time.");
    const durationMinutes = serviceDurations[service];
    if (notes.length > 1500) return jsonError("Please shorten your appointment notes.");

    const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    if (![0, 1, 2, 6].includes(day)) {
      return jsonError("The salon is open Saturday through Tuesday only.");
    }

    // Check owner-managed closure dates on the server before accepting a booking.
    const closureQuery = new URLSearchParams({ select: "id", closed_date: "eq." + date, limit: "1" });
    const closureResponse = await supabaseRequest("salon_closed_dates?" + closureQuery.toString());
    if (!closureResponse.ok) {
      console.error("Closure date check failed:", closureResponse.status, await closureResponse.text());
      return jsonError("Online booking is temporarily unavailable while the salon calendar is updated. Please contact the salon directly.", 503);
    }
    const closureRows = await closureResponse.json();
    if (Array.isArray(closureRows) && closureRows.length > 0) {
      return jsonError("The salon is closed on that date. Please choose another available date.", 409);
    }

    const startsAt = localDateTimeToUtc(date, time);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
    if (startsAt.getTime() < Date.now() + 24 * 60 * 60 * 1000) {
      return jsonError("Appointments must be booked at least 24 hours in advance.");
    }

    const localStart = localParts(startsAt);
    const localEnd = localParts(endsAt);
    if (localStart.hour < "09" || localEnd.hour > "16" ||
        (localEnd.hour === "16" && localEnd.minute !== "00")) {
      return jsonError("That appointment would fall outside the salon's 9 AM–4 PM hours.");
    }

    const insertResponse = await supabaseRequest("appointments", {
      method: "POST",
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        service,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        deposit_amount: 25,
        deposit_status: "pending",
        customer_notes: notes || null,
      }),
    });

    if (insertResponse.status === 409 || insertResponse.status === 400) {
      const detail = await insertResponse.text();
      if (/prevent_double_booking|exclusion|overlap|23P01/i.test(detail)) {
        return jsonError("That time was just booked. Please choose another available time.", 409);
      }
      console.error("Booking insert rejected:", detail);
      return jsonError("We couldn't save this booking. Please check the details and try again.", 400);
    }
    if (!insertResponse.ok) {
      console.error("Booking insert failed:", insertResponse.status, await insertResponse.text());
      return jsonError("We couldn't save your booking right now. Please try again shortly.", 503);
    }

    const appointmentTime = bookingDateTime(startsAt.toISOString());
    const salonMessage = [
      "A new appointment has been automatically confirmed.",
      "",
      "Customer: " + name,
      "Phone: " + phone,
      "Email: " + (email || "Not provided"),
      "Service: " + service,
      "Requested appointment: " + appointmentTime,
      "Duration: " + (durationMinutes >= 60 ? (durationMinutes % 60 ? Math.floor(durationMinutes / 60) + " hours " + (durationMinutes % 60) + " minutes" : durationMinutes / 60 + " hours") : durationMinutes + " minutes"),
      "Appointment status: CONFIRMED immediately on booking",
      "Deposit: $25 — still due; payment has not been recorded",
      notes ? "Customer notes: " + notes : "",
      "",
      "Review this request in the salon admin dashboard: https://first-class-styles.vercel.app/admin",
    ].filter(Boolean).join("\n");

    const customerMessage = [
      "Hello " + name + ",",
      "",
      "Your appointment at First Class Styles – Salon & Hair Spa is CONFIRMED.",
      "",
      "Service: " + service,
      "Requested appointment: " + appointmentTime,
      "Duration: " + (durationMinutes >= 60 ? (durationMinutes % 60 ? Math.floor(durationMinutes / 60) + " hours " + (durationMinutes % 60) + " minutes" : durationMinutes / 60 + " hours") : durationMinutes + " minutes"),
      "Deposit: $25 non-refundable — still due; payment has not been recorded",
      "",
      "Your appointment is confirmed and your time is reserved. The $25 non-refundable deposit is still due. Please contact us on WhatsApp at +1 (240) 370-1128 for the current payment instructions. Your remaining balance is paid in cash at the salon.",
      "",
      "First Class Styles",
      "+1 (240) 370-1128",
    ].join("\n");

    const emailTasks = [
      sendEmail("firstclass.styles1@gmail.com", "New confirmed salon appointment — " + name, salonMessage),
      ...(email ? [sendEmail(email, "Your appointment is confirmed — First Class Styles", customerMessage)] : []),
    ];
    const emailResults = await Promise.allSettled(emailTasks);
    emailResults.forEach((result) => {
      if (result.status === "rejected") console.error("Booking notification email failed:", result.reason);
    });

    return NextResponse.json({
      success: true,
      message: "Your appointment is confirmed and your time is reserved. The $25 deposit is still due and has not been recorded as paid.",
      appointment: {
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        deposit_amount: 25,
      },
      email_notifications: emailResults.every((result) => result.status === "fulfilled") ? "sent" : "partial_failure",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Booking submission error:", error);
    return jsonError("We couldn't process the booking right now. Please try again shortly.", 503);
  }
}
