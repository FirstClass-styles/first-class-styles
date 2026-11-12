"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load appointments.");
      setAppointments(data.appointments || []);
      setSignedIn(true);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not load appointments.";
      setError(message);
      if (message.toLowerCase().includes("sign in")) setSignedIn(false);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
    const labels: Record<string, string> = { verify_deposit: "Deposit verified and appointment confirmed.", reject_deposit: "Deposit marked as not verified.", cancel: "Appointment cancelled." };
    if (action === "cancel" && !window.confirm("Cancel this appointment?")) return;
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed.");
      const emailNote = data.email_notification === "sent"
        ? " Customer email sent."
        : data.email_notification === "failed"
          ? " Warning: the appointment was updated, but the customer email could not be sent. Please contact the customer directly."
          : data.email_notification === "not_applicable"
            ? " No customer email was sent because no email address was provided."
            : "";
      setNotice(labels[action] + emailNote); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(""); }
  }

  async function logout() {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setSignedIn(false); setAppointments([]); setNotice("You have signed out.");
  }

  const filtered = useMemo(() => appointments.filter((a) => {
    if (filter === "pending") return a.deposit_status === "pending";
    if (filter === "confirmed") return a.status === "confirmed";
    if (filter === "cancelled") return a.status === "cancelled";
    return true;
  }), [appointments, filter]);

  const pendingCount = appointments.filter((a) => a.deposit_status === "pending").length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;

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
            <section className="mb-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Total appointments</p><p className="mt-2 text-3xl font-semibold">{appointments.length}</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Deposits awaiting verification</p><p className="mt-2 text-3xl font-semibold text-[#f5dc9d]">{pendingCount}</p></div>
              <div className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-5"><p className="text-sm text-[#aaa49a]">Confirmed appointments</p><p className="mt-2 text-3xl font-semibold">{confirmedCount}</p></div>
            </section>

            <section className="rounded-2xl border border-[#d7b56d]/25 bg-[#17130f] p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Appointments</h2><p className="mt-1 text-sm text-[#aaa49a]">Latest 200 records · times shown in Maryland local time</p></div><select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-xl border border-[#d7b56d]/30 bg-[#080706] px-3 py-2 text-sm"><option value="all">All appointments</option><option value="pending">Deposit pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></div>
              {loading ? <p className="py-10 text-center text-[#aaa49a]">Loading appointments…</p> : filtered.length === 0 ? <p className="py-10 text-center text-[#aaa49a]">No appointments in this view yet.</p> : (
                <div className="space-y-4">
                  {filtered.map((a) => <article key={a.id} className="rounded-xl border border-white/10 bg-[#0e0c0a] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{a.customer_name}</h3><p className="text-sm text-[#d7b56d]">{a.service}</p></div><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-white/10 px-3 py-1">{a.status.replaceAll("_", " ")}</span><span className={"rounded-full px-3 py-1 " + (a.deposit_status === "verified" ? "bg-emerald-900/50 text-emerald-200" : a.deposit_status === "rejected" ? "bg-red-900/40 text-red-200" : "bg-amber-900/40 text-amber-100")}>Deposit: {a.deposit_status}</span></div></div>
                    <div className="mt-4 grid gap-2 text-sm text-[#ddd6ca] sm:grid-cols-2"><p><span className="text-[#aaa49a]">Date:</span> {dateTime(a.starts_at)}</p><p><span className="text-[#aaa49a]">Duration:</span> 4 hours</p><p><span className="text-[#aaa49a]">Phone:</span> <a className="text-[#f5dc9d] underline" href={"tel:" + a.customer_phone}>{a.customer_phone}</a></p><p><span className="text-[#aaa49a]">Email:</span> {a.customer_email || "Not provided"}</p><p><span className="text-[#aaa49a]">Deposit:</span> {money(a.deposit_amount)} · {a.deposit_status}</p></div>
                    {a.customer_notes && <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-[#aaa49a]"><span className="font-semibold text-[#ddd6ca]">Customer notes:</span> {a.customer_notes}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {a.deposit_status === "pending" && <><button disabled={busy === a.id} onClick={() => void act(a.id, "verify_deposit")} className="rounded-lg bg-[#d7b56d] px-3 py-2 text-sm font-bold text-[#17110a] disabled:opacity-50">Verify $25 deposit & confirm</button><button disabled={busy === a.id} onClick={() => void act(a.id, "reject_deposit")} className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-200 disabled:opacity-50">Mark deposit not received</button></>}
                      {a.status !== "cancelled" && <button disabled={busy === a.id} onClick={() => void act(a.id, "cancel")} className="rounded-lg border border-red-500/40 px-3 py-2 text-sm text-red-200 disabled:opacity-50">Cancel appointment</button>}
                    </div>
                  </article>)}
                </div>
              )}
            </section>
          </>
        )}
        <p className="mt-8 text-center text-xs text-[#777168]">Keep your admin password private. Deposit verification should only be marked complete after you confirm receipt.</p>
      </div>
    </main>
  );
}
