import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Booking calendar is temporarily unavailable." }, { status: 503 });
  }
  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const query = new URLSearchParams({
      select: "closed_date",
      closed_date: "gte." + today,
      order: "closed_date.asc",
    });
    const response = await fetch(url + "/rest/v1/salon_closed_dates?" + query.toString(), {
      headers: { apikey: key, Authorization: "Bearer " + key },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Public closure lookup failed with status:", response.status);
      return NextResponse.json({ error: "Booking calendar is temporarily unavailable." }, { status: 503 });
    }
    const rows = await response.json();
    return NextResponse.json({ dates: rows.map((row: { closed_date: string }) => row.closed_date) }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Public closure lookup error:", error);
    return NextResponse.json({ error: "Booking calendar is temporarily unavailable." }, { status: 503 });
  }
}
