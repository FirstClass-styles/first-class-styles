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


  const demoAppointments = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
    const get = (t:string) => parts.find(x=>x.type===t)?.value || "01";
    const base = new Date(Number(get("year")),Number(get("month"))-1,Number(get("day")));
    const at = (n:number,h:number,m=0) => { const d=new Date(Date.UTC(base.getFullYear(),base.getMonth(),base.getDate()+n,h+5,m,0,0)); return d.toISOString(); };
    return [
      {id:"demo-01",customer_name:"Taylor Morgan",customer_phone:"(202) 555-0101",customer_email:"taylor@example.test",service:"Signature Silk Press",starts_at:at(1,10),ends_at:at(1,12),status:"pending_payment",deposit_amount:25,deposit_status:"pending",customer_notes:"Sample note only.",created_at:at(0,9)},
      {id:"demo-02",customer_name:"Avery Brooks",customer_phone:"(202) 555-0102",customer_email:"avery@example.test",service:"Loc Refresh",starts_at:at(2,9),ends_at:at(2,11),status:"confirmed",deposit_amount:25,deposit_status:"verified",customer_notes:null,created_at:at(0,10)},
      {id:"demo-03",customer_name:"Jordan Ellis",customer_phone:"(202) 555-0103",customer_email:null,service:"Quick Weave",starts_at:at(3,13),ends_at:at(3,15,30),status:"pending_payment",deposit_amount:25,deposit_status:"pending",customer_notes:null,created_at:at(0,11)},
      {id:"demo-04",customer_name:"Casey Reed",customer_phone:"(202) 555-0104",customer_email:"casey@example.test",service:"Signature Shampoo & Blow Dry",starts_at:at(4,11),ends_at:at(4,11,45),status:"cancelled",deposit_amount:25,deposit_status:"rejected",customer_notes:"Cancelled sample.",created_at:at(-1,12)}
    ] as Appointment[];
  }, []);
  const [active,setActive]=useState<Section>("Overview");
  const [menuOpen,setMenuOpen]=useState(false);
  const [password,setPassword]=useState("");
  const [signedIn,setSignedIn]=useState(true);
  const [appointments,setAppointments]=useState<Appointment[]>(demoAppointments);
  const [hasMore,setHasMore]=useState(false);
  const [nextOffset,setNextOffset]=useState(0);
  const [loadingMore,setLoadingMore]=useState(false);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("Demo dashboard loaded with fictional records only.");
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [clientSearch,setClientSearch]=useState("");
  const load=useCallback(async()=>{setError("");setLoading(false);setAppointments(demoAppointments);setNotice("Preview refreshed. All sample records are local and fictional.");},[demoAppointments]);


  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  async function loadOlderAppointments() { setNotice("Demo contains a fixed sample set; no live history is loaded."); }

  async function signIn(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setSignedIn(true); setPassword(""); setNotice("Preview access opened locally. No real admin credentials are checked."); }

  async function logout() { setSignedIn(false); setNotice("Demo session closed locally."); }

  async function act(id: string, action: "verify_deposit" | "reject_deposit" | "cancel") {
    const labels = {verify_deposit:"Confirm sample deposit and appointment?",reject_deposit:"Mark sample deposit not received and cancel?",cancel:"Cancel sample appointment?"};
    if(!window.confirm(labels[action])) return;
    setBusy(id);
    setAppointments(current=>current.map(a=>a.id!==id?a: action==="verify_deposit"?{...a,status:"confirmed",deposit_status:"verified"}:{...a,status:"cancelled",deposit_status:action==="reject_deposit"?"rejected":a.deposit_status}));
    setNotice(action==="verify_deposit"?"Sample deposit verified; demo appointment confirmed.":action==="reject_deposit"?"Sample deposit rejected; demo booking cancelled.":"Sample appointment cancelled locally. No time slot or live record was changed.");
    setBusy("");
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

  const filteredClients = clients.filter((client) => {
    const term = clientSearch.trim().toLowerCase();
    return !term || [client.name, client.phone, client.email || ""].some((value) => value.toLowerCase().includes(term));
  });

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
      <Brand /><p className="mt-8 text-xs uppercase tracking-[.2em] text-[#d2b36b]">DEMO · SAMPLE DATA · NO LIVE RECORDS</p>
      <h1 className="mt-2 text-2xl font-semibold">Sign in to continue</h1>
      <p className="mt-2 text-sm text-[#aaa49a]">This is a demo-only dashboard. No password or live records are used.</p>
      <button type="button" onClick={()=>setSignedIn(true)} className="mt-6 w-full rounded-xl bg-[#d2b36b] px-4 py-3 font-semibold text-[#17110a]">Enter demo dashboard</button>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      <a href="/admin" className="mt-5 inline-block text-sm text-[#d2b36b] underline">Open original admin dashboard</a>
      <p className="mt-6 text-xs text-[#82796e]">Demo mode only: sample data, local actions, no live records.</p>
    </div>
  </main>;

  return <main className="min-h-screen bg-[#090807] text-[#f6f1e8]">
    <div className="relative flex min-h-screen">
      <aside className="hidden w-[248px] shrink-0 border-r border-[#c8a75c]/15 bg-[#0d0b09] p-6 lg:flex lg:flex-col">
        <Brand /><nav aria-label="Dashboard sections" className="mt-10 space-y-1">{nav.map((item,i)=><button key={item} aria-current={active===item?"page":undefined} onClick={()=>setActive(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#d2b36b] ${active===item?"bg-[#d2b36b]/12 text-[#e9ce8c] ring-1 ring-[#d2b36b]/20":"text-[#aaa49a] hover:bg-white/[.035] hover:text-white"}`}><span className="w-5 text-center text-xs text-[#d2b36b]">{["✦","▦","◷","◈","♙","▧","◌","⚙"][i]}</span>{item}</button>)}</nav>
        <div className="mt-auto rounded-2xl border border-[#d2b36b]/15 bg-[#17130f] p-4"><p className="text-[10px] uppercase tracking-[.18em] text-[#d2b36b]">Salon hours</p><p className="mt-2 text-sm font-medium">Saturday – Tuesday</p><p className="mt-1 text-xs text-[#9e978b]">9 AM – 4 PM · Maryland time</p><p className="mt-3 text-xs text-emerald-300">● Demo session active</p></div>
      </aside>
      <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-9">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d2b36b]/15 pb-6">
          <div className="flex items-center gap-3"><button className="rounded-lg border border-white/10 p-2 text-[#d2b36b] lg:hidden" onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?"Close menu":"Open menu"} aria-expanded={menuOpen} aria-controls="admin-preview-mobile-nav">☰</button><div><p className="text-[10px] uppercase tracking-[.25em] text-[#d2b36b]">First Class Styles · Demo Preview</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{active}</h1></div></div>
          <div className="flex items-center gap-2"><button onClick={()=>void load()} disabled={loading} className="min-h-10 rounded-xl border border-[#d2b36b]/35 px-3 py-2 text-sm text-[#e9ce8c] disabled:opacity-50">Refresh</button><button onClick={()=>void logout()} className="min-h-10 rounded-xl bg-[#d2b36b] px-3 py-2 text-sm font-semibold text-[#17110a]">Sign out</button></div>
        </header>
        {menuOpen && <nav id="admin-preview-mobile-nav" aria-label="Dashboard sections" className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-[#d2b36b]/20 bg-[#12100d] p-2 lg:hidden">{nav.map((item)=><button key={item} aria-current={active===item?"page":undefined} onClick={()=>{setActive(item);setMenuOpen(false);}} className={`rounded-lg p-3 text-left text-xs ${active===item?"bg-[#d2b36b]/15 text-[#f0d59a]":"text-[#b4aca0]"}`}>{item}</button>)}</nav>}
        {signedIn && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d2b36b]/15 bg-[#12100d] px-3 py-3"><p className="text-xs text-[#aaa49a]">DEMO DATA ONLY · {appointments.length} fictional appointment records. No live records.</p>{hasMore && <button onClick={()=>void loadOlderAppointments()} disabled={loadingMore} className="min-h-10 rounded-lg border border-[#d2b36b]/30 px-3 py-2 text-xs text-[#e9ce8c] disabled:opacity-50">{loadingMore?"Loading…":"Load next 200 records"}</button>}</div>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-xl border border-[#d2b36b]/25 bg-[#d2b36b]/10 p-3 text-sm text-[#f5dc9d]">{notice}</p>}
        {loading ? <div className="mt-8 rounded-2xl border border-white/10 bg-[#12100d] p-10 text-center text-[#aaa49a]">Loading your private salon records…</div> : <>
          {active==="Overview" && <>
            <div className="mt-6 rounded-2xl border border-[#d2b36b]/25 bg-gradient-to-r from-[#20190f] via-[#17130f] to-[#100e0b] p-5 sm:p-7"><p className="text-xs uppercase tracking-[.2em] text-[#d2b36b]">Your day, beautifully organized</p><h2 className="mt-2 text-xl font-semibold sm:text-2xl">Welcome back, Kemariah ✦</h2><p className="mt-2 text-sm text-[#b0a79a]">A sample overview of your salon schedule and booking activity.</p><p className="mt-3 text-xs text-[#a69d90]">{new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric",year:"numeric"}).format(new Date())} · Maryland local time</p></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metric("Today's appointments",String(todayAppointments.length),"From currently loaded records")}{metric("Pending deposits",String(pending.length),money(pendingTotal)+" awaiting verification",true)}{metric("Confirmed appointments",String(confirmed.length),"In currently loaded records")}{metric("Upcoming appointments",String(upcoming),"In currently loaded records")}</div>
            <div className="mt-5 grid gap-4 xl:grid-cols-[1.4fr_1fr]"><div className={shell}><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">Today's schedule</p><h2 className="mt-1 text-lg font-semibold">Appointments</h2>{todayAppointments.length? <div className="mt-4 space-y-2">{todayAppointments.map(a=><AppointmentCard key={a.id} a={a} onAction={act} busy={busy}/>)}</div>:<p className="mt-4 text-sm text-[#aaa49a]">No active appointments scheduled for today.</p>}</div><div className={shell}><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">Needs attention</p><h2 className="mt-1 text-lg font-semibold">Deposit verification</h2><p className="mt-3 text-3xl font-semibold text-[#e9ce8c]">{pending.length}</p><p className="text-xs text-[#91877c]">{money(pendingTotal)} awaiting manual verification</p><button onClick={()=>setActive("Deposits & Payments")} className="mt-4 rounded-lg border border-[#d2b36b]/30 px-3 py-2 text-sm text-[#e9ce8c]">Review deposits →</button></div></div>
          </>}
          {active==="Appointment Calendar" && <div className="mt-6"><AdminCalendar appointments={appointments} previewMode/></div>}
          {active==="Salon Closures" && <div className="mt-6"><AdminCalendar appointments={appointments} mode="closures" previewMode/></div>}
          {(active==="Booking Requests" || active==="Deposits & Payments") && <section className={`mt-6 ${shell}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">{active==="Booking Requests"?"Client requests":"Manual deposit review"}</p><h2 className="mt-1 text-lg font-semibold">{active}</h2></div><select aria-label="Filter appointments" value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-lg border border-[#d2b36b]/30 bg-[#080706] px-3 py-2 text-sm"><option value="all">All records</option><option value="pending">Deposit pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></div><input type="search" aria-label="Search appointments" placeholder="Search name, phone, email or service…" value={search} onChange={e=>setSearch(e.target.value)} className="mt-4 w-full rounded-xl border border-white/15 bg-[#080706] px-4 py-3 text-sm outline-none focus:border-[#d2b36b]"/><div className="mt-4 space-y-3">{filtered.filter(a=>active==="Deposits & Payments"?a.status!=="cancelled":true).map(a=><AppointmentCard key={a.id} a={a} onAction={act} busy={busy}/>) }{filtered.filter(a=>active==="Deposits & Payments"?a.status!=="cancelled":true).length===0&&<p className="py-8 text-center text-sm text-[#aaa49a]">No records match this view.</p>}</div></section>}
          {active==="Clients" && <section className={`mt-6 ${shell}`}><h2 className="text-lg font-semibold">Client directory</h2><p className="mt-1 text-xs text-[#91877c]">Based on the appointment records currently loaded ({clients.length} clients).</p><input type="search" aria-label="Search clients" placeholder="Search client name, phone or email…" value={clientSearch} onChange={e=>setClientSearch(e.target.value)} className="mt-4 w-full rounded-xl border border-white/15 bg-[#080706] px-4 py-3 text-sm outline-none focus:border-[#d2b36b]"/><div className="mt-4 space-y-3">{filteredClients.map(c=><article key={c.phone} className="rounded-xl border border-white/10 bg-[#0a0908] p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{c.name}</strong><span className="text-xs text-[#d2b36b]">{c.visits} booking record(s)</span></div><div className="mt-2 flex flex-wrap gap-4 text-sm"><a className="text-[#e9ce8c] underline" href={"tel:"+c.phone}>{c.phone}</a>{c.email&&<a className="text-[#e9ce8c] underline" href={"mailto:"+c.email}>{c.email}</a>}</div><p className="mt-2 text-xs text-[#91877c]">Latest booking: {dateTime(c.latest)}</p></article>)}{filteredClients.length===0&&<p className="py-8 text-sm text-[#aaa49a]">{clients.length===0?"Client records will appear when bookings are received.":"No clients match your search."}</p>}</div></section>}
          {active==="Gallery Management" && <section className={`mt-6 ${shell}`}><h2 className="text-lg font-semibold">Salon photo gallery</h2><p className="mt-2 text-sm text-[#aaa49a]">These five original salon photographs have been reviewed and confirmed by you. They are the image files currently referenced by the public gallery. Upload and replacement controls are not connected yet, so the approved photos will remain unchanged.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{["gallery-straight-and-curls.jpg","gallery-twist-style.jpg","gallery-blonde-waves.jpg","gallery-curly-style.jpg","gallery-long-layers.jpg"].map((name,i)=><div key={name} className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0908]"><div className="aspect-[4/3] bg-[#17130f]"><img src={"/"+name} alt={`First Class Styles salon gallery photo ${i+1}`} loading="lazy" className="h-full w-full object-cover" onError={(event)=>{event.currentTarget.style.display="none";}} /></div><div className="p-3"><p className="text-xs text-[#d2b36b]">Gallery photo {i+1}</p><p className="mt-1 break-all text-xs text-[#c9c1b5]">{name}</p><p className="mt-1 text-xs text-[#91877c]">Original photo · approved</p></div></div>)}</div><p className="mt-4 text-xs text-[#d4bd8b]">These five photographs are approved original salon assets. No stock or AI images are used as replacements.</p></section>}
          {active==="Settings" && <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <section className={shell}><p className="text-[10px] uppercase tracking-[.18em] text-[#d2b36b]">Business profile</p><h2 className="mt-1 text-lg font-semibold">First Class Styles – Salon & Hair Spa</h2><p className="mt-2 text-sm text-[#aaa49a]">3813 Old Silver Hill Rd, Suitland, MD 20746</p><div className="mt-4 flex flex-wrap gap-3 text-sm"><a className="text-[#e9ce8c] underline" href="tel:+12403701128">Call salon</a><a className="text-[#e9ce8c] underline" href="https://wa.me/12403701128" target="_blank" rel="noreferrer">WhatsApp</a><a className="text-[#e9ce8c] underline" href="mailto:firstclass.styles1@gmail.com">Email</a><a className="text-[#e9ce8c] underline" href="https://www.google.com/maps/search/?api=1&query=3813+Old+Silver+Hill+Rd+Suitland+MD+20746" target="_blank" rel="noreferrer">Open map</a></div><div className="mt-4 overflow-hidden rounded-xl border border-white/10"><iframe title="First Class Styles salon location map" src="https://www.google.com/maps?q=3813+Old+Silver+Hill+Rd,+Suitland,+MD+20746&output=embed" className="h-52 w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade"/></div><p className="mt-3 text-xs text-[#91877c]">Contact and location details shown here are the current published business information.</p></section>
            <section className={shell}><p className="text-[10px] uppercase tracking-[.18em] text-[#d2b36b]">Booking policy</p><h2 className="mt-1 text-lg font-semibold">Appointments & payments</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Opening days","Saturday – Tuesday"],["Opening hours","9:00 AM – 4:00 PM"],["Closed days","Wednesday – Friday"],["Minimum notice","24 hours"],["Daily booking cap","4 active appointments"],["Deposit","$25 non-refundable"],["Deposit methods","Zelle · Cash App · Apple Pay"],["Remaining balance","Cash at the salon"],["Confirmation rule","Confirmed only after deposit verification"]].map(([k,v])=><div key={k} className="rounded-xl border border-white/10 bg-[#0a0908] p-3"><p className="text-xs text-[#91877c]">{k}</p><p className="mt-1 text-sm font-medium">{v}</p></div>)}</div><p className="mt-4 text-xs text-[#91877c]">These details are currently read-only. Changing business policies here is disabled so this dashboard cannot accidentally change the live booking rules.</p></section>
          </div>}
        </>}
        <footer className="mt-8 border-t border-[#d2b36b]/10 pt-5 text-xs text-[#766d62]">First Class Styles · DEMO preview · fictional sample data</footer>
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
