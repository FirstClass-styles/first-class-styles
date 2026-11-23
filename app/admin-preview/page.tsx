"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminCalendar from "@/components/admin-calendar";

type Appointment = {
  id: string; customer_name: string; customer_phone: string; customer_email: string | null;
  service: string; starts_at: string; ends_at: string; status: string;
  deposit_amount: number; deposit_status: string; customer_notes: string | null; created_at: string;
};
type Section = "Overview" | "Appointment Calendar" | "Booking Requests" | "Deposits & Payments" | "Clients" | "Gallery Management" | "Salon Closures" | "Settings";
const nav: Section[] = ["Overview", "Appointment Calendar", "Booking Requests", "Deposits & Payments", "Clients", "Gallery Management", "Salon Closures", "Settings"];
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
const dateTime = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export default function AdminPreviewPage() {
  const [active, setActive] = useState<Section>("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
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
      if (!response.ok) {
        if (response.status === 401) { setSignedIn(false); setAppointments([]); setHasMore(false); setNextOffset(0); return; }
        throw new Error(data.error || "Could not load salon records.");
      }
      setAppointments(data.appointments || []);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(Number(data.offset || 0) + (data.appointments || []).length);
      setSignedIn(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load salon records.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  async function loadOlderAppointments() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true); setError("");
    try {
      const response = await fetch("/api/admin?offset=" + nextOffset, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load older appointments.");
      const existing = new Set(appointments.map((item) => item.id));
      const older = (data.appointments || []).filter((item: Appointment) => !existing.has(item.id));
      setAppointments((current) => [...current, ...older]);
      setHasMore(Boolean(data.hasMore));
      setNextOffset(Number(data.offset || nextOffset) + (data.appointments || []).length);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load older appointments."); }
    finally { setLoadingMore(false); }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("login"); setError("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login", password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Sign in failed.");
      setPassword(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed."); }
    finally { setBusy(""); }
  }

  async function logout() {
    await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
    setSignedIn(false); setAppointments([]); setHasMore(false); setNextOffset(0); setNotice("You have signed out.");
  }

  async function act(id: string, action: "verify_deposit" | "reject_deposit" | "cancel") {
    const prompts = {
      verify_deposit: "Confirm that you have received the $25 deposit and want to confirm this appointment?",
      reject_deposit: "Mark this deposit as not received and cancel this booking request?",
      cancel: "Cancel this appointment and release its time? Any verified deposit remains non-refundable."
    };
    if (!window.confirm(prompts[action])) return;
    setBusy(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update this appointment.");
      const message = action === "verify_deposit" ? "Deposit verified and appointment confirmed."
        : action === "reject_deposit" ? "Deposit marked not received; booking cancelled."
        : "Appointment cancelled and time released.";
      const emailNote = data.email_notification === "sent" ? " Customer email sent."
        : data.email_notification === "failed" ? " Warning: customer email failed; please contact the client directly."
        : data.email_notification === "not_applicable" ? " No customer email was sent because no email address was provided." : "";
      setNotice(message + emailNote); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Update failed."); }
    finally { setBusy(""); }
  }

  const activeAppointments = useMemo(() => appointments.filter((a) => a.status !== "cancelled"), [appointments]);
  const pending = activeAppointments.filter((a) => a.deposit_status === "pending");
  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dayKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const todayAppointments = activeAppointments.filter((a) => dayKey(a.starts_at) === todayKey).sort((a,b) => a.starts_at.localeCompare(b.starts_at));
  const upcoming = activeAppointments.filter((a) => new Date(a.starts_at).getTime() > Date.now()).length;
  const pendingTotal = pending.reduce((sum, a) => sum + (Number(a.deposit_amount) || 0), 0);
  const clients = useMemo(() => Array.from(activeAppointments.reduce((map, a) => {
    const key = a.customer_phone.replace(/\\D/g, "");
    const old = map.get(key) || { name: a.customer_name, phone: a.customer_phone, email: a.customer_email, visits: 0, latest: a.starts_at };
    old.visits += 1;
    if (new Date(a.starts_at).getTime() > new Date(old.latest).getTime()) { old.latest = a.starts_at; old.name = a.customer_name; old.email = a.customer_email; }
    map.set(key, old); return map;
  }, new Map<string, {name:string;phone:string;email:string|null;visits:number;latest:string}>()).values()).sort((a,b)=>new Date(b.latest).getTime()-new Date(a.latest).getTime()), [activeAppointments]);

  const filtered = appointments.filter((a) => {
    const matchFilter = filter === "pending" ? a.deposit_status === "pending" && a.status !== "cancelled"
      : filter === "confirmed" ? a.status === "confirmed" : filter === "cancelled" ? a.status === "cancelled" : true;
    const term = search.trim().toLowerCase();
    return matchFilter && (!term || [a.customer_name,a.customer_phone,a.customer_email || "",a.service].some((v)=>v.toLowerCase().includes(term)));
  });

  const shell = "rounded-2xl border border-[#d2b36b]/15 bg-[#12100d] p-4 sm:p-5";
  const metric = (label:string,value:string,sub:string,highlight=false) => <div className={`rounded-2xl border p-4 sm:p-5 ${highlight?"border-[#d2b36b]/35 bg-[#1b150d]":"border-[#d2b36b]/12 bg-[#12100d]"}`}><p className="text-xs text-[#a59b8e]">{label}</p><p className={`mt-3 text-3xl font-semibold ${highlight?"text-[#e9ce8c]":"text-[#f3eee4]"}`}>{value}</p><p className="mt-1 text-xs text-[#8f8579]">{sub}</p></div>;

  if (!signedIn) return <main className="min-h-screen bg-[#090807] px-4 py-10 text-[#f6f1e8]">
    <div className="mx-auto max-w-md rounded-3xl border border-[#d2b36b]/25 bg-[#17130f] p-6 shadow-2xl sm:p-8">
      <Brand /><p className="mt-8 text-xs uppercase tracking-[.2em] text-[#d2b36b]">Private salon workspace</p>
      <h1 className="mt-2 text-2xl font-semibold">Sign in to continue</h1>
      <p className="mt-2 text-sm text-[#aaa49a]">Use the same private admin password. This dashboard reads real salon records only after your secure session is verified.</p>
      <form onSubmit={signIn} className="mt-6 space-y-3"><label htmlFor="dashboard-password" className="block text-sm">Admin password</label><input id="dashboard-password" type="password" autoComplete="current-password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full rounded-xl border border-[#d2b36b]/30 bg-[#080706] px-4 py-3 outline-none focus:border-[#d2b36b]" /><button disabled={busy==="login"} className="w-full rounded-xl bg-[#d2b36b] px-4 py-3 font-semibold text-[#17110a] disabled:opacity-50">{busy==="login"?"Signing in…":"Open private dashboard"}</button></form>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      <a href="/admin" className="mt-5 inline-block text-sm text-[#d2b36b] underline">Open original admin dashboard</a>
      <p className="mt-6 text-xs text-[#82796e]">Protected by the existing First Class Styles admin session. No demo appointments are used.</p>
    </div>
  </main>;

  return <main className="min-h-screen bg-[#090807] text-[#f6f1e8]">
    <div className="relative flex min-h-screen">
      <aside className="hidden w-[248px] shrink-0 border-r border-[#c8a75c]/15 bg-[#0d0b09] p-6 lg:flex lg:flex-col">
        <Brand /><nav aria-label="Dashboard sections" className="mt-10 space-y-1">{nav.map((item,i)=><button key={item} aria-current={active===item?"page":undefined} onClick={()=>setActive(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d2b36b] ${active===item?"bg-[#d2b36b]/12 text-[#e9ce8c] ring-1 ring-[#d2b36b]/20":"text-[#aaa49a] hover:bg-white/[.035] hover:text-white"}`}><span className="w-5 text-center text-xs text-[#d2b36b]">{["✦","▦","◷","◈","♙","▧","◌","⚙"][i]}</span>{item}</button>)}</nav>
        <div className="mt-auto rounded-2xl border border-[#d2b36b]/15 bg-[#17130f] p-4"><p className="text-[10px] uppercase tracking-[.18em] text-[#d2b36b]">Salon hours</p><p className="mt-2 text-sm font-medium">Saturday – Tuesday</p><p className="mt-1 text-xs text-[#9e978b]">9 AM – 4 PM · Maryland time</p><p className="mt-3 text-xs text-emerald-300">● Secure session active</p></div>
      </aside>
      <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-9">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d2b36b]/15 pb-6">
          <div className="flex items-center gap-3"><button className="rounded-lg border border-white/10 p-2 text-[#d2b36b] lg:hidden" onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?"Close menu":"Open menu"} aria-expanded={menuOpen} aria-controls="admin-preview-mobile-nav">☰</button><div><p className="text-[10px] uppercase tracking-[.25em] text-[#d2b36b]">First Class Styles · Private</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{active}</h1></div></div>
          <div className="flex items-center gap-2"><button onClick={()=>void load()} disabled={loading} className="min-h-10 rounded-xl border border-[#d2b36b]/35 px-3 py-2 text-sm text-[#e9ce8c] disabled:opacity-50">Refresh</button><button onClick={()=>void logout()} className="min-h-10 rounded-xl bg-[#d2b36b] px-3 py-2 text-sm font-semibold text-[#17110a]">Sign out</button></div>
        </header>
        {menuOpen && <nav id="admin-preview-mobile-nav" aria-label="Dashboard sections" className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-[#d2b36b]/20 bg-[#12100d] p-2 lg:hidden">{nav.map((item)=><button key={item} aria-current={active===item?"page":undefined} onClick={()=>{setActive(item);setMenuOpen(false);}} className={`rounded-lg p-3 text-left text-xs ${active===item?"bg-[#d2b36b]/15 text-[#f0d59a]":"text-[#b4aca0]"}`}>{item}</button>)}</nav>}
        {signedIn && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d2b36b]/15 bg-[#12100d] px-3 py-3"><p className="text-xs text-[#aaa49a]">Showing {appointments.length} appointment records{hasMore ? " · more history available" : " · all records loaded"}.</p>{hasMore && <button onClick={()=>void loadOlderAppointments()} disabled={loadingMore} className="min-h-10 rounded-lg border border-[#d2b36b]/30 px-3 py-2 text-xs text-[#e9ce8c] disabled:opacity-50">{loadingMore?"Loading…":"Load next 200 records"}</button>}</div>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-[#d2b36b]/25 bg-[#d2b36b]/10 p-3 text-sm text-[#f5dc9d]">{notice}</p>}
        {loading ? <div className="mt-8 rounded-2xl border border-white/10 bg-[#12100d] p-10 text-center text-[#aaa49a]">Loading your private salon records…</div> : <>
          {active==="Overview" && <>
            <div className="mt-6 rounded-2xl border border-[#d2b36b]/25 bg-gradient-to-r from-[#20190f] via-[#17130f] to-[#100e0b] p-5 sm:p-7"><p className="text-xs uppercase tracking-[.2em] text-[#d2b36b]">Your day, beautifully organized</p><h2 className="mt-2 text-xl font-semibold sm:text-2xl">Welcome back, Kemariah ✦</h2><p className="mt-2 text-sm text-[#b0a79a]">A live overview of your salon schedule and booking activity.</p><p className="mt-3 text-xs text-[#a69d90]">{new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date())} · Maryland local time</p></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metric("Today's appointments",String(todayAppointments.length),"Active bookings today")}{metric("Pending deposits",String(pending.length),money(pendingTotal)+" awaiting verification",true)}{metric("Confirmed appointments",String(confirmed.length),"Deposit verified")}{metric("Upcoming appointments",String(upcoming),"Future active bookings")}</div>
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]"><div className={shell}><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">Today's schedule</p><h2 className="mt-1 text-lg font-semibold">Appointments</h2>{todayAppointments.length? <div className="mt-4 space-y-2">{todayAppointments.map(a=><AppointmentCard key={a.id} a={a} onAction={act} busy={busy}/>)}</div>:<p className="mt-4 text-sm text-[#aaa49a]">No active appointments scheduled for today.</p>}</div><div className={shell}><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">Needs attention</p><h2 className="mt-1 text-lg font-semibold">Deposit verification</h2><p className="mt-3 text-3xl font-semibold text-[#e9ce8c]">{pending.length}</p><p className="text-xs text-[#91877c]">{money(pendingTotal)} awaiting manual verification</p><button onClick={()=>setActive("Deposits & Payments")} className="mt-4 rounded-lg border border-[#d2b36b]/30 px-3 py-2 text-sm text-[#e9ce8c]">Review deposits →</button></div></div>
          </>}
          {active==="Appointment Calendar" && <div className="mt-6"><AdminCalendar appointments={appointments}/></div>}
          {active==="Salon Closures" && <div className="mt-6"><AdminCalendar appointments={appointments}/></div>}
          {(active==="Booking Requests" || active==="Deposits & Payments") && <section className={`mt-6 ${shell}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">{active==="Booking Requests"?"Client requests":"Manual deposit review"}</p><h2 className="mt-1 text-lg font-semibold">{active}</h2></div><select aria-label="Filter appointments" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-[#d2b36b]/30 bg-[#080706] px-3 py-2 text-sm"><option value="all">All records</option><option value="pending">Deposit pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></div><input type="search" aria-label="Search appointments" placeholder="Search name, phone, email or service…" value={search} onChange={e=>setSearch(e.target.value)} className="mt-4 w-full rounded-xl border border-white/15 bg-[#080706] px-4 py-3 text-sm outline-none focus:border-[#d2b36b]"/><div className="mt-4 space-y-3">{filtered.filter(a=>active==="Deposits & Payments"?a.status!=="cancelled":true).map(a=><AppointmentCard key={a.id} a={a} onAction={act} busy={busy}/>) }{filtered.filter(a=>active==="Deposits & Payments"?a.status!=="cancelled":true).length===0&&<p className="py-8 text-center text-sm text-[#aaa49a]">No records match this view.</p>}</div></section>}
          {active==="Clients" && <section className={`mt-6 ${shell}`}><h2 className="text-lg font-semibold">Client directory</h2><p className="mt-1 text-xs text-[#91877c]">Based on the appointment records currently loaded.</p><div className="mt-4 space-y-3">{clients.map(c=><article key={c.phone} className="rounded-xl border border-white/10 bg-[#0a0908] p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{c.name}</strong><span className="text-xs text-[#d2b36b]">{c.visits} booking record(s)</span></div><div className="mt-2 flex flex-wrap gap-4 text-sm"><a className="text-[#e9ce8c] underline" href={"tel:"+c.phone}>{c.phone}</a>{c.email&&<a className="text-[#e9ce8c] underline" href={"mailto:"+c.email}>{c.email}</a>}</div><p className="mt-2 text-xs text-[#91877c]">Latest booking: {dateTime(c.latest)}</p></article>)}{clients.length===0&&<p className="py-8 text-sm text-[#aaa49a]">Client records will appear when bookings are received.</p>}</div></section>}
          {active==="Gallery Management" && <section className={`mt-6 ${shell}`}><h2 className="text-lg font-semibold">Salon photo gallery</h2><p className="mt-2 text-sm text-[#aaa49a]">These five original salon photographs have been reviewed and confirmed by you. They are the image files currently referenced by the public gallery. Upload and replacement controls are not connected yet, so the approved photos will remain unchanged.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{["gallery-straight-and-curls.jpg","gallery-twist-style.jpg","gallery-blonde-waves.jpg","gallery-curly-style.jpg","gallery-long-layers.jpg"].map((name,i)=><div key={name} className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0908]"><div className="aspect-[4/3] bg-[#17130f]"><img src={"/"+name} alt={`First Class Styles salon gallery photo ${i+1}`} loading="lazy" className="h-full w-full object-cover" onError={(event)=>{event.currentTarget.style.display="none";}} /></div><div className="p-3"><p className="text-xs text-[#d2b36b]">Gallery photo {i+1}</p><p className="mt-1 break-all text-xs text-[#c9c1b5]">{name}</p><p className="mt-1 text-xs text-[#91877c]">File present in website</p></div></div>)}</div><p className="mt-4 text-xs text-[#d4bd8b]">These five photographs are approved original salon assets. No stock or AI images are used as replacements.</p></section>}
          {active==="Settings" && <section className={`mt-6 ${shell}`}><h2 className="text-lg font-semibold">Salon booking settings</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Opening days","Saturday – Tuesday"],["Opening hours","9:00 AM – 4:00 PM"],["Minimum notice","24 hours"],["Daily booking cap","4 active appointments"],["Deposit","$25 non-refundable"],["Deposit methods","Zelle · Cash App · Apple Pay"],["Remaining balance","Cash at the salon"],["Confirmation rule","Confirmed only after deposit verification"]].map(([k,v])=><div key={k} className="rounded-xl border border-white/10 bg-[#0a0908] p-3"><p className="text-xs text-[#91877c]">{k}</p><p className="mt-1 text-sm font-medium">{v}</p></div>)}</div><p className="mt-4 text-xs text-[#91877c]">These are informational settings; editing controls are not enabled here.</p></section>}
        </>}
        <footer className="mt-8 border-t border-[#d2b36b]/10 pt-5 text-xs text-[#766d62]">First Class Styles · Private salon workspace · Secure admin session</footer>
      </section>
    </div>
    {menuOpen&&<div className="sr-only" aria-live="polite">Navigation menu opened</div>}
  </main>;
}

function Brand(){return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d2b36b]/35 bg-[#211a10] text-sm text-[#e4c477]">FC</div><div><p className="text-sm font-semibold tracking-wide">First Class Styles</p><p className="text-[10px] uppercase tracking-[.17em] text-[#8d8274]">Salon & Hair Spa</p></div></div>;}

function AppointmentCard({a,onAction,busy}:{a:Appointment;onAction:(id:string,action:"verify_deposit"|"reject_deposit"|"cancel")=>void;busy:string}){
 const statusLabel = a.status === "pending_payment" ? "Awaiting deposit" : a.status.replaceAll("_"," ");
 return <article className="rounded-xl border border-white/[.07] bg-[#0a0908] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{a.customer_name}</h3><p className="mt-1 text-sm text-[#d2b36b]">{a.service}</p><p className="mt-1 text-xs text-[#aaa49a]">{dateTime(a.starts_at)}</p></div><div className="flex flex-wrap gap-2 text-[10px]"><span className="rounded-full bg-white/10 px-3 py-1">{statusLabel}</span><span className={`rounded-full px-3 py-1 ${a.deposit_status==="verified"?"bg-emerald-400/10 text-emerald-200":a.deposit_status==="rejected"?"bg-red-400/10 text-red-200":"bg-amber-400/10 text-amber-100"}`}>Deposit {a.deposit_status}</span></div></div><div className="mt-3 grid gap-2 text-xs text-[#c9c1b5] sm:grid-cols-2"><p>Phone: <a href={"tel:"+a.customer_phone} className="text-[#e9ce8c] underline">{a.customer_phone}</a></p><p>Deposit: {money(a.deposit_amount)}</p>{a.customer_email&&<p className="break-all">Email: {a.customer_email}</p>}{a.customer_notes&&<p className="sm:col-span-2">Notes: {a.customer_notes}</p>}</div><div className="mt-4 flex flex-wrap gap-2">{a.deposit_status==="pending"&&a.status!=="cancelled"&&<><button disabled={busy===a.id} onClick={()=>onAction(a.id,"verify_deposit")} className="min-h-11 rounded-lg bg-[#d2b36b] px-3 py-2 text-xs font-bold text-[#17110a] disabled:opacity-50">Verify $25 & confirm</button><button disabled={busy===a.id} onClick={()=>onAction(a.id,"reject_deposit")} className="min-h-11 rounded-lg border border-amber-500/40 px-3 py-2 text-xs text-amber-200 disabled:opacity-50">Mark not received</button></>}{a.status!=="cancelled"&&<button disabled={busy===a.id} onClick={()=>onAction(a.id,"cancel")} className="min-h-11 rounded-lg border border-red-500/40 px-3 py-2 text-xs text-red-200 disabled:opacity-50">Cancel & release time</button>}</div></article>;
}
