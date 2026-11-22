"use client";

import { useEffect, useState } from "react";

const demoAppointments = [
  { time: "9:00 AM", name: "Sample Client A", service: "Signature Silk Press", duration: "2 hrs", status: "Confirmed", deposit: "Verified" },
  { time: "11:30 AM", name: "Sample Client B", service: "Loc Refresh", duration: "2 hrs", status: "Pending", deposit: "Awaiting" },
  { time: "2:00 PM", name: "Sample Client C", service: "Quick Weave", duration: "2 hrs 30 min", status: "Confirmed", deposit: "Verified" },
];

const nav = ["Overview", "Appointment Calendar", "Booking Requests", "Deposits & Payments", "Clients", "Gallery Management", "Salon Closures", "Settings"];

export default function AdminPreviewPage() {
  const [active, setActive] = useState("Overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [todayLabel, setTodayLabel] = useState("");
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const now = new Date();
    setTodayLabel(now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
    const hour = now.getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
  }, []);

  return (
    <main className="min-h-screen bg-[#090807] text-[#f6f1e8]">
      <div className="pointer-events-none fixed inset-0 opacity-[0.035]" style={{ backgroundImage: "radial-gradient(#e4c477 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
      <div className="relative flex min-h-screen">
        <aside className="hidden w-[248px] shrink-0 border-r border-[#c8a75c]/15 bg-[#0d0b09] p-6 lg:flex lg:flex-col">
          <Brand />
          <nav className="mt-10 space-y-1">
            {nav.map((item, i) => (
              <button key={item} onClick={() => setActive(item)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active === item ? "bg-[#d2b36b]/12 text-[#e9ce8c] ring-1 ring-[#d2b36b]/20" : "text-[#aaa49a] hover:bg-white/[0.035] hover:text-white"}`}>
                <span className="w-5 text-center text-xs text-[#d2b36b]">{["✦","▦","◷","◈","♙","▧","◌","⚙"][i]}</span>{item}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-2xl border border-[#d2b36b]/15 bg-[#17130f] p-4">
            <div className="text-[10px] uppercase tracking-[.18em] text-[#d2b36b]">Salon status</div>
            <p className="mt-2 text-sm font-medium">Open for bookings</p>
            <p className="mt-1 text-xs text-[#9e978b]">Sat – Tue · 9 AM–4 PM</p>
            <span className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Online</span>
          </div>
        </aside>

        <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-9">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d2b36b]/15 pb-6">
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-white/10 p-2 text-[#d2b36b] lg:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">☰</button>
              <div><p className="text-[10px] uppercase tracking-[.25em] text-[#d2b36b]">First Class Styles · Private</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{active}</h1></div>
            </div>
            <div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-medium">Salon Owner</p><p className="text-xs text-[#999187]">Administrator</p></div><div className="grid h-10 w-10 place-items-center rounded-full border border-[#d2b36b]/35 bg-[#211a10] text-[#e5c77e]">FC</div></div>
          </header>

          {menuOpen && <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-[#d2b36b]/20 bg-[#12100d] p-2 lg:hidden">{nav.map((item) => <button key={item} onClick={() => { setActive(item); setMenuOpen(false); }} className={`rounded-lg p-2 text-left text-xs ${active===item?"bg-[#d2b36b]/15 text-[#f0d59a]":"text-[#b4aca0]"}`}>{item}</button>)}</div>}

          {active === "Overview" ? <>
          {active === "Overview" ? <>
          <div className="mt-6 rounded-2xl border border-[#d2b36b]/25 bg-gradient-to-r from-[#20190f] via-[#17130f] to-[#100e0b] p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><p className="text-xs uppercase tracking-[.2em] text-[#d2b36b]">Your day, beautifully organized</p><h2 className="mt-2 text-xl font-semibold sm:text-2xl">{greeting}, Kemariah <span className="text-[#d2b36b]">✦</span></h2><p className="mt-2 max-w-xl text-sm text-[#b0a79a]">Here’s a calm overview of what’s happening in your salon today.</p></div>
              <div className="rounded-xl border border-[#d2b36b]/20 bg-black/20 px-4 py-3"><p className="text-xs text-[#a69d90]">Today · Demo preview</p><p className="mt-1 text-sm font-medium">{todayLabel || "Loading today"}</p></div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Today's appointments" value="03" sub="Your schedule today" icon="◷" />
            <Metric label="Pending deposits" value="02" sub="$50 awaiting verification" icon="◈" accent />
            <Metric label="Confirmed clients" value="02" sub="Ready for their visit" icon="✦" />
            <Metric label="Upcoming this week" value="08" sub="Appointments on the books" icon="▦" />
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
            <div className="rounded-2xl border border-[#d2b36b]/15 bg-[#12100d] p-4 sm:p-5">
              <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">Spotlight</p><h3 className="mt-1 text-lg font-semibold">Next client</h3></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">Deposit verified</span></div>
              <div className="mt-4 rounded-xl border border-[#d2b36b]/15 bg-[#0a0908] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs text-[#9d9488]">Demo time · Today</p><p className="mt-1 text-xl font-semibold">Sample Client A</p><p className="mt-1 text-sm text-[#d2b36b]">Signature Silk Press</p></div><div className="rounded-xl bg-[#d2b36b]/10 px-4 py-3 text-center"><p className="text-[10px] uppercase tracking-wider text-[#bca16b]">Demo countdown</p><p className="mt-1 text-lg font-semibold text-[#e9ce8c]">—</p></div></div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-white/[.035] p-3"><p className="text-[#91887c]">Duration</p><p className="mt-1 text-sm text-[#e9e2d5]">2 hours</p></div><div className="rounded-lg bg-white/[.035] p-3"><p className="text-[#91887c]">Deposit</p><p className="mt-1 text-sm text-emerald-200">$25 · Verified</p></div></div>
              </div>
              <p className="mt-3 text-xs text-[#91887c]">All names, counts, appointments, deposits, and chart values are fictional demo content.</p>
            </div>
            <div className="rounded-2xl border border-[#d2b36b]/15 bg-[#12100d] p-4 sm:p-5">
              <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">At a glance</p><h3 className="mt-1 text-lg font-semibold">Booking activity</h3></div><span className="text-xs text-[#8e857a]">Demo week</span></div>
              <div className="mt-5 flex h-32 items-end gap-2">{[36,58,45,82,64,96,52].map((v,i)=><div key={i} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-md bg-gradient-to-t from-[#927239] to-[#d2b36b]" style={{height:`${v}%`}}/><span className="text-[10px] text-[#8e857a]">{["S","M","T","W","T","F","S"][i]}</span></div>)}</div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#d2b36b]/5 p-3"><span className="text-xs text-[#aaa095]">Weekly bookings</span><span className="text-sm font-semibold text-[#e9ce8c]">Demo trend ↗</span></div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-[#d2b36b]/15 bg-[#12100d] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-[.17em] text-[#d2b36b]">Schedule</p><h3 className="mt-1 text-lg font-semibold">Today's appointments</h3></div><button onClick={() => setActive("Appointment Calendar")} className="rounded-lg border border-[#d2b36b]/25 px-3 py-2 text-xs text-[#d2b36b] hover:bg-[#d2b36b]/10">View calendar →</button></div>
            <div className="mt-4 space-y-3">{demoAppointments.map((a,i)=><div key={a.name} className="grid gap-3 rounded-xl border border-white/[.06] bg-[#0a0908] p-3 sm:grid-cols-[90px_1fr_auto] sm:items-center sm:p-4"><div className="text-sm font-medium text-[#d2b36b]">{a.time}</div><div><p className="font-medium">{a.name}</p><p className="mt-1 text-xs text-[#a39a8d]">{a.service} · {a.duration}</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] ${a.status==="Confirmed"?"bg-emerald-400/10 text-emerald-200":"bg-amber-400/10 text-amber-200"}`}>{a.status}</span><span className="rounded-full bg-white/[.04] px-2.5 py-1 text-[10px] text-[#bdb3a6]">{a.deposit}</span></div></div>)}</div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <QuickAction title="Review requests" description="Check new booking requests" onClick={()=>setActive("Booking Requests")} />
            <QuickAction title="Verify deposits" description="Confirm payment receipts" onClick={()=>setActive("Deposits & Payments")} />
            <QuickAction title="Manage closures" description="Set days off or vacation" onClick={()=>setActive("Salon Closures")} />
          </div>
          </> : <PreviewModule active={active} todayLabel={todayLabel} />}

          </> : <PreviewModule active={active} todayLabel={todayLabel} />}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[#d2b36b]/10 pt-5 text-xs text-[#766d62]"><span>First Class Styles · Salon & Hair Spa</span><span>Luxury Command Center · Preview concept</span></footer>
        </section>
      </div>
      <div className="fixed bottom-3 right-3 z-20 rounded-full border border-amber-300/20 bg-[#20180c]/95 px-3 py-1.5 text-[10px] uppercase tracking-wider text-[#e8ca86] shadow-lg backdrop-blur">Preview mode · demo data</div>
    </main>
  );
}

function Brand() {
  return <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-[#d2b36b]/35 bg-[#211a10] text-sm text-[#e4c477]">FC</div><div><p className="text-sm font-semibold tracking-wide">First Class Styles</p><p className="text-[10px] uppercase tracking-[.17em] text-[#8d8274]">Salon & Hair Spa</p></div></div>;
}
function Metric({label,value,sub,icon,accent}:{label:string;value:string;sub:string;icon:string;accent?:boolean}) {
  return <div className={`rounded-2xl border p-4 sm:p-5 ${accent?"border-[#d2b36b]/35 bg-[#1b150d]":"border-[#d2b36b]/12 bg-[#12100d]"}`}><div className="flex items-center justify-between"><p className="text-xs text-[#a59b8e]">{label}</p><span className="text-[#d2b36b]">{icon}</span></div><p className={`mt-3 text-3xl font-semibold tracking-tight ${accent?"text-[#e9ce8c]":"text-[#f3eee4]"}`}>{value}</p><p className="mt-1 text-xs text-[#8f8579]">{sub}</p></div>;
}
function QuickAction({title,description,onClick}:{title:string;description:string;onClick:()=>void}) {
  return <button onClick={onClick} className="rounded-2xl border border-[#d2b36b]/12 bg-[#12100d] p-4 text-left transition hover:border-[#d2b36b]/30 hover:bg-[#19140e]"><p className="text-sm font-medium text-[#e5c77e]">{title} ↗</p><p className="mt-1 text-xs text-[#91877b]">{description}</p></button>;
}

function PreviewModule({active,todayLabel}:{active:string;todayLabel:string}) {
 const panel="rounded-2xl border border-[#d2b36b]/15 bg-[#12100d] p-4 sm:p-5";
 const demo="rounded-xl border border-white/[.06] bg-[#0a0908] p-3";
 return <div className="mt-6 space-y-4">
  <div className="rounded-2xl border border-[#d2b36b]/20 bg-gradient-to-r from-[#20190f] to-[#100e0b] p-5"><p className="text-xs uppercase tracking-[.2em] text-[#d2b36b]">Demo workspace</p><h2 className="mt-2 text-xl font-semibold">{active}</h2><p className="mt-1 text-sm text-[#a99f93]">Preview only · No live data or actions connected.</p></div>
  {active==="Appointment Calendar"&&<div className={panel}><h3 className="font-semibold">November 2026 · Sample calendar</h3><div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="py-2 text-[#8e857a]">{d}</div>)}{Array.from({length:35},(_,i)=>{const day=i-5;return <div key={i} className={`min-h-12 rounded-lg p-1 text-left ${day>0&&day<=30?"bg-white/[.025] text-[#e7dfd2]":"text-[#665d53]"}`}>{day>0&&day<=30?day:""}{[3,7,11,15,19,24].includes(day)&&<span className="mt-1 block rounded bg-[#d2b36b]/15 px-1 text-[8px] text-[#d2b36b]">Demo appt</span>}</div>})}</div></div>}
  {active==="Booking Requests"&&<div className={panel}><h3 className="font-semibold">Fictional booking requests</h3><div className="mt-3 space-y-2">{demoAppointments.map(x=><div key={x.name} className={demo}><p className="font-medium">{x.name} · {x.status}</p><p className="mt-1 text-sm text-[#d2b36b]">{x.service}</p><p className="text-xs text-[#91877c]">{x.time} · {x.duration}</p></div>)}</div></div>}
  {active==="Deposits & Payments"&&<div className={panel}><h3 className="font-semibold">Deposit snapshot · sample figures</h3><div className="mt-3 grid grid-cols-2 gap-3"><div className={demo}><p className="text-xs text-[#9d9488]">Awaiting</p><p className="mt-1 text-xl text-[#e8ca86]">$50</p></div><div className={demo}><p className="text-xs text-[#9d9488]">Verified</p><p className="mt-1 text-xl text-emerald-200">$50</p></div></div><p className="mt-3 text-xs text-[#93897d]">Payments cannot be verified or processed here.</p></div>}
  {active==="Clients"&&<div className={panel}><h3 className="font-semibold">Sample client list</h3><div className="mt-3 space-y-2">{demoAppointments.map(x=><div key={x.name} className={demo}><p className="font-medium">{x.name}</p><p className="mt-1 text-xs text-[#91877c]">Service: {x.service} · Demo profile</p></div>)}</div></div>}
  {active==="Gallery Management"&&<div className={panel}><h3 className="font-semibold">Gallery slots · visual mockup</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{["01","02","03"].map(n=><div key={n} className="aspect-square rounded-xl border border-dashed border-[#d2b36b]/25 bg-[#0a0908] p-3 flex flex-col justify-end"><p className="text-xs text-[#d2b36b">Slot {n}</p><p className="text-[10px] text-[#91877c]">No image attached</p></div>)}</div></div>}
  {active==="Salon Closures"&&<div className={panel}><h3 className="font-semibold">Salon availability pattern</h3><div className="mt-3 grid grid-cols-2 gap-3"><div className={demo}><p className="text-xs text-[#91877c]">Booking days</p><p className="mt-1 text-emerald-200">Saturday–Tuesday</p></div><div className={demo}><p className="text-xs text-[#91877c]">Closed</p><p className="mt-1 text-amber-200">Wednesday–Friday</p></div></div><p className="mt-3 text-xs text-[#93897d]">Date controls are not connected in this demo.</p></div>}
  {active==="Settings"&&<div className={panel}><h3 className="font-semibold">Settings · preview</h3><div className="mt-3 space-y-2">{[["Hours","Sat–Tue · 9 AM–4 PM"],["Booking lead time","24 hours minimum"],["Deposit","$25 non-refundable"],["Preview date",todayLabel]].map(([k,v])=><div key={k} className={demo}><p className="text-xs text-[#91877c]">{k}</p><p className="mt-1">{v}</p></div>)}</div></div>}
 </div>;
}

