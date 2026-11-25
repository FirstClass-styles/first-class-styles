"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminCalendar from "@/components/admin-calendar";

type Appointment = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service: string;
  starts_at: string;
  ends_at: string;
  status: string;
  deposit_amount: number;
  deposit_status: string;
  customer_notes: string | null;
  created_at: string;
};

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
const dateTime = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load appointments.");
      setAppointments(data.appointments || []);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(Number(data.offset || 0) + (data.appointments || []).length);
      setSignedIn(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load appointments.";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setSignedIn(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function loadOlderAppointments() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch("/api/admin?offset=" + nextOffset, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load older appointments.");
      const existing = new Set(appointments.map((item) => item.id));
      const older = (data.appointments || []).filter((item: Appointment) => !existing.has(item.id));
      setAppointments((current) => [...current, ...older]);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(Number(data.offset || nextOffset) + (data.appointments || []).length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load older appointments.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("login"); setError("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in failed.");
      setPassword(""); setSignedIn(true); setNotice("You are signed in."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed."); }
    finally { setBusy(""); }
  }

  async function act(id: string, action: string) {
    const labels: Record<string, string> = { verify_deposit: "Deposit verified and appointment confirmed.", reject_deposit: "Deposit marked as not verified.", cancel: "Appointment cancelled.", cancel_test: "Test appointment cancelled, marked as test, and customer email suppressed." };
    if ((action === "cancel" || action === "cancel_test" || action === "mark_test") && !window.confirm(action === "cancel_test" ? "Cancel this fake/test appointment, mark it as a test record, release the time, and suppress cancellation email? Use ONLY for appointments you know are fake." : action === "mark_test" ? "Mark this cancelled appointment as a TEST RECORD? Only do this if you are certain it is not a real client record. This enables permanent deletion." : "Cancel this appointment and release the time? A verified $25 deposit remains non-refundable.")) return;
    if (action === "delete" && !window.confirm("Permanently delete this record? Use only for fake/test appointments. This cannot be undone.")) return;
    setBusy(id); setError(""); setNotice("");
    try {
      const response = action === "delete" ? await fetch("/api/admin?id=" + encodeURIComponent(id), { method: "DELETE" }) : await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed.");
      const emailNote = data.email_notification === "sent"
        ? " Customer email sent."
        : data.email_notification === "failed"
          ? " Warning: the appointment was updated, but the customer email could not be sent. Please contact the customer directly."
          : data.email_notification === "not_applicable"
            ? " No customer email was sent because no email address was provided."
            : "";
      setNotice(action === "delete" ? "Test record permanently deleted." : labels[action] + emailNote); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(""); }
  }

  async function logout() {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setSignedIn(false); setAppointments([]); setNotice("You have signed out.");
  }

  const filtered = useMemo(() => appointments.filter((a) => {
    const matchesFilter = filter === "pending" ? a.deposit_status === "pending" && a.status !== "cancelled"
      : filter === "confirmed" ? a.status === "confirmed"
      : filter === "cancelled" ? a.status === "cancelled" : true;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [a.customer_name, a.customer_phone, a.customer_email || "", a.service]
      .some((value) => value.toLowerCase().includes(term));
    return matchesFilter && matchesSearch;
  }), [appointments, filter, search]);

  const durations: Record<string, number> = { "Closure Sew-In": 270, "Loc Journey": 150, "Loc Refresh": 120, "Quick Weave": 150, "Signature Sew-In with Leave Out": 300, "Signature Shampoo & Blow Dry": 45, "Signature Silk Press": 120 };
  const durationLabel = (service: string) => { const minutes = durations[service] || 0; return minutes ? (minutes >= 60 ? (minutes % 60 ? Math.floor(minutes / 60) + " hr " + (minutes % 60) + " min" : minutes / 60 + " hr") : minutes + " min") : "Not set"; };
  const pendingCount = appointments.filter((a) => a.deposit_status === "pending" && a.status !== "cancelled").length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const appointmentDay = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const todayCount = appointments.filter((a) => a.status !== "cancelled" && appointmentDay(a.starts_at) === todayKey).length;
  const upcomingCount = appointments.filter((a) => a.status !== "cancelled" && new Date(a.starts_at).getTime() > Date.now()).length;
  const activeAppointments = appointments.filter((a) => a.status !== "cancelled");
  const uniqueClients = new Set(activeAppointments.map((a) => a.customer_phone.replace(/\D/g, ""))).size;
  const repeatClients = Array.from(activeAppointments.reduce((map, a) => {
    const key = a.customer_phone.replace(/\D/g, "");
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map<string, number>()).values()).filter((count) => count > 1).length;
  const pendingDepositTotal = appointments.filter((a) => a.status !== "cancelled" && a.deposit_status === "pending")
    .reduce((sum, a) => sum + (Number(a.deposit_amount) || 0), 0);
  const serviceCounts = activeAppointments.reduce((map, a) => {
    map.set(a.service, (map.get(a.service) || 0) + 1);
    return map;
  }, new Map<string, number>());
  const popularServices = Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const clientDirectory = Array.from(activeAppointments.reduce((map, appointment) => {
    const key = appointment.customer_phone.replace(/\D/g, "");
    const current = map.get(key) || { phone: appointment.customer_phone, name: appointment.customer_name, email: appointment.customer_email, visits: 0, latest: appointment.starts_at, services: new Set<string>() };
    current.visits += 1; current.services.add(appointment.service);
    if (new Date(appointment.starts_at).getTime() > new Date(current.latest).getTime()) { current.latest = appointment.starts_at; current.name = appointment.customer_name; current.email = appointment.customer_email; }
    map.set(key, current); return map;
  }, new Map<string, { phone: string; name: string; email: string | null; visits: number; latest: string; services: Set<string> }>()).values())
    .sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime());



  return (
    <main className="min-h-screen bg-[#080706] px-4 py-8 text-[#faf8f3] sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#d7b56d]/25 pb-6">
          <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#d7b56d]">First Class Styles</p><h1 className="mt-2 text-3xl font-semibold">Salon Admin</h1><p className="mt-1 text-sm text-[#aaa49a]">Private appointment and deposit management</p></div>
          {signedIn && <div className="flex gap-2"><button onClick={() => void load()} className="rounded-xl border border-[#d7b56d]/40 px-4 py-2 text-sm hover:bg-white/5">Refresh</button><button onClick={() => void logout()} className="rounded-xl bg-[#d7b56d] px-4 py-2 text-sm font-bold text-[#17110a]">Sign out</button></div>}
        </header>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>}
        {notice && <div role="status" className="mb-5 rounded-xl border border-[#d7b56d]/30 bg-[#d7b56d]/10 p-3 text-sm text-[#f5dc9d]">{notice}</div>}

        {!signedIn ? (
          <section className="mx-auto mt-12 max-w-md rounded-2xl border border-[#d7b56d]/30 bg-[#17130f] p-6 shadow-2xl">
            <h2 className="text-xl font-semibold">Admin sign in</h2><p className="mt-2 text-sm text-[#aaa49a]">This area is private. Sign in with the admin password configured by the salon owner.</p>
            <form onSubmit={signIn} className="mt-6 space-y-4">
              <label className="block text-sm font-medium" htmlFor="admin-password">Admin password</label>
              <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-[#d7b56d]/30 bg-[#080706] px-4 py-3 outline-none focus:border-[#d7b56d]" />
              <button disabled={busy === "login"} className="w-full rounded-xl bg-[#d7b56d] px-4 py-3 font-bold text-[#17110a] disabled:opacity-60">{busy === "login" ? "Signing in…" : "Sign in securely"}</button>
            </form>
            <a href="/" className="mt-5 inline-block text-sm text-[#d7b56d] hover:underline">← Return to salon website</a>
          </section>
        ) : (
          <>
            <section aria-label="Appointment overview" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <p className="col-span-full text-xs text-[#aaa49a]">Dashboard counts reflect the appointment records currently loaded. Use “Load older appointments” below to include more history in these totals.</p>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Appointments loaded</p><p className="mt-2 text-3xl font-semibold">{appointments.length}</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Today's appointments</p><p className="mt-2 text-3xl font-semibold">{todayCount}</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Upcoming appointments</p><p className="mt-2 text-3xl font-semibold">{upcomingCount}</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Deposits awaiting verification</p><p className="mt-2 text-3xl font-semibold text-[#f5dc9d]">{pendingCount}</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Confirmed appointments</p><p className="mt-2 text-3xl font-semibold">{confirmedCount}</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Cancelled appointments</p><p className="mt-2 text-3xl font-semibold">{cancelledCount}</p></div>
            </section>


            <section aria-label="Client and booking insights" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Active clients</p><p className="mt-2 text-2xl font-semibold">{uniqueClients}</p><p className="mt-1 text-xs text-[#aaa49a]">Based on distinct phone numbers</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Repeat clients</p><p className="mt-2 text-2xl font-semibold">{repeatClients}</p><p className="mt-1 text-xs text-[#aaa49a]">Clients with multiple active bookings in the records</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Deposits still due</p><p className="mt-2 text-2xl font-semibold text-[#f5dc9d]">{money(pendingDepositTotal)}</p><p className="mt-1 text-xs text-[#aaa49a]">Not collected revenue; awaiting verification</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Most booked services</p><div className="mt-2 space-y-1">{popularServices.length ? popularServices.map(([name,count]) => <p key={name} className="flex justify-between gap-2 text-sm"><span className="truncate">{name}</span><strong>{count}</strong></p>) : <p className="text-sm text-[#aaa49a]">No booking data yet</p>}</div></div>
            </section>

            <section aria-label="Client directory" className="mb-6 rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-4 sm:p-6">
              <div className="mb-4"><h2 className="text-xl font-semibold">Client directory</h2><p className="mt-1 text-sm text-[#aaa49a]">Private contact and visit overview, grouped by phone number. Based on the appointment records currently loaded; load older records to expand this view.</p></div>
              <div className="space-y-3">
                {clientDirectory.length ? clientDirectory.map((client) => <article key={client.phone.replace(/\D/g, "")} className="rounded-xl border border-white/10 bg-[#0e0c0a] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{client.name}</h3><p className="text-xs text-[#aaa49a]">{client.visits} active appointment{client.visits === 1 ? "" : "s"} in records</p></div><span className="text-xs text-[#d7b56d]">Last booking: {dateTime(client.latest)}</span></div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm"><a className="text-[#f5dc9d] underline" href={"tel:" + client.phone}>{client.phone}</a>{client.email && <a className="text-[#f5dc9d] underline" href={"mailto:" + client.email}>{client.email}</a>}<span className="text-[#aaa49a]">Services: {Array.from(client.services).join(", ")}</span></div>
                </article>) : <p className="py-5 text-center text-sm text-[#aaa49a]">Client records will appear after bookings are received.</p>}
              </div>
            </section>
            <AdminCalendar appointments={appointments} />

            <section className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-4 sm:p-6">
              <div className="mb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Appointments</h2><p className="mt-1 text-sm text-[#aaa49a]">{appointments.length} records loaded{hasMore ? " · more history available" : " · all records loaded"} · times shown in Maryland local time</p></div>
                  <select aria-label="Filter appointments" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded-xl border border-[#d7b56d]/30 bg-[#080706] px-3 py-3 text-sm sm:w-auto"><option value="all">All appointments</option><option value="pending">Deposit pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select>
                </div>
                <input type="search" aria-label="Search appointments" placeholder="Search customer, phone, email or service…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-[#d7b56d]/30 bg-[#080706] px-4 py-3 text-sm text-[#faf8f3] placeholder:text-[#777168] outline-none focus:border-[#d7b56d]" />
                <p className="text-xs text-[#aaa49a]">{filtered.length} appointment{filtered.length === 1 ? "" : "s"} shown</p>
              </div>
              {loading ? <p className="py-10 text-center text-[#aaa49a]">Loading appointments…</p> : filtered.length === 0 ? <p className="py-10 text-center text-[#aaa49a]">No appointments match this search or filter.</p> : (
                <div className="space-y-4">
                  {filtered.map((a) => <article key={a.id} className="rounded-xl border border-white/10 bg-[#0e0c0a] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{a.customer_name}</h3><p className="text-sm text-[#d7b56d]">{a.service}</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-3 py-1">{a.status.replaceAll("_", " ")}</span><span className={"rounded-full px-3 py-1 " + (a.deposit_status === "verified" ? "bg-emerald-900/50 text-emerald-200" : a.deposit_status === "rejected" ? "bg-red-900/40 text-red-200" : "bg-amber-900/40 text-amber-100")}>Deposit: {a.deposit_status}</span></div></div>
                    <div className="mt-4 grid gap-2 text-sm text-[#ddd6ca] sm:grid-cols-2"><p><span className="text-[#aaa49a]">Date:</span> {dateTime(a.starts_at)}</p><p><span className="text-[#aaa49a]">Duration:</span> {durationLabel(a.service)}</p><p><span className="text-[#aaa49a]">Phone:</span> <a className="text-[#f5dc9d] underline" href={"tel:" + a.customer_phone}>{a.customer_phone}</a></p><p><span className="text-[#aaa49a]">Email:</span> {a.customer_email || "Not provided"}</p><p><span className="text-[#aaa49a]">Deposit:</span> {money(a.deposit_amount)} · {a.deposit_status}</p></div>
                    {a.customer_notes && <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-[#aaa49a]"><span className="font-semibold text-[#ddd6ca]">Customer notes:</span> {a.customer_notes}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {a.customer_phone.replace(/\D/g, "").length >= 10 && <a
                        href={"https://wa.me/" + a.customer_phone.replace(/\D/g, "") + "?text=" + encodeURIComponent(a.status === "confirmed" && a.deposit_status === "verified"
                          ? "Hello " + a.customer_name + ", this is First Class Styles with a friendly reminder of your confirmed " + a.service + " appointment on " + dateTime(a.starts_at) + ". Your $25 deposit has been received. Please remember the remaining balance is due in cash at your appointment. Reply here if you need assistance."
                          : "Hello " + a.customer_name + ", this is First Class Styles. I am contacting you about your " + a.service + " appointment on " + dateTime(a.starts_at) + ". Current appointment status: " + a.status.replaceAll("_", " ") + ". Deposit status: " + a.deposit_status + ". Please reply if you have any questions.")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-200"
                      >{a.status === "confirmed" && a.deposit_status === "verified" ? "Prepare WhatsApp appointment reminder" : "Message this customer on WhatsApp"}</a>}
                      {a.deposit_status === "pending" && <><button type="button" disabled={busy === a.id} aria-busy={busy === a.id} onClick={() => void act(a.id, "verify_deposit")} className="relative z-10 min-h-12 touch-manipulation pointer-events-auto select-none rounded-lg bg-[#d7b56d] px-4 py-3 text-sm font-bold text-[#17110a] disabled:cursor-wait disabled:opacity-50">Verify $25 deposit & confirm</button><button type="button" disabled={busy === a.id} aria-busy={busy === a.id} onClick={() => void act(a.id, "reject_deposit")} className="relative z-10 min-h-12 touch-manipulation pointer-events-auto select-none rounded-lg border border-amber-500/40 px-4 py-3 text-sm text-amber-200 disabled:cursor-wait disabled:opacity-50">Mark deposit not received</button></>}
                      {a.status !== "cancelled" && <button disabled={busy === a.id} onClick={() => void act(a.id, "cancel")} className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Cancel & release time</button>}
                      {a.status === "cancelled" && !String(a.customer_notes || "").startsWith("[TEST RECORD]") && <button disabled={busy === a.id} onClick={() => void act(a.id, "mark_test")} className="rounded-lg border border-amber-500/30 px-3 py-2 text-sm text-amber-200 disabled:opacity-50">Mark as test record</button>}
                      {a.status === "cancelled" && String(a.customer_notes || "").startsWith("[TEST RECORD]") && <button disabled={busy === a.id} onClick={() => void act(a.id, "delete")} className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-300 disabled:opacity-50">Delete test record</button>}
                    </div>
                  </article>)}
                </div>
              )}
              {hasMore && <div className="mt-5 flex justify-center"><button type="button" onClick={() => void loadOlderAppointments()} disabled={loadingMore || loading} className="min-h-12 rounded-xl border border-[#d7b56d]/40 px-5 py-3 text-sm font-semibold text-[#f5dc9d] disabled:opacity-50">{loadingMore ? "Loading older appointments…" : "Load older appointments"}</button></div>}
            </section>
          </>
        )}
        <p className="mt-8 text-center text-xs text-[#777168]">Keep your admin password private. Deposit verification should only be marked complete after you confirm receipt.</p>
      </div>
    </main>
  );
}
