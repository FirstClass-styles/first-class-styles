"use client";

import { useEffect, useMemo, useState } from "react";

type Appointment = {
  id: string; customer_name: string; customer_phone: string; service: string;
  starts_at: string; ends_at: string; status: string; deposit_status: string;
};
type Closure = { id: string; closed_date: string; reason: string | null };

const SALON_TIME_ZONE = "America/New_York";
const dayKey = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
};
const todayInSalon = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return get("year") + "-" + get("month") + "-" + get("day");
};
const dateFromKey = (key: string) => new Date(key + "T00:00:00.000Z");
const localDay = (iso: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: SALON_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(iso));
const clock = (iso: string) => new Intl.DateTimeFormat("en-US", {
  timeZone: SALON_TIME_ZONE, hour: "numeric", minute: "2-digit",
}).format(new Date(iso));

export default function AdminCalendar({ appointments, mode = "calendar", previewMode = false }: { appointments: Appointment[]; mode?: "calendar" | "closures"; previewMode?: boolean }) {
  const [month, setMonth] = useState(() => dateFromKey(todayInSalon().slice(0, 7) + "-01"));
  const [selected, setSelected] = useState(() => todayInSalon());
  const [closures, setClosures] = useState<Closure[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const closureDates = useMemo(() => new Set(closures.map((c) => c.closed_date)), [closures]);

  async function loadClosures() {
    if (previewMode) { setLoading(false); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/admin/closures", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load closed dates.");
      setClosures(data.closures || []);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load closed dates.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadClosures(); }, [previewMode]);

  const monthCells = useMemo(() => {
    const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
    const offset = first.getUTCDay();
    return Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i - offset + 1)));
  }, [month]);
  const selectedAppointments = appointments.filter((a) => localDay(a.starts_at) === selected)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const selectedClosure = closures.find((c) => c.closed_date === selected);

  async function closeDate() {
    if (selectedAppointments.some((a) => a.status !== "cancelled") &&
        !window.confirm("There are existing appointments on this date. Closing it will NOT cancel them. Continue?")) return;
    setBusy(true); setMessage("");
    if (previewMode) { setClosures((current) => [...current, { id: "demo-closure-" + selected, closed_date: selected, reason: reason || "Demo closure" }]); setMessage("Sample date closed locally. No live availability changed."); setReason(""); setBusy(false); return; }
    try {
      const response = await fetch("/api/admin/closures", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selected, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not close date.");
      setMessage("Date closed. Existing appointments were kept.");
      setReason(""); await loadClosures();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not close date."); }
    finally { setBusy(false); }
  }
  async function reopenDate() {
    if (!selectedClosure || !window.confirm("Reopen this date for new bookings?")) return;
    setBusy(true); setMessage("");
    if (previewMode) { setClosures((current) => current.filter((c) => c.id !== selectedClosure.id)); setMessage("Sample date reopened locally. No live availability changed."); setBusy(false); return; }
    try {
      const response = await fetch("/api/admin/closures?id=" + encodeURIComponent(selectedClosure.id), { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not reopen date.");
      setMessage("Date reopened for new bookings."); await loadClosures();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not reopen date."); }
    finally { setBusy(false); }
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-4 sm:p-6">
      {previewMode && <div className="mb-3 rounded-lg border border-amber-400/40 bg-amber-950/20 px-3 py-2 text-xs font-semibold text-amber-200">DEMO · SAMPLE DATA · NO LIVE RECORDS OR CLOSURE CHANGES</div>}<div className="mb-4"><p className="text-[10px] uppercase tracking-[.18em] text-[#d7b56d]">{mode === "closures" ? "Availability management" : "Daily schedule"}</p><h2 className="mt-1 text-xl font-semibold">{mode === "closures" ? "Salon closures & time off" : "Appointment calendar"}</h2><p className="mt-1 text-sm text-[#aaa49a]">{mode === "closures" ? "Block dates for holidays, vacations or personal time. Reopening a date makes it available for new booking requests again." : "Select a day to review appointments and manage the salon's availability. Existing appointments stay on the calendar when a date is closed."} Dates and appointment times use Maryland local time.</p></div>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth()-1, 1)))} className="rounded-lg border border-[#d7b56d]/30 px-3 py-2" aria-label="Previous month">‹</button>
            <div className="flex items-center gap-2"><h3 className="font-semibold">{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(month)}</h3><button type="button" onClick={() => { const today = todayInSalon(); setMonth(dateFromKey(today.slice(0, 7) + "-01")); setSelected(today); }} className="rounded-lg border border-[#d7b56d]/30 px-2 py-1 text-xs text-[#e9ce8c]">Today</button></div>
            <button type="button" onClick={() => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth()+1, 1)))} className="rounded-lg border border-[#d7b56d]/30 px-3 py-2" aria-label="Next month">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#aaa49a]">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {monthCells.map((date) => {
              const key = dayKey(date);
              const count = appointments.filter((a) => localDay(a.starts_at) === key && a.status !== "cancelled").length;
              const closed = closureDates.has(key);
              return <button type="button" key={key} onClick={() => setSelected(key)}
                aria-label={new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "full" }).format(date) + (closed ? ", closed" : count ? ", " + count + " appointments" : "")} className={"min-h-10 sm:min-h-12 rounded-lg border p-1 text-xs sm:text-sm " +
                  (key === selected ? "border-[#d7b56d] bg-[#d7b56d] text-[#17110a] font-bold " :
                    date.getUTCMonth() !== month.getUTCMonth() ? "border-transparent text-[#777168] " : "border-white/10 bg-[#0e0c0a] ") +
                  (closed && key !== selected ? " ring-1 ring-red-400/60 " : "")}>
                <span>{date.getUTCDate()}</span>
                <span className="block text-[9px] leading-tight sm:text-[10px]">{closed ? "Closed" : count ? count + " appt" : " "}</span>
              </button>;
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#aaa49a]"><span>● Appointment count</span><span className="text-red-300">● Closed date</span><span className="text-[#d7b56d]">● Selected day</span></div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0e0c0a] p-4">
          <h3 className="font-semibold">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(dateFromKey(selected))}</h3>
          <p className="mb-3 mt-1 text-sm text-[#aaa49a]">{selectedAppointments.length} appointment(s) · Maryland local time</p>
          {selectedAppointments.length ? <div className="mb-4 space-y-2">{selectedAppointments.map((a) => <article key={a.id} className="rounded-lg border border-white/10 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{a.customer_name}</strong><span className="text-[#d7b56d]">{clock(a.starts_at)}–{clock(a.ends_at)}</span></div><p className="text-[#aaa49a]">{a.service}</p><p className={"text-xs " + (a.status === "cancelled" ? "text-red-300 font-semibold" : "text-[#aaa49a]")}>{a.status === "cancelled" ? "CANCELLED" : a.status} · Deposit: {a.deposit_status}</p></article>)}</div> : <p className="mb-4 text-sm text-[#aaa49a]">No appointments scheduled for this day.</p>}
          {selectedClosure ? <div className="mb-3 rounded-lg border border-red-400/30 bg-red-950/20 p-3 text-sm text-red-200">Closed for new bookings{selectedClosure.reason ? ": " + selectedClosure.reason : "."}</div> : <div className="mb-3"><label className="mb-1 block text-xs text-[#aaa49a]" htmlFor="closure-reason">Reason (optional)</label><input id="closure-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Holiday, vacation, personal day…" className="w-full rounded-lg border border-white/15 bg-[#17130f] px-3 py-2 text-sm" /></div>}
          {selectedClosure ? <button type="button" disabled={busy} onClick={() => void reopenDate()} className="w-full rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200 disabled:opacity-50">{busy ? "Working…" : "Reopen this date"}</button> : <button type="button" disabled={busy || loading} onClick={() => void closeDate()} className="w-full rounded-lg bg-[#d7b56d] px-3 py-2 text-sm font-bold text-[#17110a] disabled:opacity-50">{busy ? "Working…" : "Close this date to bookings"}</button>}
          {loading && <p className="mt-2 text-xs text-[#aaa49a]">Loading closure dates…</p>}
          {message && <p role="status" className="mt-3 text-sm text-[#f5dc9d]">{message}</p>}
        </div>
      </div>
    </section>
  );
}
