import React, { useState, useMemo } from "react";
import { Lead, Vehicle } from "../types";
import { Calendar, Car, Eye, Clock, Plus, Check, X, AlertCircle, ChevronLeft, ChevronRight, User, Phone, MessageCircle, RefreshCw } from "lucide-react";

interface Props {
  leads: Lead[];
  vehicles: Vehicle[];
  onUpdateLead: (id: string, updates: Partial<Lead>) => void;
}

type ViewMode = "week" | "day" | "list";

interface Booking {
  lead: Lead;
  vehicle: Vehicle | undefined;
  drive: NonNullable<Lead["testDrives"]>[0];
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 07:00 – 18:00

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDates(ref: Date): Date[] {
  const d = new Date(ref);
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return dd;
  });
}

const outcomeColors: Record<string, string> = {
  completed: "text-emerald-400 bg-emerald-500/10",
  no_show: "text-red-400 bg-red-500/10",
  cancelled: "text-[rgba(232,234,230,0.45)] bg-white/5",
  rescheduled: "text-amber-400 bg-amber-500/10",
};

export default function TestDriveCalendar({ leads, vehicles, onUpdateLead }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [refDate, setRefDate] = useState(new Date());
  const [showBooking, setShowBooking] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // New booking form
  const [bookLeadId, setBookLeadId] = useState("");
  const [bookType, setBookType] = useState<"test_drive" | "viewing" | "trade_in">("test_drive");
  const [bookDate, setBookDate] = useState("");
  const [bookTime, setBookTime] = useState("09:00");
  const [bookDuration, setBookDuration] = useState(30);
  const [bookNotes, setBookNotes] = useState("");

  const allBookings = useMemo<Booking[]>(() => {
    const result: Booking[] = [];
    for (const lead of leads) {
      if (!lead.testDrives?.length) continue;
      const vehicle = vehicles.find(v => v.id === lead.vehicleId);
      for (const drive of lead.testDrives) {
        result.push({ lead, vehicle, drive });
      }
    }
    result.sort((a, b) => new Date(a.drive.scheduledAt).getTime() - new Date(b.drive.scheduledAt).getTime());
    return result;
  }, [leads, vehicles]);

  const weekDates = useMemo(() => getWeekDates(refDate), [refDate]);

  const todayBookings = allBookings.filter(b => isSameDay(new Date(b.drive.scheduledAt), new Date()));
  const upcomingCount = allBookings.filter(b => new Date(b.drive.scheduledAt) >= new Date() && !b.drive.outcome).length;
  const completedCount = allBookings.filter(b => b.drive.outcome === "completed").length;
  const noShowCount = allBookings.filter(b => b.drive.outcome === "no_show").length;

  const navigate = (dir: number) => {
    const d = new Date(refDate);
    if (viewMode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setRefDate(d);
  };

  const handleBook = () => {
    if (!bookLeadId || !bookDate || !bookTime) return;
    const lead = leads.find(l => l.id === bookLeadId);
    if (!lead) return;
    const scheduledAt = new Date(`${bookDate}T${bookTime}`).toISOString();
    const newDrive = {
      id: "td_" + Date.now(),
      type: bookType,
      scheduledAt,
      duration: bookDuration,
      notes: bookNotes || undefined,
    };
    const existing = lead.testDrives || [];
    onUpdateLead(lead.id, {
      testDrives: [...existing, newDrive],
      status: lead.status === "New" || lead.status === "Contacted" ? "Test Drive Scheduled" : lead.status,
      nextAction: bookType === "test_drive" ? "Test drive" : bookType === "trade_in" ? "Trade-in appraisal" : "Viewing",
      nextActionAt: scheduledAt,
    });
    setShowBooking(false);
    setBookLeadId("");
    setBookDate("");
    setBookTime("09:00");
    setBookNotes("");
  };

  const markOutcome = (booking: Booking, outcome: "completed" | "no_show" | "cancelled") => {
    const lead = booking.lead;
    const updated = (lead.testDrives || []).map(td =>
      td.id === booking.drive.id ? { ...td, outcome, completedAt: outcome === "completed" ? new Date().toISOString() : undefined } : td
    );
    const nextStatus = outcome === "completed" && lead.status === "Test Drive Scheduled" ? "Negotiating" as const : undefined;
    onUpdateLead(lead.id, {
      testDrives: updated,
      ...(nextStatus ? { status: nextStatus } : {}),
    });
    setSelectedBooking(null);
  };

  const activeLeads = leads.filter(l => l.status !== "Closed Won" && l.status !== "Closed Lost");

  const renderBookingCard = (b: Booking, compact = false) => {
    const isTestDrive = b.drive.type === "test_drive";
    const isPast = new Date(b.drive.scheduledAt) < new Date();
    const source = b.lead.source;
    const isWidget = source === "Website" || source === "Widget" || source === "Chat Bot";

    return (
      <div
        key={b.drive.id}
        onClick={() => setSelectedBooking(b)}
        className={`rounded-lg border p-2 cursor-pointer transition hover:border-[color:var(--cyan)]/30 ${
          b.drive.outcome
            ? "border-white/5 opacity-60"
            : isPast
            ? "border-amber-500/20 bg-amber-500/5"
            : "border-white/10 bg-[color:var(--glass)]"
        }`}
      >
        <div className="flex items-center gap-1.5">
          {b.drive.type === "test_drive"
            ? <Car size={12} className="text-[color:var(--cyan)]" />
            : b.drive.type === "trade_in"
            ? <RefreshCw size={12} className="text-emerald-400" />
            : <Eye size={12} className="text-amber-400" />
          }
          <span className="text-[11px] font-semibold text-[color:var(--white)] truncate">
            {b.lead.firstName} {b.lead.lastName}
          </span>
          {isWidget && <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400 font-semibold">WEB</span>}
        </div>
        {!compact && b.vehicle && (
          <div className="text-[10px] text-[color:var(--muted)] mt-0.5 truncate">
            {b.vehicle.year} {b.vehicle.make} {b.vehicle.model}
          </div>
        )}
        <div className="text-[10px] text-[rgba(232,234,230,0.55)] mt-0.5 flex items-center gap-1">
          <Clock size={9} /> {formatTime(b.drive.scheduledAt)}
          {b.drive.duration && <span>· {b.drive.duration}min</span>}
        </div>
        {b.drive.outcome && (
          <span className={`inline-block text-[9px] font-semibold mt-1 px-1.5 py-0.5 rounded ${outcomeColors[b.drive.outcome]}`}>
            {b.drive.outcome.replace("_", " ").toUpperCase()}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--white)]">Showroom Diary</h2>
          <p className="text-[12px] text-[color:var(--muted)]">Test drives, viewings & trade-in appraisals — includes website bookings</p>
        </div>
        <button
          onClick={() => { setShowBooking(true); setBookDate(new Date().toISOString().split("T")[0]); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[color:var(--cyan)] text-black hover:opacity-90 transition cursor-pointer"
        >
          <Plus size={14} /> Book
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Today</span>
          <span className="text-xl font-mono font-semibold text-[color:var(--white)]">{todayBookings.length}</span>
        </div>
        <div className="bg-[color:var(--glass-line)] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">Upcoming</span>
          <span className="text-xl font-mono font-semibold text-[color:var(--cyan)]">{upcomingCount}</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wider text-emerald-400/70">Completed</span>
          <span className="text-xl font-mono font-semibold text-emerald-400">{completedCount}</span>
        </div>
        <div className={`rounded-xl p-3 flex flex-col gap-1 border ${noShowCount > 0 ? "bg-red-500/10 border-red-500/20" : "bg-[color:var(--glass-line)] border-white/5"}`}>
          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.55)]">No-Shows</span>
          <span className={`text-xl font-mono font-semibold ${noShowCount > 0 ? "text-red-400" : "text-[color:var(--white)]"}`}>{noShowCount}</span>
        </div>
      </div>

      {/* View controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-white/5 transition cursor-pointer"><ChevronLeft size={16} className="text-[color:var(--muted)]" /></button>
          <button onClick={() => setRefDate(new Date())} className="px-3 py-1 rounded-lg text-[12px] font-semibold text-[color:var(--cyan)] hover:bg-[color:var(--cyan)]/10 transition cursor-pointer">Today</button>
          <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-white/5 transition cursor-pointer"><ChevronRight size={16} className="text-[color:var(--muted)]" /></button>
          <span className="text-[13px] font-semibold text-[color:var(--white)] ml-2">
            {viewMode === "week"
              ? `${weekDates[0].toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} — ${weekDates[6].toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}`
              : refDate.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
            }
          </span>
        </div>
        <div className="flex gap-1 bg-[color:var(--glass)] rounded-lg p-0.5 border border-white/5">
          {(["week", "day", "list"] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1 rounded-md text-[12px] font-semibold transition cursor-pointer ${
                viewMode === m ? "bg-[color:var(--cyan)]/15 text-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)]"
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Week view */}
      {viewMode === "week" && (
        <div className="grid grid-cols-7 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/5">
          {weekDates.map(date => {
            const dayBookings = allBookings.filter(b => isSameDay(new Date(b.drive.scheduledAt), date));
            const isToday = isSameDay(date, new Date());
            return (
              <div
                key={date.toISOString()}
                className={`min-h-[140px] p-2 flex flex-col gap-1 ${isToday ? "bg-[color:var(--cyan)]/5" : "bg-[rgba(15,15,15,0.6)]"}`}
              >
                <div className={`text-[11px] font-semibold mb-1 ${isToday ? "text-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.45)]"}`}>
                  {date.toLocaleDateString("en-ZA", { weekday: "short" })}
                  <span className={`ml-1 ${isToday ? "bg-[color:var(--cyan)] text-black px-1.5 py-0.5 rounded-full text-[10px]" : ""}`}>
                    {date.getDate()}
                  </span>
                </div>
                {dayBookings.map(b => renderBookingCard(b, true))}
                {dayBookings.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-[10px] text-[rgba(232,234,230,0.2)]">—</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Day view */}
      {viewMode === "day" && (
        <div className="rounded-xl border border-white/5 overflow-hidden">
          {HOURS.map(hour => {
            const hourBookings = allBookings.filter(b => {
              const d = new Date(b.drive.scheduledAt);
              return isSameDay(d, refDate) && d.getHours() === hour;
            });
            return (
              <div key={hour} className="flex border-b border-white/5 last:border-0">
                <div className="w-16 py-3 px-3 text-[11px] font-mono text-[rgba(232,234,230,0.35)] text-right flex-shrink-0">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <div className="flex-1 py-2 px-2 flex gap-2 flex-wrap min-h-[48px]">
                  {hourBookings.map(b => renderBookingCard(b))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] bg-[rgba(255,255,255,0.02)]">
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allBookings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[rgba(232,234,230,0.45)]">No test drives or viewings booked yet.</td></tr>
              ) : allBookings.map(b => {
                const isPast = new Date(b.drive.scheduledAt) < new Date() && !b.drive.outcome;
                return (
                  <tr key={b.drive.id} className={`hover:bg-[rgba(255,255,255,0.02)] transition-colors ${isPast ? "bg-amber-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="text-[color:var(--white)] font-semibold">{formatDate(b.drive.scheduledAt)}</div>
                      <div className="text-[color:var(--muted)] text-[11px] flex items-center gap-1"><Clock size={9} /> {formatTime(b.drive.scheduledAt)} · {b.drive.duration || 30}min</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        b.drive.type === "test_drive" ? "bg-[color:var(--cyan)]/10 text-[color:var(--cyan)]"
                        : b.drive.type === "trade_in" ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                      }`}>
                        {b.drive.type === "test_drive" ? <><Car size={10} /> Test Drive</>
                         : b.drive.type === "trade_in" ? <><RefreshCw size={10} /> Trade-In</>
                         : <><Eye size={10} /> Viewing</>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[color:var(--white)]">{b.lead.firstName} {b.lead.lastName}</div>
                      <div className="text-[color:var(--muted)] text-[11px]">{b.lead.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--white)]">
                      {b.vehicle ? `${b.vehicle.year} ${b.vehicle.make} ${b.vehicle.model}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold ${
                        b.lead.source === "Website" || b.lead.source === "Widget" || b.lead.source === "Chat Bot"
                          ? "text-purple-400" : "text-[rgba(232,234,230,0.55)]"
                      }`}>
                        {b.lead.source || "Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.drive.outcome ? (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${outcomeColors[b.drive.outcome]}`}>
                          {b.drive.outcome.replace("_", " ")}
                        </span>
                      ) : isPast ? (
                        <span className="text-[11px] font-semibold text-amber-400">Overdue</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[color:var(--cyan)]">Scheduled</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!b.drive.outcome && (
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); markOutcome(b, "completed"); }} className="p-1 rounded hover:bg-emerald-500/15 text-emerald-400 cursor-pointer" title="Completed"><Check size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); markOutcome(b, "no_show"); }} className="p-1 rounded hover:bg-red-500/15 text-red-400 cursor-pointer" title="No-show"><X size={14} /></button>
                          <button onClick={(e) => { e.stopPropagation(); markOutcome(b, "cancelled"); }} className="p-1 rounded hover:bg-white/10 text-[color:var(--muted)] cursor-pointer" title="Cancelled"><AlertCircle size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Booking modal */}
      {showBooking && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60" onClick={() => setShowBooking(false)}>
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[color:var(--white)]">Book Test Drive / Viewing</h3>
              <button onClick={() => setShowBooking(false)} className="text-[color:var(--muted)] hover:text-[color:var(--white)] cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] block mb-1">Customer (Lead)</label>
                <select
                  value={bookLeadId}
                  onChange={e => setBookLeadId(e.target.value)}
                  className="w-full bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]/40"
                >
                  <option value="">Select a lead...</option>
                  {activeLeads.map(l => {
                    const v = vehicles.find(vv => vv.id === l.vehicleId);
                    return (
                      <option key={l.id} value={l.id}>
                        {l.firstName} {l.lastName} — {v ? `${v.year} ${v.make} ${v.model}` : "No vehicle"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] block mb-1">Type</label>
                  <select
                    value={bookType}
                    onChange={e => setBookType(e.target.value as any)}
                    className="w-full bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                  >
                    <option value="test_drive">Test Drive</option>
                    <option value="viewing">Viewing</option>
                    <option value="trade_in">Trade-In Appraisal</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] block mb-1">Duration</label>
                  <select
                    value={bookDuration}
                    onChange={e => setBookDuration(Number(e.target.value))}
                    className="w-full bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                  >
                    <option value={15}>15 min</option>
                    <option value={30}>30 min</option>
                    <option value={45}>45 min</option>
                    <option value={60}>1 hour</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] block mb-1">Date</label>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={e => setBookDate(e.target.value)}
                    className="w-full bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]/40"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] block mb-1">Time</label>
                  <input
                    type="time"
                    value={bookTime}
                    onChange={e => setBookTime(e.target.value)}
                    className="w-full bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]/40"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] block mb-1">Notes (optional)</label>
                <input
                  value={bookNotes}
                  onChange={e => setBookNotes(e.target.value)}
                  placeholder="Bring ID, spouse coming along, etc."
                  className="w-full bg-[color:var(--glass)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] placeholder:text-[rgba(232,234,230,0.3)] outline-none focus:border-[color:var(--cyan)]/40"
                />
              </div>
            </div>

            <button
              onClick={handleBook}
              disabled={!bookLeadId || !bookDate}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold bg-[color:var(--cyan)] text-black hover:opacity-90 disabled:opacity-40 transition cursor-pointer"
            >
              {bookType === "test_drive" ? "Book Test Drive" : bookType === "trade_in" ? "Book Trade-In Appraisal" : "Book Viewing"}
            </button>
          </div>
        </div>
      )}

      {/* Booking detail modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60" onClick={() => setSelectedBooking(null)}>
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedBooking.drive.type === "test_drive"
                  ? <Car size={16} className="text-[color:var(--cyan)]" />
                  : selectedBooking.drive.type === "trade_in"
                  ? <RefreshCw size={16} className="text-emerald-400" />
                  : <Eye size={16} className="text-amber-400" />
                }
                <h3 className="text-[15px] font-semibold text-[color:var(--white)]">
                  {selectedBooking.drive.type === "test_drive" ? "Test Drive" : selectedBooking.drive.type === "trade_in" ? "Trade-In Appraisal" : "Viewing"}
                </h3>
              </div>
              <button onClick={() => setSelectedBooking(null)} className="text-[color:var(--muted)] hover:text-[color:var(--white)] cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User size={14} className="text-[color:var(--muted)]" />
                <div>
                  <div className="text-[13px] text-[color:var(--white)] font-semibold">{selectedBooking.lead.firstName} {selectedBooking.lead.lastName}</div>
                  <div className="text-[11px] text-[color:var(--muted)]">{selectedBooking.lead.phone} · {selectedBooking.lead.email}</div>
                </div>
              </div>
              {selectedBooking.vehicle && (
                <div className="flex items-center gap-3">
                  <Car size={14} className="text-[color:var(--muted)]" />
                  <div className="text-[13px] text-[color:var(--white)]">
                    {selectedBooking.vehicle.year} {selectedBooking.vehicle.make} {selectedBooking.vehicle.model}
                    <span className="text-[color:var(--muted)] ml-1">({selectedBooking.vehicle.stockNumber})</span>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-[color:var(--muted)]" />
                <div className="text-[13px] text-[color:var(--white)]">
                  {formatDate(selectedBooking.drive.scheduledAt)} at {formatTime(selectedBooking.drive.scheduledAt)}
                  <span className="text-[color:var(--muted)] ml-1">· {selectedBooking.drive.duration || 30}min</span>
                </div>
              </div>
              {selectedBooking.drive.notes && (
                <div className="text-[12px] text-[rgba(232,234,230,0.55)] bg-white/[0.02] rounded-lg p-2">{selectedBooking.drive.notes}</div>
              )}
              <div className="text-[11px] text-[rgba(232,234,230,0.45)]">Source: {selectedBooking.lead.source || "Manual"}</div>
            </div>

            {!selectedBooking.drive.outcome ? (
              <div className="flex gap-2">
                <button onClick={() => markOutcome(selectedBooking, "completed")} className="flex-1 py-2 rounded-lg text-[12px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition cursor-pointer">
                  <Check size={12} className="inline mr-1" />Completed
                </button>
                <button onClick={() => markOutcome(selectedBooking, "no_show")} className="flex-1 py-2 rounded-lg text-[12px] font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition cursor-pointer">
                  <X size={12} className="inline mr-1" />No-Show
                </button>
                <button onClick={() => markOutcome(selectedBooking, "cancelled")} className="flex-1 py-2 rounded-lg text-[12px] font-semibold bg-white/5 text-[color:var(--muted)] hover:bg-white/10 transition cursor-pointer">
                  Cancel
                </button>
              </div>
            ) : (
              <div className={`text-center py-2 rounded-lg text-[12px] font-semibold ${outcomeColors[selectedBooking.drive.outcome]}`}>
                {selectedBooking.drive.outcome.replace("_", " ").toUpperCase()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
