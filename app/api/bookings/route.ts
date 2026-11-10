import { NextRequest, NextResponse } from "next/server";

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
      duration_minutes: 240,
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

    const services = [
      "Closure Sew-In",
      "Quick Weave",
      "Signature Sew-In with Leave Out",
      "Signature Shampoo & Blow Dry",
      "Signature Silk Press",
    ];
    const times = ["09:00", "10:00", "11:00", "12:00"];

    if (!name || name.length > 120 || !phone || phone.length > 40) {
      return jsonError("Please enter your name and a valid contact phone number.");
    }
    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return jsonError("Please enter a valid email address.");
    }
    if (!services.includes(service)) return jsonError("Please choose one of the listed salon services.");
    if (!validDateText(date) || !times.includes(time)) return jsonError("Please choose an available date and start time.");
    if (notes.length > 1500) return jsonError("Please shorten your appointment notes.");

    const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    if (![0, 1, 2, 6].includes(day)) {
      return jsonError("The salon is open Saturday through Tuesday only.");
    }

    const startsAt = localDateTimeToUtc(date, time);
    const endsAt = new Date(startsAt.getTime() + 4 * 60 * 60 * 1000);
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
        status: "pending_payment",
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

    return NextResponse.json({
      success: true,
      message: "Your appointment request has been saved. The $25 deposit is pending verification by the salon.",
      appointment: {
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pending_payment",
        deposit_amount: 25,
      },
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Booking submission error:", error);
    return jsonError("We couldn't process the booking right now. Please try again shortly.", 503);
  }
}
