import { NextRequest, NextResponse } from "next/server";
import { bookingDateTime, sendEmail } from "@/lib/email";
import { timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const REMINDER_SECRET = process.env.REMINDER_CRON_SECRET;
const OWNER_EMAIL = "firstclass.styles1@gmail.com";

function authorized(request: NextRequest) {
  const supplied = request.headers.get("authorization") || "";
  const expected = "Bearer " + (REMINDER_SECRET || "");
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return Boolean(REMINDER_SECRET) && left.length === right.length && timingSafeEqual(left, right);
}

async function database(path: string, init?: RequestInit) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Appointment database is not configured.");
  return fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init?.headers,
    },
  });
}

type Appointment = {
  id: string;
  customer_name: string;
  customer_email: string | null;
  service: string;
  starts_at: string;
};

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A manual test sends only to the salon inbox and never reads or changes appointments.
  if (request.nextUrl.searchParams.get("test") === "1") {
    try {
      await sendEmail(
        OWNER_EMAIL,
        "Test appointment reminder — First Class Styles",
        [
          "This is a test of the First Class Styles appointment reminder email system.",
          "",
          "The reminder email service is able to send messages successfully.",
          "No customer appointment was accessed or changed.",
          "",
          "First Class Styles – Salon & Hair Spa",
        ].join("\\n"),
      );
      return NextResponse.json({ success: true, test_email_sent: true, recipient: OWNER_EMAIL });
    } catch (error) {
      console.error("Reminder test email failed:", error);
      return NextResponse.json({ error: "Test reminder email could not be sent." }, { status: 503 });
    }
  }

  try {
    const now = Date.now();
    // The hourly free scheduler checks a one-hour window around the 24-hour mark.
    const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString();
    const staleClaim = new Date(now - 30 * 60 * 1000).toISOString();

    const query = new URLSearchParams({
      select: "id,customer_name,customer_email,service,starts_at",
      starts_at: "gte." + windowStart,
      ends_at: "gt." + new Date(now).toISOString(),
      status: "eq.confirmed",
      deposit_status: "eq.verified",
      reminder_sent_at: "is.null",
      or: "(reminder_claimed_at.is.null,reminder_claimed_at.lt." + staleClaim + ")",
      order: "starts_at.asc",
      limit: "100",
    });
    // Apply the upper bound as an additional PostgREST filter.
    query.set("and", "(starts_at.lte." + windowEnd + ")");
    const found = await database("appointments?" + query.toString());
    if (!found.ok) {
      const detail = await found.text();
      console.error("Reminder lookup failed:", found.status, detail);
      return NextResponse.json({ error: "Could not load appointments for reminders." }, { status: 503 });
    }

    const appointments = await found.json() as Appointment[];
    let sent = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const appointment of appointments) {
      // Claim this appointment atomically so overlapping runs do not send duplicate reminders.
      const claimQuery = new URLSearchParams({
        id: "eq." + appointment.id,
        status: "eq.confirmed",
        deposit_status: "eq.verified",
        reminder_sent_at: "is.null",
        or: "(reminder_claimed_at.is.null,reminder_claimed_at.lt." + staleClaim + ")",
        select: "id",
      });
      const claim = await database("appointments?" + claimQuery.toString(), {
        method: "PATCH",
        body: JSON.stringify({ reminder_claimed_at: new Date().toISOString() }),
      });
      if (!claim.ok) {
        failures.push(appointment.id + ": could not claim reminder");
        continue;
      }
      const claimedRows = await claim.json();
      if (!Array.isArray(claimedRows) || claimedRows.length === 0) {
        skipped++;
        continue;
      }

      const when = bookingDateTime(appointment.starts_at);
      const customerMessage = [
        "Hello " + appointment.customer_name + ",",
        "",
        "This is a friendly reminder about your confirmed appointment at First Class Styles – Salon & Hair Spa.",
        "",
        "Service: " + appointment.service,
        "Appointment: " + when,
        "",
        "Please arrive on time. The remaining balance is payable in cash at the salon.",
        "If you need assistance, contact us on WhatsApp at +1 (240) 370-1128.",
        "",
        "We look forward to seeing you!",
        "First Class Styles",
      ].join("\n");
      const ownerMessage = [
        "Appointment reminder due in approximately 24 hours.",
        "",
        "Customer: " + appointment.customer_name,
        "Customer email: " + (appointment.customer_email || "Not provided"),
        "Service: " + appointment.service,
        "Appointment: " + when,
        "",
        "Deposit verified; appointment confirmed.",
      ].join("\n");

      try {
        const tasks = [
          sendEmail(OWNER_EMAIL, "Tomorrow's confirmed appointment — " + appointment.customer_name, ownerMessage),
          ...(appointment.customer_email
            ? [sendEmail(appointment.customer_email, "Appointment reminder — First Class Styles", customerMessage)]
            : []),
        ];
        const results = await Promise.allSettled(tasks);
        const failed = results.some((result) => result.status === "rejected");
        if (failed) throw new Error("One or more reminder emails could not be sent.");

        const mark = await database("appointments?id=eq." + encodeURIComponent(appointment.id) + "&reminder_sent_at=is.null", {
          method: "PATCH",
          body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
        });
        if (!mark.ok) throw new Error("Emails sent, but reminder status could not be saved.");
        const markedRows = await mark.json();
        if (!Array.isArray(markedRows) || markedRows.length === 0) {
          throw new Error("Reminder status was not saved.");
        }
        sent++;
      } catch (error) {
        console.error("Reminder send failed for appointment:", appointment.id, error);
        failures.push(appointment.id + ": email send or status update failed");
        // Release the claim so the next scheduled run can retry.
        await database("appointments?id=eq." + encodeURIComponent(appointment.id) + "&reminder_sent_at=is.null", {
          method: "PATCH",
          body: JSON.stringify({ reminder_claimed_at: null }),
        }).catch((releaseError) => console.error("Could not release reminder claim:", releaseError));
      }
    }

    return NextResponse.json({
      success: true,
      checked: appointments.length,
      reminders_sent: sent,
      skipped,
      failures,
      window: "23–25 hours before appointment",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Reminder job failed:", error);
    return NextResponse.json({ error: "Reminder job failed." }, { status: 503 });
  }
}