function PreviewModule({active,todayLabel}:{active:string;todayLabel:string}) {
 const card="rounded-2xl border border-[#d2b36b]/15 bg-[#12100d] p-4 sm:p-5";
 const demo="rounded-xl border border-white/[.06] bg-[#0a0908] p-3";
 return <div className="mt-6 space-y-4">
 <div className="rounded-2xl border border-[#d2b36b]/20 bg-gradient-to-r from-[#20190f] to-[#100e0b] p-5"><p className="text-xs uppercase tracking-[.2em] text-[#d2b36b]">Demo workspace</p><h2 className="mt-2 text-xl font-semibold">{active}</h2><p className="mt-1 text-sm text-[#a99f93]">Preview only · No live salon data or actions connected.</p></div>
 {active==="Appointment Calendar"&&<div className={card}><h3 className="font-semibold">November 2026 · Sample calendar</h3><div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} className="py-2 text-[#8e857a]">{d}</div>)}{Array.from({length:35},(_,i)=>{const day=i-5;return <div key={i} className={`min-h-12 rounded-lg p-1 text-left ${day>0&&day<=30?"bg-white/[.025] text-[#e7dfd2]":"text-[#665d53"}`}>{day>0&&day<=30?day:""}{[3,7,11,15,19,24].includes(day)&&<span className="mt-1 block rounded bg-[#d2b36b]/15 px-1 text-[8px] text-[#d2b36b]">Demo appt</span>}</div>})}</div></div>}
 {active==="Booking Requests"&&<div className={card}><h3 className="font-semibold">Fictional booking requests</h3><div className="mt-3 space-y-2">{demoAppointments.map(x=><div key={x.name} className={demo}><p className="font-medium">{x.name} · {x.status}</p><p className="mt-1 text-sm text-[#d2b36b]">{x.service}</p><p className="text-xs text-[#91877c]">{x.time} · {x.duration}</p></div>)}</div></div>}
 {active==="Deposits & Payments"&&<div className={card}><h3 className="font-semibold">Deposit snapshot · sample figures</h3><div className="mt-3 grid grid-cols-2 gap-3"><div className={demo}><p className="text-xs text-[#9d9488]">Awaiting</p><p className="mt-1 text-xl text-[#e8ca86]">$50</p></div><div className={demo}><p className="text-xs text-[#9d9488]">Verified</p><p className="mt-1 text-xl text-emerald-200">$50</p></div></div><p className="mt-3 text-xs text-[#93897d]">Payments cannot be verified or processed here.</p></div>}
 {active==="Clients"&&<div className={card}><h3 className="font-semibold">Sample client list</h3><div className="mt-3 space-y-2">{demoAppointments.map(x=><div key={x.name} className={demo}><p className="font-medium">{x.name}</p><p className="mt-1 text-xs text-[#91877c]">Service: {x.service} · Demo profile</p></div>)}</div></div>}
 {active==="Gallery Management"&&<div className={card}><h3 className="font-semibold">Gallery slots · visual mockup</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{["01","02","03"].map(n=><div key={n} className="aspect-square rounded-xl border border-dashed border-[#d2b36b]/25 bg-[#0a0908] p-3 flex flex-col justify-end"><p className="text-xs text-[#d2b36b">Slot {n}</p><p className="text-[10px] text-[#91877c]">No image attached</p></div>)}</div></div>}
 {active==="Salon Closures"&&<div className={card}><h3 className="font-semibold">Salon availability pattern</h3><div className="mt-3 grid grid-cols-2 gap-3"><div className={demo}><p className="text-xs text-[#91877c]">Booking days</p><p className="mt-1 text-emerald-200">Saturday–Tuesday</p></div><div className={demo}><p className="text-xs text-[#91877c]">Closed</p><p className="mt-1 text-amber-200">Wednesday–Friday</p></div></div><p className="mt-3 text-xs text-[#93897d]">Date controls are not connected in this demo.</p></div>}
 {active==="Settings"&&<div className={card}><h3 className="font-semibold">Settings · preview</h3><div className="mt-3 space-y-2">{[["Hours","Sat–Tue · 9 AM–4 PM"],["Booking lead time","24 hours minimum"],["Deposit","$25 non-refundable"],["Preview date",todayLabel]].map(([k,v])=><div key={k} className={demo}><p className="text-xs text-[#91877c]">{k}</p><p className="mt-1">{v}</p></div>)}</div></div>}
 </div>;
}
