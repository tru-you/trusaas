import logo from "./assets/truflow-logo.png";
import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Home,
  TrendingUp,
  Car,
  GitBranch,
  Upload,
  Users,
  Star,
  Receipt,
  FileSignature,
  CheckSquare,
  Award,
  LayoutGrid,
  Calculator,
  Settings as SettingsIcon,
  RefreshCw,
  Search,
  AlertTriangle,
  Menu,
  ChevronRight,
  Shield,
  Trash2,
  Check,
  X,
  FileSpreadsheet,
  Sparkles,
  ShoppingCart,
  LogOut,
  Zap,
  Code,
  Camera,
  Crosshair,
  Image,
  MessageCircle,
  Copy,
  FileText,
  MessageSquare,
  CalendarClock,
} from "lucide-react";

import {
  fetchState,
  refreshFromServer,
  resetState,
  updateSettings,
  createVehicle,
  updateVehicle,
  createLead,
  createTask,
  updateTask,
  createInvoice,
  payInvoice,
  createAgreement,
  updateAgreement,
  createExpense,
  reconcileExpense,
  createUser,
  fetchSeats,
  rotateSeatCode,
  setSeatActive,
  type Seat,
  uploadDocument,
  signDocument,
  deleteDocument
} from "./api";

import { Vehicle, Lead, Task, Invoice, Agreement, User, Communication, Expense, DMSState } from "./types";

import Counter from "./components/Counter";
import ChatWidget from "./components/ChatWidget";
import WebsiteChatWidget from "./components/WebsiteChatWidget";
import InvoicePreview from "./components/InvoicePreview";
import AgreementPreview from "./components/AgreementPreview";
import DocumentsHub from "./components/DocumentsHub";
import PwaInstallBanner from "./components/PwaInstallBanner";

/* Split out of the initial bundle — none of these is needed to paint the
   dashboard, and together they were roughly a third of a 540KB single chunk
   that every dealer downloaded before the login screen appeared. They load
   when the modal or section is first opened. */
const LeadDetailModal = lazy(() => import("./components/LeadDetailModal"));
const AccountingRecon = lazy(() => import("./components/AccountingRecon"));
const VehicleDetailModal = lazy(() => import("./components/VehicleDetailModal"));
const WordPressIntegration = lazy(() => import("./components/WordPressIntegration"));
import AmortizationCalc from "./components/AmortizationCalc";
import CustomerLeadForm from "./components/CustomerLeadForm";
import { CommissionEstimator } from "./components/CommissionEstimator";
import LoginSplash from "./components/LoginSplash";
import { hasValidSession, clearSession, getAccount, SESSION_EXPIRED_EVENT } from "./lib/session";
import DemoBanner from "./components/DemoBanner";
import { computeDmsGalleryReadiness } from "./lib/dmsReadiness";
import {
  PRODUCT_NAME,
  getTruLensUrl,
  setTruLensUrl,
  getDealerSlug,
  setDealerSlug,
  openTruLens,
  stockWidgetSnippet,
} from "./lib/productConfig";
import {
  getDealerWaNumber,
  setDealerWaNumber,
  openStockWhatsApp,
  copyStockBlurb,
} from "./lib/salesShare";
import { initGlassMotion } from "./lib/glassMotion";

/** Which dealership a newly-added vehicle belongs to — must stay in sync
 *  with DEALER_SLUG_TO_ID in server.ts (that's what the public website feed
 *  filters on) and with each dealer's own site slug (?dealer=...). */
const DEALERSHIPS = [
  { id: "d1", name: "MKR Auto Sales" },
  { id: "d2", name: "Cars on Caledon" },
];


/* ── Pipeline discipline ────────────────────────────────────────────────────
   A lead is only "in the pipeline" if someone knows what happens next and
   when. These drive the board, the overdue filter and the day's worklist. */

const DAY_MS = 86400000;
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (iso?: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS) : null;

/** How long a lead may sit in each stage before it needs chasing. A deal in
 *  Negotiating going quiet for a week is the expensive kind of forgotten. */
const STAGE_SLA_DAYS: Record<string, number> = {
  "New": 1,
  "Contacted": 3,
  "Test Drive Scheduled": 2,
  "Negotiating": 3,
};

/** Overdue means the next step's date has passed, or nobody set one and the
 *  lead has been sitting longer than its stage allows. Closed leads never are. */
function leadOverdue(l: any): boolean {
  if (l.status === "Closed Won" || l.status === "Closed Lost") return false;
  if (l.nextActionAt) return l.nextActionAt < today();
  const sla = STAGE_SLA_DAYS[l.status];
  if (sla == null) return false;
  const idle = daysBetween(l.lastContactedAt || l.stageChangedAt || l.createdAt);
  return idle != null && idle > sla;
}

/** Plain-language due state for a card. */
function dueLabel(l: any): { text: string; overdue: boolean } | null {
  if (l.status === "Closed Won" || l.status === "Closed Lost") return null;
  if (l.nextActionAt) {
    const d = Math.round((new Date(l.nextActionAt).getTime() - new Date(today()).getTime()) / DAY_MS);
    if (d < 0) return { text: `${l.nextAction || "Follow up"} · ${Math.abs(d)}d overdue`, overdue: true };
    if (d === 0) return { text: `${l.nextAction || "Follow up"} · today`, overdue: false };
    if (d === 1) return { text: `${l.nextAction || "Follow up"} · tomorrow`, overdue: false };
    return { text: `${l.nextAction || "Follow up"} · in ${d}d`, overdue: false };
  }
  const idle = daysBetween(l.lastContactedAt || l.stageChangedAt || l.createdAt);
  if (idle == null) return { text: "No next step set", overdue: true };
  return { text: idle === 0 ? "No next step set" : `No next step · idle ${idle}d`, overdue: leadOverdue(l) };
}

/** Moving a lead on should propose the next step, not leave a blank. */
const NEXT_STEP_ON_STAGE: Record<string, { action: string; inDays: number }> = {
  "New":                  { action: "First contact",       inDays: 0 },
  "Contacted":            { action: "Follow up",           inDays: 2 },
  "Test Drive Scheduled": { action: "Confirm test drive",   inDays: 1 },
  "Negotiating":          { action: "Chase decision",       inDays: 2 },
};


/* ── Stock economics ────────────────────────────────────────────────────────
   Everything here already existed in the data and was never added up. A car's
   real cost is what you paid plus what you spent getting it saleable, and the
   number a principal actually wants is what's left after both. */

/** What has been spent reconditioning this car. */
function reconSpend(v: any): number {
  return (v.reconTasks || []).reduce((sum: number, t: any) => sum + (Number(t.cost) || 0), 0);
}

/** Purchase price plus recon — the number a margin is honestly measured against. */
function costBasis(v: any): number {
  return (Number(v.costPrice) || 0) + reconSpend(v);
}

/** Gross margin. Projected while the car is in stock, realised once it's sold. */
function grossMargin(v: any): { rand: number; pct: number } {
  const retail = Number(v.retailPrice) || 0;
  const basis = costBasis(v);
  const rand = retail - basis;
  return { rand, pct: retail > 0 ? (rand / retail) * 100 : 0 };
}

/** Days a car has been in stock. Prefers the acquisition date over the stored
 *  counter, which is written once on create and then never moves. */
function stockAge(v: any): number {
  if (v.dateAcquired) {
    const d = Math.floor((Date.now() - new Date(v.dateAcquired).getTime()) / 86400000);
    if (!Number.isNaN(d) && d >= 0) return d;
  }
  return Number(v.daysInInventory) || 0;
}

/** Bands match the colours already used on the vehicle cards. */
const AGE_BANDS = [
  { key: "0-30",  label: "Under 30 days", min: 0,  max: 30,       tone: "var(--cyan)" },
  { key: "31-60", label: "31 to 60 days", min: 31, max: 60,       tone: "var(--cyan-bright)" },
  { key: "61-90", label: "61 to 90 days", min: 61, max: 90,       tone: "var(--warning)" },
  { key: "90+",   label: "Over 90 days",  min: 91, max: Infinity, tone: "var(--muted)" },
];
function ageBand(days: number) {
  return AGE_BANDS.find((b) => days >= b.min && days <= b.max) || AGE_BANDS[0];
}


/** A flat segmented filter — replaces the row of rounded <select> boxes, which
 *  hid their options behind a click and gave no sense of what was set. Here the
 *  choices are visible and the active one reads in the accent. */
function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-white/10 bg-[color:var(--ink-2)] p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-md text-[13px] font-medium transition-colors cursor-pointer ${
            value === o.value
              ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]"
              : "text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<DMSState | null>(null);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  // Lifted out of ChatWidget so the dashboard can open the assistant directly —
  // the floating bubble is easy to miss on a desk monitor.
  const [assistOpen, setAssistOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("u1");
  // Driven by the signed token, not a sessionStorage flag — a flag said "logged
  // in" while the token was gone or expired, and every API call 401'd behind a
  // dashboard that looked fine. The token also outlives the browser tab, which
  // is what "keep me signed in" needs.
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasValidSession());

  useEffect(() => {
    if (!isLoggedIn) return;
    return initGlassMotion();
  }, [isLoggedIn]);

  useEffect(() => {
    // Calls the API directly rather than refreshSeats(): that is a const
    // declared further down, past the `if (!state)` early return, so on the
    // loading render it is still in the temporal dead zone and this effect
    // crashed the whole app with "Cannot access 'refreshSeats' before
    // initialization".
    if (!isLoggedIn) return;
    fetchSeats()
      .then((data) => {
        setSeats(data.seats);
        setActiveSeats(data.activeSeats);
      })
      .catch(() => setSeats([]));
  }, [isLoggedIn]);

  // --- Derived State ---
  const currentUser = state ? (state.users.find(u => u.id === currentUserId) || state.users[0]) : null;
  const isMasterAdmin = currentUser?.role === 'admin';
  const dealershipId = currentUser?.dealershipId;

  // Filter state for non-admins (vehicles with no dealershipId always visible — e.g. TruLens imports)
  const filteredVehicles = state
    ? (isMasterAdmin
        ? state.vehicles
        : state.vehicles.filter(v => !v.dealershipId || v.dealershipId === dealershipId))
    : [];
  const filteredLeads = state ? (isMasterAdmin ? state.leads : state.leads.filter(l => l.dealershipId === dealershipId)) : [];
  const filteredTasks = state ? (isMasterAdmin ? state.tasks : state.tasks.filter(t => t.dealershipId === dealershipId)) : [];
  const filteredInvoices = state ? (isMasterAdmin ? state.invoices : state.invoices.filter(i => i.dealershipId === dealershipId)) : [];
  const filteredAgreements = state ? (isMasterAdmin ? state.agreements : state.agreements.filter(a => a.dealershipId === dealershipId)) : [];
  const filteredDocuments = state ? (isMasterAdmin ? state.documents : (state.documents || []).filter(d => !d.dealershipId || d.dealershipId === dealershipId)) : [];
  const filteredCommunications = state ? (isMasterAdmin ? state.communications : state.communications.filter(c => c.dealershipId === dealershipId)) : [];
  const filteredExpenses = state ? (isMasterAdmin ? state.expenses : state.expenses.filter(e => e.dealershipId === dealershipId)) : [];
  const [selectedDetailVehicle, setSelectedDetailVehicle] = useState<Vehicle | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leadDetailId, setLeadDetailId] = useState<string | null>(null);
  // The view follows the logged-in account. This was a "simulated role
  // selector" pill that let anyone flip to Dealer Owner regardless of their
  // real login — a permissions hole now that seats are live. principal/admin
  // see the owner view; managers and salespeople see their own.
  const account = getAccount();
  const accountRole: 'salesperson' | 'manager' | 'owner' =
    account?.role === 'admin' || account?.role === 'principal' ? 'owner'
    : account?.role === 'manager' ? 'manager' : 'salesperson';
  const selectedRole = accountRole;
  const [showEODReport, setShowEODReport] = useState(false);

  // Filters & Searches
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("ALL");
  const [inventoryPhotoFilter, setInventoryPhotoFilter] = useState<"ALL" | "NEEDS" | "PARTIAL" | "READY">("ALL");
  const [inventoryAgeFilter, setInventoryAgeFilter] = useState<"ALL" | "30" | "60" | "90">("ALL");
  const [leadCrmTab, setLeadCRMTab] = useState<"kanban" | "list">("kanban");
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);

  // Modal Open states
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; type: 'info' | 'warning' | 'error' }[]>([]);
  const notifiedTaskIds = React.useRef<Set<string>>(new Set());

  const [trulensUrlInput, setTrulensUrlInput] = useState(() => getTruLensUrl());
  const [dealerSlugInput, setDealerSlugInput] = useState(() => getDealerSlug());
  const [waNumberInput, setWaNumberInput] = useState(() => getDealerWaNumber());
  const [embedCopied, setEmbedCopied] = useState(false);

  const addNotification = (title: string, message: string, type: 'info' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 10000);
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!state) return;

    const checkTasks = () => {
      const now = new Date();
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      state.tasks.forEach(task => {
        if (
          task.assignedUserId === currentUserId &&
          task.status !== 'Completed' &&
          (task.priority === 'High' || task.priority === 'Urgent') &&
          !notifiedTaskIds.current.has(task.id)
        ) {
          const dueDate = new Date(task.dueDate);
          if (dueDate > now && dueDate <= twentyFourHoursFromNow) {
            const hoursLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60));
            const message = `Operational task "${task.title}" is due in ${hoursLeft} ${hoursLeft === 1 ? 'hour' : 'hours'}. Action required.`;
            
            // In-app visual alert
            addNotification("Critical Deadline", message, 'warning');

            // Native Browser Notification (if supported/permitted)
            if ("Notification" in window && Notification.permission === "granted") {
              try {
                new Notification("TrueCar DMS: Task Due Soon", {
                  body: message,
                  icon: "https://ais-dev-qn66bypajuveujrpl7bhld-891304121884.europe-west2.run.app/favicon.ico"
                });
              } catch (e) {
                console.error("Browser notification error:", e);
              }
            }
            
            notifiedTaskIds.current.add(task.id);
          }
        }
      });
    };

    checkTasks();
    const interval = setInterval(checkTasks, 300000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [state, currentUserId]);

  const handleAutoAssign = async () => {
    setIsAutoAssigning(true);
    try {
      const res = await fetch("/api/leads/auto-assign", { 
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh state
        const stateRes = await fetch("/api/state");
        const newState = await stateRes.json();
        setState(newState);
      } else {
        alert(data.error || "Failed to auto-assign leads.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error during auto-assignment.");
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Form Fields State
  const [newLeadForm, setNewLeadForm] = useState({ firstName: "", lastName: "", phone: "082 ", email: "", vehicleId: "", source: "Website", notes: "" });
  const [newInvoiceForm, setNewInvoiceForm] = useState({ leadId: "", vehicleId: "", amount: 0, paymentMethod: "Bank Transfer", status: "Sent" as any, dueDate: new Date().toISOString().slice(0, 10) });
  const [newAgreementForm, setNewAgreementForm] = useState({ leadId: "", vehicleId: "", purchasePrice: 0, depositAmount: 50000, type: "Vehicle Sale" as any, status: "Pending Signature" as any });
  const [newTaskForm, setNewTaskForm] = useState({ title: "", leadId: "", vehicleId: "", assignedUserId: "u1", dueDate: new Date().toISOString().slice(0, 10), priority: "Normal" as any, status: "Pending" as any });
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", role: "salesperson" as any, phone: "" });
  // Staff logins ("seats") — the principal manages these, and activeSeats is
  // what the dealership is billed on.
  const [seats, setSeats] = useState<Seat[]>([]);
  const [activeSeats, setActiveSeats] = useState(0);
  const [seatError, setSeatError] = useState("");
  /** A freshly issued code, shown once. Never fetched back from the server. */
  const [issuedCode, setIssuedCode] = useState<{ name: string; code: string } | null>(null);
  const [newVehicleForm, setNewVehicleForm] = useState({ year: 2026, make: "Volkswagen", model: "Amarok", trim: "Double Cab Style V6", engine: "3.0L V6 Turbo Diesel", fuelType: "Diesel" as any, transmission: "Automatic" as any, bodyType: "Bakkie Utility", retailPrice: 745000, costPrice: 640000, mileage: 15300, stockNumber: "JHB-" + Math.floor(Math.random() * 8999 + 1000), description: "Immaculate condition. Full service history. Active info display cockpit.", dealershipId: "d1", category: "" });

  const [vinInput, setVinInput] = useState("");
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinDecodeStatus, setVinDecodeStatus] = useState("");

  // Currently Focused Documents for View Previews
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [activeAgreementId, setActiveAgreementId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAllState = () => {
    setLoadError(null);
    fetchState()
      .then((data) => {
        // Nothing is logged here on purpose. This used to print the entire
        // /api/state payload to the browser console on every load and every
        // 15s poll — every lead's name, phone, email and notes, every invoice —
        // which put it in reach of anyone who opened DevTools on a yard machine.
        setState(data);
        if (data.vehicles.length > 0) {
          setNewLeadForm((prev) => ({ ...prev, vehicleId: data.vehicles[0].id }));
          setNewInvoiceForm((prev) => ({ ...prev, vehicleId: data.vehicles[0].id, amount: data.vehicles[0].retailPrice }));
          setNewAgreementForm((prev) => ({ ...prev, vehicleId: data.vehicles[0].id, purchasePrice: data.vehicles[0].retailPrice }));
          setNewTaskForm((prev) => ({ ...prev, vehicleId: data.vehicles[0].id }));
        }
        if (data.leads.length > 0) {
          setNewInvoiceForm((prev) => ({ ...prev, leadId: data.leads[0].id }));
          setNewAgreementForm((prev) => ({ ...prev, leadId: data.leads[0].id }));
          setNewTaskForm((prev) => ({ ...prev, leadId: data.leads[0].id }));
        }
      })
      .catch((err) => {
        console.error("Error connecting to full-stack API", err);
        setLoadError(err.message || "Failed to connect to server");
      });
  };

  useEffect(() => {
    // Everything below hits authenticated endpoints. Running it while signed
    // out produced a 401 on a 15s timer, which used to reload the page — so the
    // login screen mounted, polled, 401'd and reloaded, over and over.
    if (!isLoggedIn) return;
    loadAllState();
    // When you come back to this tab after exporting from TruLens, reload photos
    const onFocus = () => {
      refreshFromServer()
        .then((data) => setState(data))
        .catch(() => { /* ignore if offline */ });
    };
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(() => {
      refreshFromServer()
        .then((data) => setState(data))
        .catch(() => {});
    }, 15000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
    };
  }, [isLoggedIn]);

  // Token rejected by the server — drop to the login screen without reloading.
  useEffect(() => {
    const onExpired = () => setIsLoggedIn(false);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  if (!isLoggedIn) {
    return (
      // setIsLoggedIn inline, not handleLogin — this early return runs before
      // handleLogin is initialised further down the component body.
      <LoginSplash onLogin={() => setIsLoggedIn(true)} />
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-[color:var(--white)] font-sans">
        <div className="text-[color:var(--muted)] mb-4 font-mono text-[16px] border border-[color:var(--glass-line)] bg-[color:var(--glass)] p-4 rounded-lg">
          Connection Error: {loadError}
        </div>
        <button 
          onClick={loadAllState}
          className="px-4 py-2 bg-[color:var(--cyan)] on-fill rounded text-[13px] font-bold hover:bg-opacity-80"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[color:var(--ink)] flex flex-col items-center justify-center p-6 text-[color:var(--white)] font-sans gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-t-[color:var(--cyan)] border-[color:var(--cyan-faint)] animate-spin" />
        <div className="font-bold text-[16px] tracking-wide">Starting TruFlow Premium…</div>
        <div className="text-[13px] text-[rgba(232,234,230,0.72)] text-center max-w-xs">
          Loading floor data from <span className="font-mono text-[color:var(--cyan)]">localhost:3001</span>.
          If this hangs, restart the server (`npm run dev` in truflow-premium).
        </div>
        <button
          type="button"
          onClick={loadAllState}
          className="mt-2 px-4 py-2 rounded-lg bg-[color:var(--cyan)] on-fill text-[13px] font-bold"
        >
          Retry load
        </button>
      </div>
    );
  }

  // Derived metrics
  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  const activeVehiclesCount = state.vehicles.filter((v) => v.status !== "SOLD").length;
  const unresolvedLeadsCount = state.leads.filter((l) => l.status !== "Closed Won" && l.status !== "Closed Lost").length;
  const mockDailySummary = {
    visits: 51,
    uniqueVisitors: 48,
    actions: 57,
    actionsPerVisit: 1.1,
    avgVisitDuration: "3s",
    bounceRate: "94%",
    maxActions: 4
  };

  const soldUnitsCount = state.vehicles.filter((v) => v.status === "SOLD").length;
  const totalRevenue = state.invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);

  /* Leads waiting on a first reply ------------------------------------------
     The number that actually decides whether a lead converts is how long it
     sat before anyone answered it — pipeline value can't be acted on at 9am,
     but "3 people are waiting, one since yesterday" can. A lead counts as
     waiting when it is still open and has never been contacted. */
  const openLeads = state.leads.filter((l) => l.status !== "Closed Won" && l.status !== "Closed Lost");
  const awaitingReply = openLeads.filter((l) => !l.lastContactedAt);
  const oldestWaitMs = awaitingReply.reduce((worst, l) => {
    const waited = Date.now() - new Date(l.createdAt).getTime();
    return Number.isFinite(waited) && waited > worst ? waited : worst;
  }, 0);
  /** "4h" / "2d" / "18m" — the shape a dealer reads at a glance. */
  const formatWait = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${Math.max(mins, 1)}m`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
  };
  // Anything unanswered for more than an hour is the one thing on this screen
  // allowed to draw the eye. Under an hour the dealer is on top of it.
  const replyIsLate = oldestWaitMs > 60 * 60 * 1000;

  /** Whose floor this is. Falls back through the signed-in account so the
   *  banner never renders a bare "· live" with nothing in front of it. */
  const dealershipLabel =
    (state?.dealerships || [])[0]?.name || account?.label || "Your dealership";
  const todayLabel = new Date().toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* Card subtexts should answer "compared to what?" — "Ready for viewing" and
     "Cleared this cycle" are decoration. Aged stock and unpaid invoices are
     the two numbers a dealer principal actually chases. */
  const AGED_DAYS = 60;
  const agedStockCount = state.vehicles.filter(
    (v) => v.status !== "SOLD" && (v.daysInInventory ?? 0) > AGED_DAYS
  ).length;
  const outstandingRevenue = state.invoices
    .filter((i) => i.status !== "Paid")
    .reduce((sum, i) => sum + i.amount, 0);

  /* The morning strip -------------------------------------------------------
     What a dealer needs to know before the doors open, in the order it costs
     money: who has been left hanging, what was promised for today, and what
     has to physically leave the yard. Kept in the chrome so it follows you
     off the dashboard — the numbers are useless on a screen you've navigated
     away from. */
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday); endOfToday.setDate(endOfToday.getDate() + 1);
  const isToday = (d?: string | null) => {
    if (!d) return false;
    const t = new Date(d).getTime();
    return t >= startOfToday.getTime() && t < endOfToday.getTime();
  };
  // Anything promised for today — an open task, or a lead's next action.
  const dueTodayCount =
    state.tasks.filter((t) => t.status !== "Completed" && isToday(t.dueDate)).length +
    openLeads.filter((l) => isToday(l.nextActionAt)).length;
  // Overdue is worse than due: it was promised and the day has passed.
  const overdueCount =
    state.tasks.filter(
      (t) => t.status !== "Completed" && t.dueDate && new Date(t.dueDate) < startOfToday
    ).length +
    openLeads.filter(
      (l) => l.nextActionAt && new Date(l.nextActionAt) < startOfToday
    ).length;
  // Sold but not yet handed over — these have a customer expecting a date.
  const inPrepCount = state.vehicles.filter((v) => v.status === "PENDING").length;

  // Grouped menu sections for elegant layout
  const groupedNavigation = [
    {
      category: "Showroom Floor",
      items: [
        { id: "dashboard", label: "Overview", icon: Home },
        { id: "inventory", label: "All Vehicles", icon: Car },
        { id: "upload", label: "Add vehicle", icon: Upload },
      ]
    },
    {
      category: "Operations & CRM",
      items: [
        { id: "leads", label: "Lead CRM", icon: Users },
        { id: "tasks", label: "Tasks", icon: CheckSquare },
        { id: "stock_health", label: "Stock health", icon: TrendingUp },
        { id: "accounting_recon", label: "Finance & Recon", icon: Receipt },
      ]
    },
    {
      category: "Media & Web",
      items: [
        { id: "media_web", label: "Stock media", icon: Image },
      ]
    },
    {
      category: "Dealer Settings",
      items: [
        { id: "manager", label: "Team & Users", icon: Users },
        { id: "settings", label: "Settings", icon: SettingsIcon },
      ]
    }
  ];

  // Filter navigation items based on current active simulated user role
  const filteredNavigation = groupedNavigation.map(group => {
    let items = group.items;
    if (selectedRole === 'salesperson') {
      items = items.filter(item => 
        ['dashboard', 'inventory', 'upload', 'leads', 'tasks', 'accounting_recon', 'media_web'].includes(item.id)
      );
    } else if (selectedRole === 'manager') {
      items = items.filter(item => 
        ['dashboard', 'inventory', 'upload', 'leads', 'tasks', 'accounting_recon', 'manager', 'settings'].includes(item.id)
      );
    }
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  // Callback action handlers
  const handleSignAgreement = async (id: string, signature: string) => {
    await updateAgreement(id, {
      status: "Signed",
      signature,
      signedAt: new Date().toISOString()
    });
    loadAllState();
  };

  const handleCreateExpense = async (expense: Partial<any>) => {
    await createExpense(expense as Omit<Expense, "id">);
    loadAllState();
  };

  const handleReconcileExpense = async (id: string, reconciled: boolean) => {
    await reconcileExpense(id, reconciled);
    loadAllState();
  };

  const handleUpdateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    await updateVehicle(id, updates);
    loadAllState();
  };

  const handleUploadDocument = async (doc: { fileName: string; mimeType: string; fileData: string; leadId?: string; vehicleId?: string }) => {
    await uploadDocument({ ...doc, dealershipId });
    loadAllState();
  };

  const handleSignDocument = async (id: string, signature: string, signedBy: string) => {
    await signDocument(id, signature, signedBy);
    loadAllState();
  };

  const handleDeleteDocument = async (id: string) => {
    await deleteDocument(id);
    loadAllState();
  };

  // Helper selectors
  const getVehicleLabel = (id: string) => {
    const v = state.vehicles.find((item) => item.id === id);
    return v ? `${v.year} ${v.make} ${v.model}` : "Generic Query Asset";
  };

  const getUserLabel = (id: string) => {
    const u = state.users.find((item) => item.id === id);
    return u ? u.name : "Unassigned Pool";
  };

  const getLeadLabel = (id: string) => {
    const l = state.leads.find((item) => item.id === id);
    return l ? `${l.firstName} ${l.lastName}` : "Anonymous";
  };

  // Toggle Features
  const handleToggleFeature = async (featureKey: keyof NonNullable<DMSState['settings']>) => {
    if (!state.settings) return;
    const current = state.settings[featureKey];
    await updateSettings({ [featureKey]: !current });
    loadAllState();
  };

  // Resets (data only — not the same as log out)
  /** Log that this lead was actioned and schedule the next step.
   *  Leads go cold because nothing forces the question "and then what?" —
   *  this asks it every time, and defaults sensibly by stage. */
  const advanceLead = async (l: any) => {
    const rule = NEXT_STEP_ON_STAGE[l.status] || { action: "Follow up", inDays: 2 };
    const due = new Date(Date.now() + rule.inDays * DAY_MS).toISOString().slice(0, 10);
    await updateLead(l.id, {
      lastContactedAt: today(),
      nextAction: rule.action,
      nextActionAt: due,
    } as any);
    loadAllState();
  };

  const handleResetState = () => {
    // Typed confirmation, not an OK button. This deletes every dealership's
    // stock, leads, invoices and signed documents, permanently.
    const typed = prompt(
      "This permanently deletes ALL data for EVERY dealership on this instance — " +
      "stock, leads, invoices and signed documents. There is no backup.\n\n" +
      "Type RESET EVERYTHING to confirm."
    );
    if (typed === "RESET EVERYTHING") {
      resetState().then((newState) => {
        setState(state);
        alert("Showroom cache cleared & baseline data re-seeded.");
        window.location.reload();
      });
    }
  };

  /** Sign out → access-code splash. Does not wipe inventory.
   *  Discards the token too, otherwise "sign out" left a working session
   *  sitting in storage for the next person on a shared yard device. */
  const handleLogout = () => {
    clearSession();
    setSidebarOpen(false);
    setActiveSection("dashboard");
    setIsLoggedIn(false);
  };

  /** LoginSplash has already exchanged the code for a token by this point. */
  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  // Stage move helper
  const moveVehicle = async (id: string, currentStatus: string, dir: "NEXT" | "PREV") => {
    const stages: string[] = ["INVENTORY", "PENDING", "SOLD"];
    const idx = stages.indexOf(currentStatus);
    let targetIdx = idx;
    if (dir === "NEXT" && idx < stages.length - 1) targetIdx++;
    if (dir === "PREV" && idx > 0) targetIdx--;

    if (idx !== targetIdx) {
      await updateVehicle(id, { status: stages[targetIdx] as any });
      loadAllState();
    }
  };

  // Submit functions
  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLead({
      ...newLeadForm,
      digitalScore: Math.floor(Math.random() * 41) + 50
    });
    setIsLeadModalOpen(false);
    setNewLeadForm({ firstName: "", lastName: "", phone: "082 ", email: "", vehicleId: state.vehicles[0]?.id || "", source: "Website", notes: "" });
    loadAllState();
  };

  const handleWebsiteLeadCapture = async (name: string, phone: string, email: string) => {
    try {
      const parts = name.split(" ");
      const firstName = parts[0] || "";
      const lastName = parts.slice(1).join(" ") || "";
      
      await createLead({
        firstName,
        lastName,
        phone,
        email,
        vehicleId: "", // unassigned initial
        source: "Website AI Bot",
        notes: "Captured via Live Receptionist AI bot."
      });
      loadAllState();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createInvoice(newInvoiceForm);
    setIsInvoiceModalOpen(false);
    setNewInvoiceForm({ leadId: state.leads[0]?.id || "", vehicleId: state.vehicles[0]?.id || "", amount: state.vehicles[0]?.retailPrice || 0, paymentMethod: "Bank Transfer", status: "Sent", dueDate: new Date().toISOString().slice(0, 10) });
    loadAllState();
  };

  const handleCreateAgreementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAgreement(newAgreementForm);
    setIsAgreementModalOpen(false);
    setNewAgreementForm({ leadId: state.leads[0]?.id || "", vehicleId: state.vehicles[0]?.id || "", purchasePrice: state.vehicles[0]?.retailPrice || 0, depositAmount: 50000, type: "Vehicle Sale", status: "Pending Signature" });
    loadAllState();
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask(newTaskForm);
    setIsTaskModalOpen(false);
    setNewTaskForm({ title: "", leadId: state.leads[0]?.id || "", vehicleId: state.vehicles[0]?.id || "", assignedUserId: "u1", dueDate: new Date().toISOString().slice(0, 10), priority: "Normal", status: "Pending" });
    loadAllState();
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSeatError("");
    try {
      // Adding a person issues their access code. It is shown once here and is
      // not recoverable afterwards, so the modal stays open until it's copied.
      const { code } = await createUser(newUserForm);
      setIssuedCode({ name: newUserForm.name, code });
      setNewUserForm({ name: "", email: "", role: "salesperson", phone: "" });
      loadAllState();
      refreshSeats();
    } catch (err: any) {
      setSeatError(err?.message || "Could not add that person.");
    }
  };

  const refreshSeats = async () => {
    try {
      const data = await fetchSeats();
      setSeats(data.seats);
      setActiveSeats(data.activeSeats);
    } catch {
      setSeats([]);
    }
  };

  const handleRotateSeat = async (userId: string, name: string) => {
    setSeatError("");
    try {
      setIssuedCode({ name, code: await rotateSeatCode(userId) });
      refreshSeats();
    } catch (err: any) {
      setSeatError(err?.message || "Could not issue a new code.");
    }
  };

  const handleToggleSeat = async (userId: string, isActive: boolean) => {
    setSeatError("");
    try {
      await setSeatActive(userId, isActive);
      refreshSeats();
      loadAllState();
    } catch (err: any) {
      setSeatError(err?.message || "Could not update that login.");
    }
  };

  const handlePublishVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    // Metadata only — gallery comes from TruLens Export to DMS
    await createVehicle({
      ...newVehicleForm,
      images: [],
      damagePhotos: [],
      vinPhotos: [],
      serviceBookPhotos: [],
      extrasPhotos: [],
    });
    const stock = newVehicleForm.stockNumber;
    addNotification(
      "Vehicle on floor",
      `${newVehicleForm.year} ${newVehicleForm.make} ${newVehicleForm.model} (${stock}) — open TruLens to shoot, then Export to DMS`,
      "info"
    );
    setActiveSection("inventory");
    setNewVehicleForm({
      year: 2026,
      make: "Volkswagen",
      model: "Amarok",
      trim: "Double Cab Style V6",
      engine: "3.0L V6 Turbo Diesel",
      fuelType: "Diesel",
      transmission: "Automatic",
      bodyType: "Bakkie Utility",
      retailPrice: 745000,
      costPrice: 640000,
      mileage: 15300,
      stockNumber: "JHB-" + Math.floor(Math.random() * 8999 + 1000),
      description: "Immaculate condition. Full service history. Active info display cockpit.",
      dealershipId: "d1",
    });
    loadAllState();
    if (confirm("Stock created. Open TruLens now to shoot this unit?")) {
      openTruLens(stock);
    }
  };

  // End of Day CSV spreadsheet export generator
  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [
          ["TruFlow Light - End of Day Operations Summary"],
          ["Date", new Date().toISOString().split('T')[0]],
          [],
          ["Key Performance Indicators", "Value"],
          ["Leads Engaged / Worked", "12 Leads"],
          ["Vehicles Moved (Sold)", "3 Units"],
          ["Total Reconditioning Outlay", "R 18,500"],
          ["Gross Sales Revenue", "R 1,515,000"],
          ["Total Profit Realized", "R 185,000"],
          [],
          ["Finalized Sales Transactions"],
          ["Stock Ref", "Vehicle Model", "Client Name", "Sale Amount", "Calculated Gross Margin"],
          ["JHB-8319", "Toyota Hilux 2.8 GD-6 Legend", "Aiden Fourie", "R 825 000", "R 115 000"],
          ["CT-5219", "Volkswagen Golf 8 GTI", "Sipho Dlamini", "R 690 000", "R 70 000"]
        ].map(e => e.map(val => `"${val}"`).join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TruFlow_EOD_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification("Report Exported", "Your EOD operations spreadsheet has been downloaded successfully.", "info");
  };

  // Nav routing without tier restrictions
  const navigateTo = (secId: string) => {
    setActiveSection(secId);
    setSidebarOpen(false);
  };

  return (
    !isLoggedIn ? (
      <LoginSplash onLogin={handleLogin} />
    ) : (
      <div className="min-h-screen bg-[color:var(--ink)] text-[color:var(--white)] flex relative select-none perspective-scene">
        <DemoBanner productName={PRODUCT_NAME} />
        {/* Scroll indicator */}
        <div className="scroll-progress transition-transform" />

      {/* Grid Pattern overlays */}
      <div className="bg-grid" />

      {/* Sidebar - Desktop & Mobile Drawer */}
      <aside
        className={`glass-sidebar fixed left-0 top-0 bottom-0 w-[240px] p-5 flex flex-col z-[180] transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-center px-1">
            <img src={logo} alt="TruFlow Premium" className="h-12 w-auto max-w-full object-contain logo-float" />
          </div>
          {/* Whose floor this is, and who is signed in — stated once, here,
              directly under the mark rather than repeated across the top bar. */}
          <div className="mt-3 flex flex-col items-center text-center">
            <span className="text-[13px] font-semibold text-[color:var(--white)] leading-tight">
              {account?.label || 'Signed in'}
            </span>
            <span className="text-[length:var(--t-micro)] text-[color:var(--cyan)] font-semibold">
              {selectedRole === 'owner' ? 'Owner' : selectedRole === 'manager' ? 'Manager' : 'Salesperson'}
            </span>
          </div>
          {/* The dealer's OWN showroom. This was hardcoded to true-cars.co.za,
              so every dealership's sidebar linked to our consumer site instead
              of to their website. */}
          {(() => {
            const mine = (state?.dealerships || []).find((d: any) => d.id === dealershipId)
              || (state?.dealerships || [])[0];
            const site = mine?.websiteUrl;
            if (!site) return null;
            const label = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return (
              <>
                <a href={site} target="_blank" rel="noopener noreferrer"
                   className="text-[13px] text-[rgba(232,234,230,0.55)] hover:text-[color:var(--white)] mt-2 transition-colors">{label}</a>
                <div className="flex gap-2 mt-2">
                  <a href={site} target="_blank" rel="noopener noreferrer"
                     className="text-[13px] px-3 py-1 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-faint)] transition-colors">
                    Your showroom
                  </a>
                </div>
              </>
            );
          })()}
        </div>

         <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1 scrollbar-thin">
          {filteredNavigation.map((group) => (
            <div key={group.category} className="flex flex-col gap-1">
              <span className="font-mono text-[13px] text-[rgba(232,234,230,0.72)] tracking-widest  font-semibold pl-3 mb-1 block">
                {group.category}
              </span>
              {group.items.map((n) => {
                const Icon = n.icon;
                const active = activeSection === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => navigateTo(n.id)}
                    className={`glass-nav-item flex items-center gap-3 px-3 py-2 text-[13px] font-semibold rounded-xl text-left relative cursor-pointer border ${
                      active
                        ? "is-active bg-[color:var(--cyan-faint)] text-[color:var(--white)] border-[color:var(--cyan-soft)]"
                        : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/[0.04] border-transparent"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r bg-[color:var(--cyan)]" />
                    )}
                    <Icon size={15} className={active ? "text-[color:var(--cyan)]" : "text-[color:var(--blue)]"} />
                    {n.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Always-visible sign out */}
        <div className="pt-3 mt-2 border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-[13px] font-bold tracking-normal text-[color:var(--white-dim)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] hover:bg-[color:var(--glass)] hover:text-[color:var(--white-dim)] transition-all cursor-pointer"
            title="Sign out of TruFlow"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 md:ml-[240px] min-h-screen px-4 py-6 md:px-8 md:py-8 z-10 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* Top Profile Bar - Hidden on mobile */}
        <div className="hidden md:flex justify-between items-center gap-4 border-b border-white/5 pb-4">
           {/* Morning strip — the floor at a glance, on every screen. Only the
               unanswered-lead figure is allowed to go red; if everything shouts,
               nothing does. */}
           <div className="flex items-center gap-2 flex-wrap">
             <button
               type="button"
               onClick={() => navigateTo("leads")}
               className={`flex items-center gap-2 h-9 px-3 rounded-full border transition-colors cursor-pointer text-[13px] ${
                 replyIsLate
                   ? "bg-[color:var(--glass)] text-[color:var(--muted)] border-[color:var(--glass-line)] hover:bg-[color:var(--glass)]"
                   : "bg-[color:var(--glass)] text-[rgba(232,234,230,0.72)] border-[color:var(--glass-line)] hover:text-[color:var(--white)]"
               }`}
               title="Leads that have never been replied to"
             >
               <MessageSquare size={14} />
               <span className="font-semibold">{awaitingReply.length}</span>
               <span>waiting</span>
               {awaitingReply.length > 0 && (
                 <span className="opacity-70">· {formatWait(oldestWaitMs)}</span>
               )}
             </button>

             <button
               type="button"
               onClick={() => navigateTo("tasks")}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--glass)] border border-[color:var(--glass-line)] text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] transition-colors cursor-pointer text-[13px]"
               title="Promised for today, and anything already past its date"
             >
               <CalendarClock size={14} />
               <span className="font-semibold">{dueTodayCount}</span>
               <span>due today</span>
               {overdueCount > 0 && (
                 <span className="text-[color:var(--muted)] font-semibold">
                   · {overdueCount} late
                 </span>
               )}
             </button>

             <button
               type="button"
               onClick={() => navigateTo("inventory")}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--glass)] border border-[color:var(--glass-line)] text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] transition-colors cursor-pointer text-[13px]"
               title="Sold, not yet handed over"
             >
               <Car size={14} />
               <span className="font-semibold">{inPrepCount}</span>
               <span>going out</span>
             </button>
           </div>

           <div className="flex items-center gap-2 shrink-0">
             <button
               type="button"
               onClick={() => setAssistOpen(true)}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)] hover:text-[color:var(--ink)] transition-colors cursor-pointer text-[13px] font-semibold"
               title="Ask Dealer Assist"
             >
               <Sparkles size={14} />
               Dealer Assist
             </button>
             {/* Who is signed in now lives under the sidebar logo — it was
                 repeated three times across the top bar. */}
             <button
               type="button"
               onClick={handleLogout}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--glass)] text-[color:var(--muted)] hover:bg-[color:var(--glass)] hover:text-[color:var(--white-dim)] transition-all cursor-pointer border border-[color:var(--glass-line)] text-[13px] font-bold tracking-normal"
               title="Log out"
             >
               <LogOut size={14} />
               Log out
             </button>
           </div>
        </div>

        {/* Mobile Header Bar & Role Selector */}
        <div className="flex flex-col gap-2 md:hidden border-b border-white/5 pb-3">
          <div className="flex justify-between items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-[color:var(--white)] p-2 hover:bg-white/5 rounded-lg cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <img src={logo} alt="TruFlow Premium" className="h-9 w-auto max-w-[180px] object-contain logo-float" />
            {/* The desktop top bar is hidden on mobile, so the assistant needs
                its own way in here or phone users lose it entirely. */}
            <button
              type="button"
              onClick={() => setAssistOpen(true)}
              className="flex items-center gap-1 h-8 px-3 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] cursor-pointer text-[13px] font-semibold ml-auto mr-2"
              title="Ask Dealer Assist"
            >
              <Sparkles size={14} />
              Assist
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 h-8 px-3 rounded-full bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] cursor-pointer text-[13px] font-bold "
              title="Log out"
            >
              <LogOut size={14} />
              Out
            </button>
          </div>
        </div>

        {/* OVERVIEW SECTION */}
        {activeSection === "dashboard" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Framed header. The plain heading read like a page title on a
                form; a dealer opening this at 8am should see whose floor it is,
                that it is live, and have the assistant one click away. */}
            <div className="card p-5 md:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[length:var(--t-micro)] bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--cyan)] animate-pulse" />
                    {dealershipLabel} · live
                  </span>
                  <span className="text-[length:var(--t-micro)] text-[rgba(232,234,230,0.55)]">
                    {todayLabel} · sales &amp; workshop
                  </span>
                </div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">
                  Dealership overview
                </h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
                  Stock, leads, workshop and money — one live view of the floor.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigateTo("upload")} className="btn btn-primary">
                  + New Inventory
                </button>
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Needs a reply — deliberately first. This is the only number on
                  the overview that is actionable the moment the dealer opens
                  the app, so it leads and it is the only one allowed to go red. */}
              <button
                onClick={() => navigateTo("leads")}
                className="stat-card p-4 text-left cursor-pointer hover:border-[color:var(--cyan-soft)] transition-colors"
              >
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Needs a reply</div>
                <div
                  className={`text-2xl font-serif font-semibold mt-1 ${
                    replyIsLate ? "text-[color:var(--white)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  <Counter value={awaitingReply.length} />
                </div>
                <div
                  className={`text-[13px] font-semibold mt-1 ${
                    replyIsLate ? "text-[color:var(--white-dim)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {awaitingReply.length === 0
                    ? `All ${unresolvedLeadsCount} open leads answered`
                    : `Oldest waiting ${formatWait(oldestWaitMs)} · ${unresolvedLeadsCount} open`}
                </div>
              </button>
              <button
                onClick={() => navigateTo("inventory")}
                className="stat-card p-4 text-left cursor-pointer hover:border-[color:var(--cyan-soft)] transition-colors"
              >
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Cars in stock</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--white)] mt-1"><Counter value={activeVehiclesCount} /></div>
                <div className="text-[13px] font-semibold mt-1 text-[rgba(232,234,230,0.55)]">
                  {agedStockCount > 0
                    ? `${agedStockCount} over ${AGED_DAYS} days`
                    : `None over ${AGED_DAYS} days`}
                </div>
              </button>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Units sold</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--white)] mt-1"><Counter value={soldUnitsCount} /></div>
                <div className="text-[13px] text-[rgba(232,234,230,0.55)] font-semibold mt-1">
                  {activeVehiclesCount + soldUnitsCount > 0
                    ? `${Math.round((soldUnitsCount / (activeVehiclesCount + soldUnitsCount)) * 100)}% of the floor moved`
                    : "No stock loaded yet"}
                </div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Banked</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--cyan-bright)] mt-1"><Counter value={totalRevenue} prefix="R " /></div>
                <div className="text-[13px] font-semibold mt-1 text-[rgba(232,234,230,0.55)]">
                  {outstandingRevenue > 0
                    ? `R${outstandingRevenue.toLocaleString("en-ZA")} still owed`
                    : "Nothing outstanding"}
                </div>
              </div>
            </div>

            {/* End of day summary Card */}
            {(selectedRole === 'manager' || selectedRole === 'owner') && (
              <div className="card p-5 bg-gradient-to-r from-[color:var(--cyan-faint)] via-[color:var(--ink-2)] to-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg shadow-[color:var(--cyan-faint)]">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-tr from-[color:var(--cyan-faint)] to-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] text-[color:var(--cyan)]">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="font-sans text-base font-semibold tracking-tight text-[color:var(--white)]">End of day summary</h3>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 max-w-xl leading-relaxed">
                      Generate a detailed operational report including customer leads worked, vehicles sold, reconditioning layout, and gross yield margins for the past 24 hours.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEODReport(true)}
                  className="px-5 py-3 bg-gradient-to-r from-[color:var(--cyan-soft)] to-[color:var(--cyan)] hover:from-[color:var(--cyan)] hover:to-[color:var(--cyan)] text-[color:var(--ink)] rounded-xl text-[13px] font-bold shadow-lg shadow-[color:var(--cyan-faint)] hover:shadow-[color:var(--cyan-soft)] cursor-pointer active:scale-95 transition-all flex items-center gap-2 self-stretch md:self-auto justify-center"
                >
                  <Sparkles size={14} className="animate-pulse" />
                  Compile EOD Summary
                </button>
              </div>
            )}

            {/* Daily Analytics — sample until live site analytics connected */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Website analytics</div>
                <span className="text-[13px] font-semibold tracking-normal px-2 py-0.5 rounded-full bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)]">
                  Sample / demo data
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-[color:var(--glass)] rounded-lg p-3">
                   <div className="text-[13px] text-[rgba(232,234,230,0.72)]">Visits</div>
                   <div className="text-lg font-bold text-[color:var(--white)]">{mockDailySummary.visits}</div>
                 </div>
                 <div className="bg-[color:var(--glass)] rounded-lg p-3">
                   <div className="text-[13px] text-[rgba(232,234,230,0.72)]">Unique Visitors</div>
                   <div className="text-lg font-bold text-[color:var(--white)]">{mockDailySummary.uniqueVisitors}</div>
                 </div>
                 <div className="bg-[color:var(--glass)] rounded-lg p-3">
                   <div className="text-[13px] text-[rgba(232,234,230,0.72)]">Avg Duration</div>
                   <div className="text-lg font-bold text-[color:var(--white)]">{mockDailySummary.avgVisitDuration}</div>
                 </div>
                 <div className="bg-[color:var(--glass)] rounded-lg p-3">
                   <div className="text-[13px] text-[rgba(232,234,230,0.72)]">Bounce Rate</div>
                   <div className="text-lg font-bold text-[color:var(--white)]">{mockDailySummary.bounceRate}</div>
                 </div>
              </div>
            </div>

            {/* Featured Catalog list */}
            <div className="card">
              <div className="card-header flex justify-between items-center border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Recent Showroom Inventory</h3>
                <button
                  onClick={() => navigateTo("inventory")}
                  className="btn btn-secondary btn-sm"
                >
                  View Database
                </button>
              </div>
              <div className="card-body p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {state.vehicles.filter((v) => v.status === "INVENTORY").slice(0, 4).map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedDetailVehicle(v)}
                    className="v-card p-3 cursor-pointer group hover:-translate-y-0.5 transition-transform duration-200"
                  >
                    <div className="aspect-[4/3] rounded-lg bg-[color:var(--ink-2)] flex items-center justify-center overflow-hidden mb-3 shadow-md shadow-black/40">
                      {v.images && v.images.length > 0 ? (
                        <img src={v.images[0]} alt={`${v.make}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-[color:var(--ink-2)] border border-white/5 flex items-center justify-center text-[rgba(232,234,230,0.45)] font-semibold text-lg">
                          {v.make.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-[13px] text-[color:var(--white)] truncate">{v.year} {v.make} {v.model}</h4>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] truncate mt-0.5">{v.transmission} / {v.fuelType}</p>
                    <div className="text-[16px] font-bold text-[color:var(--cyan-bright)] mt-2">{formatZAR(v.retailPrice)}</div>
                    <div className="text-[13px] text-[rgba(232,234,230,0.72)] mt-2 font-mono">Stock Ref: {v.stockNumber}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Leads list */}
            <div className="card">
              <div className="card-header flex justify-between items-center border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Leads</h3>
                <button
                  onClick={() => navigateTo("leads")}
                  className="btn btn-secondary btn-sm"
                >
                  Open Pipelines
                </button>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-[13px] text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                      <th className="py-3 px-4 font-bold">Prospect</th>
                      <th className="py-3 px-4 font-bold">Model Focus</th>
                      <th className="py-3 px-4 font-bold">Channel</th>
                      <th className="py-3 px-4 font-bold">Stage Status</th>
                      <th className="py-3 px-4 font-bold">Responsible Agent</th>
                      <th className="py-3 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.leads.slice(0, 5).map((l) => (
                      <tr key={l.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4 font-semibold text-[color:var(--white)]">
                          {l.firstName} {l.lastName}
                          <span className="block text-[13px] font-normal text-[rgba(232,234,230,0.72)] mt-0.5">{l.phone}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold">{getVehicleLabel(l.vehicleId)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] rounded text-[13px] font-bold tracking-normal">
                            {l.source}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] rounded text-[13px] font-bold tracking-normal">
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[rgba(232,234,230,0.72)]">{getUserLabel(l.assignedUserId)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setLeadDetailId(l.id)}
                            className="px-4 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--ink)] transition-all font-bold rounded-lg text-[13px] cursor-pointer shadow-lg shadow-[color:var(--cyan-faint)] active:scale-95"
                          >
                            Review File
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS SECTION */}
        {activeSection === "analytics" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Traffic Analytics</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Showroom visitors & conversion metrics</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Monthly Page Views</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--white)] mt-1">12,847</div>
                <div className="text-[13px] text-[color:var(--cyan)] font-semibold mt-1">+24% traffic growth</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Filter views</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--white)] mt-1">8,432</div>
                <div className="text-[13px] text-[color:var(--cyan)] font-semibold mt-1">+18% high-intent actions</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Lead Conversion Rate</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--white)] mt-1">
                  {Math.round((state.leads.length / 8432) * 1000) / 10}%
                </div>
                <div className="text-[13px] text-[color:var(--cyan)] font-semibold mt-1">Standard industry index</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Average View Time</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--white)] mt-1">2m 14s</div>
                <div className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold mt-1">Normal retention</div>
              </div>
            </div>

            {/* Weekly chart mock */}
            <div className="card">
              <div className="card-header px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-[16px]">Weekly Traffic Activity Overview</h3>
              </div>
              <div className="card-body p-4 flex flex-col gap-2">
                <div className="flex items-end justify-around h-44 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 gap-2">
                  {[1240, 1940, 1590, 2470, 2120, 3010, 2650].map((val, idx) => {
                    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                    const percent = (val / 3010) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-[13px] text-[color:var(--cyan)] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          {val}
                        </span>
                        <div
                          style={{ height: `${percent * 0.8}px` }}
                          className="w-full bg-gradient-to-t from-[color:var(--cyan)] to-[color:var(--cyan)] rounded-t-sm opacity-70 group-hover:opacity-100 transition-all duration-200"
                        />
                        <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-1">{days[idx]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ALL VEHICLES SECTION */}
        {activeSection === "inventory" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Stock</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                  Manage live pre-owned floor assets and pricing
                  {state.vehicles.some((v: any) => (v.images?.length || 0) > 0) && (
                    <span className="text-[color:var(--cyan)] ml-2">
                      · {state.vehicles.filter((v: any) => (v.images?.length || 0) > 0).length} with TruLens photos
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    refreshFromServer()
                      .then((data) => {
                        setState(data);
                        addNotification("DMS refreshed", "Loaded latest vehicles & TruLens photos from server", "info");
                      })
                      .catch((err) => alert(err.message || "Refresh failed"));
                  }}
                  className="btn btn-secondary text-[13px] font-bold px-3 py-2 flex items-center gap-2"
                  title="Reload inventory from server (shows photos exported from TruLens)"
                >
                  <RefreshCw size={12} /> Refresh photos
                </button>
                <div className="relative flex-1 md:flex-none">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,234,230,0.72)]" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search model, make, VIN..."
                    className="w-full md:w-56 bg-[color:var(--glass)] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-[13px] text-[color:var(--white)] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[color:var(--cyan)]"
                  />
                </div>
                <Segmented
                  value={inventoryStatusFilter}
                  onChange={setInventoryStatusFilter}
                  options={[
                    { value: "ALL", label: "All" },
                    { value: "INVENTORY", label: "In stock" },
                    { value: "PENDING", label: "Pending" },
                    { value: "SOLD", label: "Sold" },
                  ]}
                />
                <Segmented
                  value={inventoryPhotoFilter}
                  onChange={setInventoryPhotoFilter}
                  options={[
                    { value: "ALL", label: "All photos" },
                    { value: "NEEDS", label: "Needs shoot" },
                    { value: "PARTIAL", label: "Partial" },
                    { value: "READY", label: "Web-ready" },
                  ]}
                />
                <Segmented
                  value={inventoryAgeFilter}
                  onChange={setInventoryAgeFilter}
                  options={[
                    { value: "ALL", label: "Any age" },
                    { value: "30", label: "30+" },
                    { value: "60", label: "60+" },
                    { value: "90", label: "90+" },
                  ]}
                />
              </div>
            </div>

            {/* Grid list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.vehicles
                .filter((v) => {
                  const mSearch =
                    (v.make || "").toLowerCase().includes(inventorySearch.toLowerCase()) ||
                    (v.model || "").toLowerCase().includes(inventorySearch.toLowerCase()) ||
                    (v.stockNumber || "").toLowerCase().includes(inventorySearch.toLowerCase());
                  const mStatus = inventoryStatusFilter === "ALL" || v.status === inventoryStatusFilter;
                  const r = computeDmsGalleryReadiness(v as any);
                  const mPhoto =
                    inventoryPhotoFilter === "ALL" ||
                    (inventoryPhotoFilter === "NEEDS" && r.level === "capture") ||
                    (inventoryPhotoFilter === "PARTIAL" && r.level === "partial") ||
                    (inventoryPhotoFilter === "READY" && r.webReady);
                  const days = Number(v.daysInInventory) || 0;
                  const mAge = inventoryAgeFilter === "ALL" || days >= Number(inventoryAgeFilter);
                  return mSearch && mStatus && mPhoto && mAge;
                })
                .map((v) => {
                  const readiness = computeDmsGalleryReadiness(v as any);
                  const days = Number(v.daysInInventory) || 0;
                  const ageTone =
                    days >= 90 ? "text-[color:var(--muted)]" : days >= 60 ? "text-[color:var(--warning)]" : days >= 30 ? "text-[color:var(--cyan-bright)]" : "text-[color:var(--white)]";
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedDetailVehicle(v)}
                      className="v-card flex flex-col h-full group hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                    >
                      {/* Card Image area */}
                      <div className="aspect-[16/10] bg-[color:var(--ink-2)] flex items-center justify-center relative border-b border-white/5 overflow-hidden select-none">
                        {v.images && v.images.length > 0 ? (
                          <img src={v.images[0]} alt={`${v.make}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-tr from-[color:var(--cyan)] to-[color:var(--cyan)] rounded-xl flex items-center justify-center text-[color:var(--ink)] font-semibold text-xl shadow-lg">
                            {(v.make || "??").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[13px] font-bold font-mono tracking-wider  ${
                          v.status === "INVENTORY" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : v.status === "PENDING" ? "bg-[color:var(--glass)] text-[color:var(--warning)]" : "bg-[color:var(--glass)] text-[color:var(--muted)]"
                        }`}>
                          {v.status === "INVENTORY" ? "Showroom Floor" : v.status === "PENDING" ? "Sale Pending" : "Delivered"}
                        </span>
                        <span
                          className="absolute top-3 left-3 px-2 py-0.5 rounded text-[13px] font-bold border max-w-[70%] truncate"
                          style={{ color: readiness.color, borderColor: readiness.color + "55", background: readiness.color + "22" }}
                          title={(readiness.reasons || []).join(" · ")}
                        >
                          {readiness.label}
                        </span>
                      </div>

                      {/* Info Area */}
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-[16px] text-[color:var(--white)] truncate">{v.year || ""} {v.make || "Vehicle"} {v.model || ""}</h4>
                          <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                            {v.trim || "Standard Specs"} · <span className="font-mono">{v.stockNumber}</span>
                          </p>
                          <div className="text-[13px] text-[rgba(232,234,230,0.72)] flex flex-wrap gap-x-2 gap-y-1 mt-2">
                            <span>{Number(v.mileage || 0).toLocaleString()} km</span>
                            <span>•</span>
                            <span>{v.transmission || "—"}</span>
                            <span>•</span>
                            <span>{v.fuelType || "—"}</span>
                            {readiness.photoCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-[color:var(--cyan)]">{readiness.photoCount} photos</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-white/5 pt-3 mt-1 flex justify-between items-center">
                          <div>
                            <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">Retail Valuation</div>
                            <div className="text-base font-semibold text-[color:var(--cyan-bright)] font-mono mt-0.5">{formatZAR(Number(v.retailPrice) || 0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">Days in stock</div>
                            <div className={`text-[13px] font-bold mt-0.5 ${ageTone}`}>{days} Days{days >= 60 ? " · age" : ""}</div>
                          </div>
                        </div>

                        {/* Actions — stopPropagation so card click still opens detail */}
                        <div
                          className="flex gap-2 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[13px] font-semibold tracking-normal bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)]"
                            onClick={() => openTruLens(v.stockNumber)}
                            title="Guided shoot in TruLens"
                          >
                            <Camera size={11} /> Shoot
                          </button>
                          <button
                            type="button"
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[13px] font-semibold tracking-normal bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/25"
                            onClick={() => openStockWhatsApp(v)}
                            title="WhatsApp stock blurb"
                          >
                            <MessageCircle size={11} /> WhatsApp
                          </button>
                          <button
                            type="button"
                            className="px-2 py-2 rounded-lg text-[13px] font-bold bg-white/5 text-[rgba(232,234,230,0.72)] border border-white/10 hover:text-[color:var(--white)]"
                            onClick={async () => {
                              try {
                                await copyStockBlurb(v);
                                addNotification("Copied", `Share text for ${v.stockNumber}`, "info");
                              } catch {
                                addNotification("Copy failed", "Could not access clipboard", "error");
                              }
                            }}
                            title="Copy share text"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* WORKFLOW PIPELINE SECTION */}
        {activeSection === "workflow" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Reconditioning & Delivery Pipeline</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Control prep workflows for pre-owned stock</p>
            </div>

            {/* Stages Grid columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["INVENTORY", "PENDING", "SOLD"].map((stage) => {
                const filtered = state.vehicles.filter((v) => v.status === stage);
                return (
                  <div key={stage} className="card bg-[color:var(--glass)] flex flex-col h-full min-h-[500px]">
                    <div className="card-header border-b border-white/5 px-4 py-3 flex justify-between items-center bg-[color:var(--glass)]">
                      <span className="font-bold text-[13px]  text-[color:var(--white)]">
                        {stage === "INVENTORY" ? "Floor Inventory" : stage === "PENDING" ? "Processing Sale" : "Delivered"}
                      </span>
                      <span className="px-2 py-0.5 bg-[color:var(--glass)] rounded-full text-[rgba(232,234,230,0.72)] text-[13px] font-bold">
                        {filtered.length}
                      </span>
                    </div>

                    <div className="p-3 flex-1 flex flex-col gap-3 min-h-[300px]">
                      {filtered.map((v) => (
                        <div key={v.id} className="pipeline-card p-3 flex flex-col justify-between gap-3 shadow-md">
                          <div>
                            <div className="font-bold text-[13px] text-[color:var(--white)] truncate">{v.year} {v.make} {v.model}</div>
                            <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Ref: {v.stockNumber} / {v.mileage.toLocaleString()} km</p>
                            <p className="text-[13px] font-bold text-[color:var(--cyan-bright)] mt-2">{formatZAR(v.retailPrice)}</p>
                          </div>

                          <div className="flex justify-between items-center border-t border-white/3 pt-3">
                            <span className="text-[13px] text-[rgba(232,234,230,0.72)]">Age: {v.daysInInventory}d</span>
                            
                            <div className="flex gap-1">
                              {stage !== "INVENTORY" && (
                                <button
                                  onClick={() => moveVehicle(v.id, v.status, "PREV")}
                                  className="px-2 py-1 bg-[color:var(--glass)] border border-white/5 rounded text-[13px] font-bold hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  &larr; Prev
                                </button>
                              )}
                              {stage !== "SOLD" && (
                                <button
                                  onClick={() => moveVehicle(v.id, v.status, "NEXT")}
                                  className="px-2 py-1 bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] rounded text-[13px] font-bold hover:bg-[color:var(--cyan-soft)] transition-all cursor-pointer"
                                >
                                  Next &rarr;
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* UPLOAD VEHICLE SECTION */}
        {activeSection === "upload" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Add vehicle</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                  Create stock metadata here. <b className="text-[color:var(--white)]">Photos only in TruLens</b> (guided shoot → Export to DMS).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openTruLens()}
                  className="btn btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-bold"
                >
                  <Camera size={12} /> Open TruLens
                </button>
                <button 
                  type="button" 
                  onClick={loadAllState} 
                  className="btn btn-secondary flex items-center gap-2 border border-white/10 hover:bg-white/5 px-3 py-2 rounded-lg text-[13px]"
                >
                  <RefreshCw size={12} className="text-[color:var(--cyan)]" />
                  Pull gallery
                </button>
              </div>
            </div>

            <div className="card max-w-[700px] mx-auto w-full">
              <div className="card-body p-6 flex flex-col gap-4">
                <form onSubmit={handlePublishVehicle} className="flex flex-col gap-4">
                  {/* Dealership — which dealer site this stock belongs to */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Dealership</label>
                    <select
                      value={newVehicleForm.dealershipId}
                      onChange={(e) => setNewVehicleForm((p) => ({ ...p, dealershipId: e.target.value }))}
                      className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                    >
                      {DEALERSHIPS.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">This stock will only appear on this dealer's own website and inventory.</p>
                  </div>

                  {/* Showroom tier — which category page this car lands on */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Showroom Category</label>
                    <select
                      value={newVehicleForm.category}
                      onChange={(e) => setNewVehicleForm((p) => ({ ...p, category: e.target.value }))}
                      className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                    >
                      <option value="">Auto — decide from price &amp; model</option>
                      <option value="used">Premium Used</option>
                      <option value="select">Premium Select</option>
                      <option value="performance">Premium Performance</option>
                    </select>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Leave on Auto and the website guesses from price and model name. Pick a tier to override that guess.</p>
                  </div>

                  {/* Specification grid panel */}
                  <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-4 flex flex-col gap-3">
                    <span className="text-[13px] font-bold font-mono tracking-wider  text-[color:var(--cyan)]">Showroom Vehicle Specifications</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Year</label>
                        <input
                          type="number"
                          value={newVehicleForm.year}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, year: parseInt(e.target.value) || 2026 }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Make</label>
                        <input
                          type="text"
                          value={newVehicleForm.make}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, make: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Model</label>
                        <input
                          type="text"
                          value={newVehicleForm.model}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, model: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Trim Level</label>
                        <input
                          type="text"
                          value={newVehicleForm.trim}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, trim: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Engine</label>
                        <input
                          type="text"
                          value={newVehicleForm.engine}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, engine: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Transmission</label>
                        <select
                          value={newVehicleForm.transmission}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, transmission: e.target.value as any }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                        >
                          <option className="bg-[color:var(--ink-2)]" value="Automatic">Automatic</option>
                          <option className="bg-[color:var(--ink-2)]" value="Manual">Manual</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Fuel Type</label>
                        <select
                          value={newVehicleForm.fuelType}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, fuelType: e.target.value as any }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                        >
                          <option className="bg-[color:var(--ink-2)]" value="Diesel">Diesel</option>
                          <option className="bg-[color:var(--ink-2)]" value="Petrol">Petrol</option>
                          <option className="bg-[color:var(--ink-2)]" value="Hybrid">Hybrid</option>
                          <option className="bg-[color:var(--ink-2)]" value="Electric">Electric</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold">Body Type</label>
                        <input
                          type="text"
                          value={newVehicleForm.bodyType}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, bodyType: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Retail specs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Retail Price (ZAR)</label>
                      <input
                        type="number"
                        value={newVehicleForm.retailPrice}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, retailPrice: parseFloat(e.target.value) || 0 }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Cost Price (ZAR)</label>
                      <input
                        type="number"
                        value={newVehicleForm.costPrice}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, costPrice: parseFloat(e.target.value) || 0 }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Mileage (km)</label>
                      <input
                        type="number"
                        value={newVehicleForm.mileage}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, mileage: parseInt(e.target.value) || 0 }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Stock Number</label>
                      <input
                        type="text"
                        value={newVehicleForm.stockNumber}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, stockNumber: e.target.value }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] rounded-xl p-4 flex flex-col gap-2">
                    <span className="text-[13px] font-bold font-mono tracking-wider  text-[color:var(--cyan)] flex items-center gap-2">
                      <Camera size={12} /> Photos live in TruLens only
                    </span>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                      After you save this unit, open <b className="text-[color:var(--white)]">TruLens</b>, shoot the guided slots for stock{" "}
                      <span className="font-mono text-[color:var(--cyan)]">{newVehicleForm.stockNumber}</span>, then tap{" "}
                      <b className="text-[color:var(--white)]">Export to DMS</b>. Gallery appears here automatically.
                    </p>
                    <button
                      type="button"
                      onClick={() => openTruLens(newVehicleForm.stockNumber)}
                      className="self-start mt-1 text-[13px] font-bold tracking-normal px-3 py-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)]"
                    >
                      Open TruLens for this stock #
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Description</label>
                    <textarea
                      rows={3}
                      value={newVehicleForm.description}
                      onChange={(e) => setNewVehicleForm((p) => ({ ...p, description: e.target.value }))}
                      className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                    ></textarea>
                  </div>

                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection("inventory")}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Publish to Active Stock
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* LEAD CRM SECTION */}
        {/* STOCK HEALTH — ageing and margin, the two numbers that decide whether
            a yard makes money. Everything shown was already in the data. */}
        {activeSection === "stock_health" && (() => {
          const live = filteredVehicles.filter((v) => v.status === "INVENTORY");
          const sold = filteredVehicles.filter((v) => v.status === "SOLD");

          const capitalTiedUp = live.reduce((sum, v) => sum + costBasis(v), 0);
          const reconTotal    = live.reduce((sum, v) => sum + reconSpend(v), 0);
          const projected     = live.reduce((sum, v) => sum + grossMargin(v).rand, 0);
          const realised      = sold.reduce((sum, v) => sum + grossMargin(v).rand, 0);
          const aged          = live.filter((v) => stockAge(v) > 60);
          const agedCapital   = aged.reduce((sum, v) => sum + costBasis(v), 0);

          const byAge = [...live].sort((a, b) => stockAge(b) - stockAge(a));

          return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Stock health</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                  What your stock is costing you, and what it stands to make
                </p>
              </div>

              {/* The four numbers worth knowing before opening the yard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Capital in stock", value: formatZAR(capitalTiedUp), sub: `${live.length} cars, incl. ${formatZAR(reconTotal)} recon` },
                  { label: "Projected margin", value: formatZAR(projected), sub: "if everything sells at asking" },
                  { label: "Realised margin", value: formatZAR(realised), sub: `${sold.length} sold` },
                  { label: "Tied up over 60 days", value: formatZAR(agedCapital), sub: `${aged.length} ${aged.length === 1 ? "car" : "cars"}`, warn: aged.length > 0 },
                ].map((c) => (
                  <div key={c.label} className="card p-4 flex flex-col gap-1">
                    <span className="text-[13px] text-[rgba(232,234,230,0.55)]">{c.label}</span>
                    <span className={`text-[20px] font-semibold tracking-tight ${c.warn ? "text-[color:var(--muted)]" : "text-[color:var(--white)]"}`}>{c.value}</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.55)]">{c.sub}</span>
                  </div>
                ))}
              </div>

              {/* Where the money is sitting, by age */}
              <div className="card p-4 flex flex-col gap-3">
                <span className="text-[13px] font-semibold text-[color:var(--white)]">Ageing</span>
                {AGE_BANDS.map((b) => {
                  const inBand = live.filter((v) => { const d = stockAge(v); return d >= b.min && d <= b.max; });
                  const cap = inBand.reduce((sum, v) => sum + costBasis(v), 0);
                  const share = live.length ? (inBand.length / live.length) * 100 : 0;
                  return (
                    <div key={b.key} className="flex items-center gap-3">
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)] w-[110px] shrink-0">{b.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-[rgba(232,234,230,0.08)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${share}%`, background: b.tone }} />
                      </div>
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)] w-[40px] text-right">{inBand.length}</span>
                      <span className="text-[13px] text-[rgba(232,234,230,0.55)] w-[90px] text-right">{formatZAR(cap)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Oldest first — this is the list to work through */}
              <div className="card p-0 overflow-x-auto">
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="text-[13px] font-semibold text-[color:var(--white)]">Oldest stock first</span>
                </div>
                {byAge.length === 0 ? (
                  <p className="px-4 py-6 text-[13px] text-[rgba(232,234,230,0.55)]">No cars in stock yet.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-[13px] text-[rgba(232,234,230,0.55)]">
                        <th className="text-left font-medium px-4 py-2">Vehicle</th>
                        <th className="text-right font-medium px-3 py-2">Age</th>
                        <th className="text-right font-medium px-3 py-2">Cost</th>
                        <th className="text-right font-medium px-3 py-2">Recon</th>
                        <th className="text-right font-medium px-3 py-2">Asking</th>
                        <th className="text-right font-medium px-4 py-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byAge.map((v) => {
                        const days = stockAge(v);
                        const band = ageBand(days);
                        const m = grossMargin(v);
                        return (
                          <tr key={v.id} onClick={() => setSelectedDetailVehicle(v)}
                              className="border-t border-white/5 cursor-pointer hover:bg-white/[0.03]">
                            <td className="px-4 py-3">
                              <span className="text-[color:var(--white)]">{v.year} {v.make} {v.model}</span>
                              <span className="text-[13px] text-[rgba(232,234,230,0.55)] ml-2">{v.stockNumber}</span>
                            </td>
                            <td className="px-3 py-3 text-right" style={{ color: band.tone }}>{days}d</td>
                            <td className="px-3 py-3 text-right text-[rgba(232,234,230,0.72)]">{formatZAR(v.costPrice || 0)}</td>
                            <td className="px-3 py-3 text-right text-[rgba(232,234,230,0.72)]">{reconSpend(v) ? formatZAR(reconSpend(v)) : "—"}</td>
                            <td className="px-3 py-3 text-right text-[rgba(232,234,230,0.72)]">{formatZAR(v.retailPrice || 0)}</td>
                            <td className={`px-4 py-3 text-right font-medium ${m.rand < 0 ? "text-[color:var(--muted)]" : "text-[color:var(--white)]"}`}>
                              {formatZAR(m.rand)}
                              <span className="text-[13px] text-[rgba(232,234,230,0.55)] ml-1.5">{m.pct.toFixed(0)}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })()}

        {activeSection === "leads" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Leads</h1>
                {/* The number that should decide how the morning goes. */}
                {(() => {
                  const open = filteredLeads.filter((l) => l.status !== "Closed Won" && l.status !== "Closed Lost");
                  const late = open.filter(leadOverdue).length;
                  const due  = open.filter((l) => l.nextActionAt === today() && !leadOverdue(l)).length;
                  return (
                    <p className="text-[13px] mt-0.5 font-medium text-[rgba(232,234,230,0.72)]">
                      {late > 0 && <span className="text-[color:var(--muted)] font-semibold">{late} overdue</span>}
                      {late > 0 && (due > 0 || open.length > 0) && " · "}
                      {due > 0 && <span>{due} due today</span>}
                      {due > 0 && " · "}
                      {open.length} open
                    </p>
                  );
                })()}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
                  className={`px-3 py-2 rounded-lg border text-[13px] font-semibold cursor-pointer active:scale-95 transition-all ${
                    filterOverdueOnly
                      ? "bg-[color:var(--glass)] border-[color:var(--glass-line)] text-[color:var(--muted)]"
                      : "bg-[color:var(--glass)] border-white/5 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)]"
                  }`}
                >
                  {filterOverdueOnly ? "Show All Leads" : "Show overdue"}
                </button>
                <button 
                  onClick={handleAutoAssign} 
                  disabled={isAutoAssigning || (state?.leads.filter(l => l.status === "New").length === 0)}
                  className={`px-3 py-2 rounded-lg border text-[13px] font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-cyan-500/10 ${
                    isAutoAssigning || (state?.leads.filter(l => l.status === "New").length === 0)
                      ? "bg-[color:var(--glass)] border-white/5 text-[rgba(232,234,230,0.72)] cursor-not-allowed"
                      : "bg-[color:var(--cyan-faint)] border-[color:var(--cyan-soft)] text-[color:var(--cyan-bright)] hover:bg-[color:var(--cyan-soft)] hover:border-[color:var(--cyan-soft)]"
                  }`}
                >
                  <Sparkles size={14} className={isAutoAssigning ? "animate-pulse" : ""} />
                  {isAutoAssigning ? "AI Agent Working..." : "Auto-assign"}
                </button>
                <button onClick={() => setIsLeadModalOpen(true)} className="btn btn-primary">
                  + New Lead
                </button>
              </div>
            </div>

            {/* Toggle view tabs */}
            <div className="flex gap-4 border-b border-white/5 pb-2">
              <button
                onClick={() => setLeadCRMTab("kanban")}
                className={`text-[13px] font-bold transition-all border-b-2 pb-2 cursor-pointer ${
                  leadCrmTab === "kanban" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setLeadCRMTab("list")}
                className={`text-[13px] font-bold transition-all border-b-2 pb-2 cursor-pointer ${
                  leadCrmTab === "list" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                List
              </button>
            </div>

            {leadCrmTab === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
                {["New", "Contacted", "Test Drive Scheduled", "Negotiating", "Closed Won", "Closed Lost"].map((stage) => {
                  const filteredLeads = state.leads.filter((l) => {
                    const statusMatch = l.status === stage;
                    const overdueMatch = !filterOverdueOnly || leadOverdue(l);
                    return statusMatch && overdueMatch;
                  });

                  return (
                    <div key={stage} className="flex-1 min-w-[220px] max-w-[280px] bg-[color:var(--glass)] rounded-xl p-3 flex flex-col gap-3 min-h-[460px] border border-white/5">
                      <div className="flex justify-between items-center border-b border-white/5 pb-1">
                        <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">{stage}</span>
                        <span className="px-2 py-0.5 bg-[color:var(--glass)] rounded-full text-[13px] font-bold text-[rgba(232,234,230,0.72)]">{filteredLeads.length}</span>
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        {filteredLeads.map((l) => (
                          <div
                            key={l.id}
                            onClick={() => setLeadDetailId(l.id)}
                            className="pipeline-card p-3 flex flex-col gap-1 cursor-pointer transition-all hover:-translate-y-0.5 active:scale-98"
                          >
                            <div className="flex justify-between items-start">
                              <div className="font-bold text-[13px] text-[color:var(--white)]">{l.firstName} {l.lastName}</div>
                              {l.digitalScore >= 80 ? (
                                <span className="bg-[color:var(--glass)] text-[color:var(--muted)] text-[13px] px-2 py-0.5 rounded font-semibold tracking-normal border border-[color:var(--glass-line)]">Hot</span>
                              ) : l.digitalScore >= 50 ? (
                                <span className="bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[13px] px-2 py-0.5 rounded font-semibold tracking-normal border border-[color:var(--cyan-faint)]">Warm</span>
                              ) : (
                                <span className="bg-[rgba(232,234,230,0.72)]/15 text-[rgba(232,234,230,0.72)] text-[13px] px-2 py-0.5 rounded font-semibold tracking-normal border border-[rgba(232,234,230,0.72)]/20">Cold</span>
                              )}
                            </div>
                            <div className="text-[13px] text-[rgba(232,234,230,0.72)] truncate">{getVehicleLabel(l.vehicleId)}</div>
                            <div className="text-[13px] text-[rgba(232,234,230,0.55)] mt-1">{l.source}</div>

                            {/* The next step, and whether it has slipped. This is the
                                line a salesperson should be reading, so it gets the weight. */}
                            {(() => {
                              const d = dueLabel(l);
                              if (!d) return null;
                              return (
                                <div className={`text-[13px] mt-2 font-medium ${d.overdue ? "text-[color:var(--muted)]" : "text-[rgba(232,234,230,0.72)]"}`}>
                                  {d.overdue ? "● " : ""}{d.text}
                                </div>
                              );
                            })()}
                            
                            <div className="flex justify-between items-center border-t border-white/3 pt-2 mt-2 gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] text-[color:var(--cyan)] font-bold">Intent: {l.digitalScore}%</span>
                              </div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {l.phone && (
                                  <button
                                    type="button"
                                    className="text-[13px] font-bold px-2 py-0.5 rounded bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30"
                                    title="WhatsApp this lead"
                                    onClick={() => {
                                      const digits = String(l.phone).replace(/\D/g, "").replace(/^0/, "27");
                                      const interest = getVehicleLabel(l.vehicleId);
                                      const text = `Hi ${l.firstName}, following up from the dealership re ${interest}. When works for a chat?`;
                                      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
                                    }}
                                  >
                                    WA
                                  </button>
                                )}
                                {l.status !== "Closed Won" && l.status !== "Closed Lost" && (
                                  <button
                                    type="button"
                                    title="Mark contacted and set the next step"
                                    className="text-[13px] font-semibold px-2 py-0.5 rounded bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]"
                                    onClick={() => advanceLead(l)}
                                  >
                                    Done
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card">
                <div className="card-body p-0 overflow-x-auto">
                  <table className="w-full text-[13px] text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                        <th className="py-3 px-4 font-bold">Customer Name</th>
                        <th className="py-3 px-4 font-bold">Focus Asset</th>
                        <th className="py-3 px-4 font-bold">Origin</th>
                        <th className="py-3 px-4 font-bold">CRM Status</th>
                        <th className="py-3 px-4 font-bold">Agent assigned</th>
                        <th className="py-3 px-4 font-bold text-right">Operation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.leads
                        .filter((l) => !filterOverdueOnly || (l.status === "New" || !l.lastContactedAt))
                        .map((l) => (
                          <tr key={l.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                            <td className="py-3 px-4 font-semibold text-[color:var(--white)]">
                              {l.firstName} {l.lastName}
                              <span className="block text-[13px] font-normal text-[rgba(232,234,230,0.72)] mt-0.5">{l.phone} / {l.email}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold">{getVehicleLabel(l.vehicleId)}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] rounded text-[13px] font-bold tracking-normal">
                                {l.source}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] rounded text-[13px] font-bold tracking-normal">
                                {l.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[rgba(232,234,230,0.72)]">{getUserLabel(l.assignedUserId)}</td>
                            <td className="py-3 px-4 text-right flex justify-end gap-2">
                              {l.phone && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const digits = String(l.phone).replace(/\D/g, "").replace(/^0/, "27");
                                    const interest = getVehicleLabel(l.vehicleId);
                                    const text = `Hi ${l.firstName}, following up from the dealership re ${interest}. When works for a chat?`;
                                    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
                                  }}
                                  className="px-3 py-2 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 rounded-lg text-[13px] font-bold"
                                >
                                  WhatsApp
                                </button>
                              )}
                              <button
                                onClick={() => setLeadDetailId(l.id)}
                                className="px-4 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--ink)] rounded-lg text-[13px] font-bold cursor-pointer transition-all shadow-md active:scale-95"
                              >
                                Review Profile
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LEAD SCORING SECTION */}
        {activeSection === "scoring" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Lead scoring</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Evaluate intent and prioritization indices</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Hot Targets</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--muted)] mt-1">
                  {state.leads.filter((l) => l.digitalScore >= 75).length}
                </div>
                <div className="text-[13px] text-[color:var(--cyan)] font-semibold mt-1">High purchase velocity</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Warm prospects</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--warning)] mt-1">
                  {state.leads.filter((l) => l.digitalScore >= 50 && l.digitalScore < 75).length}
                </div>
                <div className="text-[13px] text-[color:var(--cyan)] font-semibold mt-1">Nurturing schedule</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Cold prospects</div>
                <div className="text-2xl font-serif font-semibold text-[rgba(232,234,230,0.72)] mt-1">
                  {state.leads.filter((l) => l.digitalScore < 50).length}
                </div>
                <div className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold mt-1">Inactive page views</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Average lead score</div>
                <div className="text-2xl font-serif font-semibold text-[color:var(--cyan)] mt-1">
                  {Math.round(state.leads.reduce((sum, l) => sum + l.digitalScore, 0) / state.leads.length)}%
                </div>
                <div className="text-[13px] text-[color:var(--cyan)] font-semibold mt-1">Very interested</div>
              </div>
            </div>

            {/* Matrix Card table */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Lead scores</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-[13px] text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                      <th className="py-3 px-4 font-bold">Prospect</th>
                      <th className="py-3 px-4 font-bold">Intent Score</th>
                      <th className="py-3 px-4 font-bold">Rating Level</th>
                      <th className="py-3 px-4 font-bold">Source</th>
                      <th className="py-3 px-4 font-bold">Current Vehicle focus</th>
                      <th className="py-3 px-4 font-bold text-right">Prioritization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.leads.map((l) => {
                      const hot = l.digitalScore >= 75;
                      const warm = l.digitalScore >= 50 && l.digitalScore < 75;
                      return (
                        <tr key={l.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                          <td className="py-3 px-4 font-semibold text-[color:var(--white)]">{l.firstName} {l.lastName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[color:var(--cyan)] text-[16px]">{l.digitalScore}%</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[13px] font-bold tracking-normal ${
                              hot ? "bg-[color:var(--glass)] text-[color:var(--muted)]" : warm ? "bg-[color:var(--glass)] text-[color:var(--warning)]" : "bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)]"
                            }`}>
                              {hot ? "Hot Target" : warm ? "Warm Prospect" : "Cold Prospect"}
                            </span>
                          </td>
                          <td className="py-3 px-4">{l.source}</td>
                          <td className="py-3 px-4 font-semibold text-[rgba(232,234,230,0.72)]">{getVehicleLabel(l.vehicleId)}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setLeadDetailId(l.id)}
                              className="px-4 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--ink)] transition-all font-bold rounded-lg text-[13px] cursor-pointer shadow-lg shadow-[color:var(--cyan-faint)] active:scale-95"
                            >
                              Analyze Intent
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* INVOICES SECTION */}

        {activeSection === "invoices" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Invoices</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Track accounts receivable and sales transactions</p>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(true)} className="btn btn-primary">
                + Draft Invoice
              </button>
            </div>

            {/* Invoices list */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Invoices</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-[13px] text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                      <th className="py-3 px-4 font-bold">Reference No</th>
                      <th className="py-3 px-4 font-bold">Prospect Bill To</th>
                      <th className="py-3 px-4 font-bold">Associated stock</th>
                      <th className="py-3 px-4 font-bold">Total Amount</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Due Date</th>
                      <th className="py-3 px-4 font-bold text-right">Operation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4 font-mono font-bold text-[color:var(--white)]">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 font-semibold">{getLeadLabel(inv.leadId)}</td>
                        <td className="py-3 px-4">{getVehicleLabel(inv.vehicleId)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[color:var(--cyan-bright)]">
                          {formatZAR(inv.amount + (inv.additionalCharges || 0))}
                          {inv.additionalCharges ? <span className="text-[13px] text-[rgba(232,234,230,0.72)] block">{inv.chargeDescription}</span> : null}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[13px] font-bold tracking-normal ${
                            inv.status === "Paid" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : "bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)]"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold">{inv.dueDate}</td>
                        <td className="py-3 px-4 text-right flex justify-end gap-2">
                          <button
                            onClick={() => setActiveInvoiceId(inv.id)}
                            className="px-4 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--ink)] rounded-lg text-[13px] font-bold cursor-pointer shadow-md active:scale-95 transition-all"
                          >
                            View Record
                          </button>
                          {inv.status !== "Paid" && (
                            <button
                              onClick={async () => {
                                await payInvoice(inv.id);
                                alert("Invoice cleared!");
                                loadAllState();
                              }}
                              className="px-4 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--ink)] rounded-lg text-[13px] font-bold cursor-pointer shadow-md active:scale-95 transition-all"
                            >
                              Finalize Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PDF Printable component integration */}
            {activeInvoiceId && (
              <InvoicePreview
                invoice={state.invoices.find((i) => i.id === activeInvoiceId)!}
                lead={state.leads.find((l) => l.id === state.invoices.find((i) => i.id === activeInvoiceId)?.leadId)}
                vehicle={state.vehicles.find((v) => v.id === state.invoices.find((i) => i.id === activeInvoiceId)?.vehicleId)}
              />
            )}
          </div>
        )}

        {/* AGREEMENTS SECTION */}
        {activeSection === "agreements" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Signed agreements</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Signed documents</p>
              </div>
              <button onClick={() => setIsAgreementModalOpen(true)} className="btn btn-primary">
                + Start New Contract
              </button>
            </div>

            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Signed agreements</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-[13px] text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                      <th className="py-3 px-4 font-bold">Agreement ID</th>
                      <th className="py-3 px-4 font-bold">Contract classification</th>
                      <th className="py-3 px-4 font-bold">Customer account</th>
                      <th className="py-3 px-4 font-bold">Subject Stock</th>
                      <th className="py-3 px-4 font-bold">Value</th>
                      <th className="py-3 px-4 font-bold">Signature Status</th>
                      <th className="py-3 px-4 text-right font-bold">Operation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.agreements.map((agr) => (
                      <tr key={agr.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4 font-mono font-bold text-[color:var(--white)]">{agr.agreementNumber}</td>
                        <td className="py-3 px-4 font-semibold">{agr.type}</td>
                        <td className="py-3 px-4">{getLeadLabel(agr.leadId)}</td>
                        <td className="py-3 px-4">{getVehicleLabel(agr.vehicleId)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[color:var(--cyan-bright)]">{formatZAR(agr.purchasePrice)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[13px] font-bold tracking-normal ${
                            agr.status === "Signed" || agr.status === "Completed" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : "bg-[color:var(--glass)] text-[color:var(--warning)]"
                          }`}>
                            {agr.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setActiveAgreementId(agr.id)}
                            className="px-3 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--ink)] rounded text-[13px] font-bold cursor-pointer active:scale-95 transition-all shadow-md shadow-[color:var(--cyan-faint)]"
                          >
                            Open Contract Terms
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {activeAgreementId && (
              <AgreementPreview
                agreement={state.agreements.find((a) => a.id === activeAgreementId)!}
                lead={state.leads.find((l) => l.id === state.agreements.find((a) => a.id === activeAgreementId)?.leadId)}
                vehicle={state.vehicles.find((v) => v.id === state.agreements.find((a) => a.id === activeAgreementId)?.vehicleId)}
                onSignAgreement={handleSignAgreement}
              />
            )}
          </div>
        )}

        {/* ACCOUNTING & RECON SECTION */}
        {activeSection === "accounting_recon" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <Suspense fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
              <AccountingRecon
              state={state}
              onAddExpense={handleCreateExpense}
              onReconcileExpense={handleReconcileExpense}
              onUpdateVehicle={handleUpdateVehicle}
            />
            </Suspense>
          </div>
        )}


        {/* CUSTOMER FORM SECTION */}
        {activeSection === "customer_form" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Add a customer</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Use this form for remote customer registration.</p>
            </div>
            <div className="max-w-lg">
              <CustomerLeadForm dealershipId={dealershipId || "d1"} vehicles={filteredVehicles} onSuccess={() => alert("Lead Captured!")} />
            </div>
          </div>
        )}

        {/* TASKS SECTION */}
        {activeSection === "tasks" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Showroom Tasks</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Configure daily operational checklists & reconditioning items</p>
              </div>
              <button onClick={() => setIsTaskModalOpen(true)} className="btn btn-primary">
                + Log Directive Task
              </button>
            </div>

            {/* Checklist records */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Showroom Tasks</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-[13px] text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                      <th className="py-3 px-4 font-bold">Showroom Directive</th>
                      <th className="py-3 px-4 font-bold">Priority</th>
                      <th className="py-3 px-4 font-bold">Assigned Specialist</th>
                      <th className="py-3 px-4 font-bold">Due Date</th>
                      <th className="py-3 px-4 font-bold">Processing status</th>
                      <th className="py-3 px-4 text-right font-bold">Operation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.tasks.map((t) => (
                      <tr key={t.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4">
                          <span className="font-semibold text-[color:var(--white)] block">{t.title}</span>
                          <span className="text-[13px] text-[rgba(232,234,230,0.72)] block mt-0.5">
                            Focus: {getVehicleLabel(t.vehicleId || "")} / Lead: {getLeadLabel(t.leadId || "")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[13px] font-bold tracking-normal ${
                            t.priority === "Urgent" ? "bg-[color:var(--glass)] text-[color:var(--muted)]" : t.priority === "High" ? "bg-[color:var(--glass)] text-[color:var(--warning)]" : "bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)]"
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[rgba(232,234,230,0.72)]">{getUserLabel(t.assignedUserId)}</td>
                        <td className="py-3 px-4">{t.dueDate}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[13px] font-bold tracking-normal ${
                            t.status === "Completed" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : "bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)]"
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {t.status !== "Completed" ? (
                            <button
                              onClick={async () => {
                                await updateTask(t.id, { status: "Completed" });
                                loadAllState();
                              }}
                              className="px-3 py-2 bg-[color:var(--cyan-faint)] hover:bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] rounded text-[13px] font-bold cursor-pointer active:scale-95 transition-all"
                            >
                              Resolve
                            </button>
                          ) : (
                            <span className="text-[color:var(--cyan)] font-bold text-[13px]">Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TEAM & PERFORMANCE SECTION */}
        {activeSection === "manager" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Team</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                  {activeSeats} {activeSeats === 1 ? "person" : "people"} with access
                </p>
              </div>
              <button onClick={() => { setIssuedCode(null); setSeatError(""); setIsUserModalOpen(true); }} className="btn btn-primary">
                + Add staff member
              </button>
            </div>

            {seatError && <p className="text-[13px] text-[color:var(--muted)]">{seatError}</p>}

            {/* Who can sign in. Separate from the performance cards below, which
                also cover people who no longer have access. */}
            <div className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
                <span className="text-[13px] font-bold tracking-normal text-[rgba(232,234,230,0.72)]">Access</span>
                <span className="text-[13px] text-[rgba(232,234,230,0.72)]">{activeSeats} active</span>
              </div>
              {seats.length === 0 ? (
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] py-2">
                  Only you can sign in so far. Add your salespeople so each has their own code.
                </p>
              ) : (
                seats.map((s) => (
                  <div key={s.accountId} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className="min-w-0">
                      <div className={`text-[13px] font-bold truncate ${s.isActive ? "text-[color:var(--white)]" : "text-[rgba(232,234,230,0.72)] line-through"}`}>
                        {s.name}
                      </div>
                      <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">
                        {s.role}{s.isActive ? "" : " · no access"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRotateSeat(s.userId, s.name)}
                        className="text-[13px]  font-bold text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"
                        title="Issue a replacement code"
                      >
                        New code
                      </button>
                      <button
                        onClick={() => handleToggleSeat(s.userId, !s.isActive)}
                        className={`text-[13px]  font-bold cursor-pointer ${s.isActive ? "text-[color:var(--muted)] hover:opacity-80" : "text-[color:var(--cyan)] hover:opacity-80"}`}
                      >
                        {s.isActive ? "Remove access" : "Restore"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sales reps card rosters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {state.users.map((u) => {
                const leadsAssigned = state.leads.filter((l) => l.assignedUserId === u.id).length;
                const dealsCompleted = state.leads.filter((l) => l.assignedUserId === u.id && l.status === "Closed Won").length;
                return (
                  <div key={u.id} className="card p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[color:var(--cyan)] to-[color:var(--cyan)] flex items-center justify-center font-bold text-[13px] text-[color:var(--ink)]">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-[13px] text-[color:var(--white)]">{u.name}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">{u.role}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mt-1">
                      <div className="bg-[color:var(--glass)] border border-white/5 rounded p-2">
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{leadsAssigned}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider mt-0.5">Leads</div>
                      </div>
                      <div className="bg-[color:var(--glass)] border border-white/5 rounded p-2">
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{dealsCompleted}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider mt-0.5">Sales</div>
                      </div>
                      <div className="bg-[color:var(--glass)] border border-white/5 rounded p-2">
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{u.isActive ? "Online" : "Away"}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-bold tracking-wider mt-0.5">Status</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Commission estimate */}
            {state && (
              <CommissionEstimator 
                users={state.users} 
                leads={state.leads} 
                vehicles={state.vehicles} 
              />
            )}

            {/* Permissions list */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">System Access Roster</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-[13px] text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                      <th className="py-3 px-4 font-bold">Assigned Specialist</th>
                      <th className="py-3 px-4 font-bold">Email</th>
                      <th className="py-3 px-4 font-bold">System Role</th>
                      <th className="py-3 px-4 font-bold">Contact Number</th>
                      <th className="py-3 px-4 font-bold">Access permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.users.map((u) => (
                      <tr key={u.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4 font-semibold text-[color:var(--white)]">{u.name}</td>
                        <td className="py-3 px-4 font-semibold">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[13px] font-bold tracking-normal ${
                            u.role === "admin" ? "bg-[color:var(--glass)] text-[color:var(--muted)]" : "bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)]"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[rgba(232,234,230,0.72)]">{u.phone}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] rounded text-[13px] font-bold tracking-normal">
                            {u.isActive ? "Authorized Profile" : "Archived"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* LEASE AMORTIZATION CALCULATOR */}
        {activeSection === "payment" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Repayment calculator</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Model lease structures & monthly amortization schedules</p>
            </div>
            <AmortizationCalc initialPrice={state.vehicles[0]?.retailPrice || 485000} />
          </div>
        )}

        {/* WORDPRESS & WEB SYNC MODULE */}
        {activeSection === "integration" && (
          <Suspense fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
            <WordPressIntegration onRefresh={loadAllState} />
          </Suspense>
        )}

        {/* STOCK MEDIA HUB — gallery only; capture lives in TruLens */}
        {activeSection === "media_web" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)] flex items-center gap-2">
                  <Image size={24} className="text-[color:var(--cyan)]" /> Stock media & web readiness
                </h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium max-w-xl">
                  Premium stores gallery + publish evidence. Capture is <b className="text-[color:var(--white)]">only in TruLens</b>.
                  Pipeline: Shoot → Export to DMS → refresh here → website feed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openTruLens()}
                className="btn btn-primary text-[13px] font-bold flex items-center gap-2 px-4 py-3"
              >
                <Camera size={14} /> Open TruLens capture
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-bold">With photos</div>
                <div className="text-2xl font-semibold text-[color:var(--cyan)] mt-1">
                  {filteredVehicles.filter(v => (v.images?.length || 0) > 0).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-bold">Need shoot</div>
                <div className="text-2xl font-semibold text-[color:var(--warning)] mt-1">
                  {filteredVehicles.filter(v => computeDmsGalleryReadiness(v).level === "capture").length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-bold">Web-ready gallery</div>
                <div className="text-2xl font-semibold text-[color:var(--cyan-bright)] mt-1">
                  {filteredVehicles.filter(v => computeDmsGalleryReadiness(v).webReady).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-bold">Public stock feed</div>
                <a
                  className="text-[13px] text-[color:var(--cyan-bright)] font-mono mt-2 block break-all hover:underline"
                  href={`/api/public/stock?dealer=${encodeURIComponent(getDealerSlug())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/public/stock?dealer={getDealerSlug()}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredVehicles.map(v => {
                const r = computeDmsGalleryReadiness(v as any);
                return (
                  <div key={v.id} className="card overflow-hidden flex flex-col">
                    <div className="aspect-[16/10] bg-[color:var(--ink-2)] relative">
                      {r.photoCount > 0 ? (
                        <img src={v.images![0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[rgba(232,234,230,0.45)] gap-2">
                          <Camera size={28} />
                          <span className="text-[13px] font-bold tracking-normal">No gallery yet</span>
                        </div>
                      )}
                      <span
                        className="absolute top-2 left-2 text-[13px] font-bold px-2 py-0.5 rounded border"
                        style={{ color: r.color, borderColor: r.color + "55", background: r.color + "22" }}
                        title={r.reasons.join(" · ")}
                      >
                        {r.label}
                      </span>
                      {r.photoCount > 0 && (
                        <span className="absolute top-2 right-2 text-[13px] font-bold px-2 py-0.5 rounded bg-black/50 text-[color:var(--white)]">
                          {r.photoCount} photos
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <div className="text-[16px] font-bold text-[color:var(--white)]">{v.year} {v.make} {v.model}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)] font-mono">{v.stockNumber}</div>
                      </div>
                      <div className="text-[13px] text-[rgba(232,234,230,0.72)]">
                        {(v as any).lastPhotoSync
                          ? `Last TruLens sync ${new Date((v as any).lastPhotoSync).toLocaleString()}`
                          : "Not synced from TruLens yet"}
                      </div>
                      {r.reasons[0] && (
                        <div className="text-[13px] text-[color:var(--glass-line)]">{r.reasons[0]}</div>
                      )}
                      <div className="mt-auto flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary text-[13px] flex-1"
                          onClick={() => setSelectedDetailVehicle(v)}
                        >
                          Open stock card
                        </button>
                        <button
                          type="button"
                          onClick={() => openTruLens(v.stockNumber)}
                          className="btn btn-primary text-[13px] flex items-center justify-center gap-1 px-3"
                          title="Complete guided shoot in TruLens"
                        >
                          <Camera size={12} /> Shoot
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SETTINGS MODULE */}
        {activeSection === "settings" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Settings</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                {PRODUCT_NAME} — stock, CRM, media hub, full finance & website embeds
              </p>
            </div>

            {/* Integration URLs + website kit */}
            <div className="card border-[color:var(--cyan-soft)]">
              <div className="card-header border-b border-white/5 px-5 py-3">
                <h3 className="font-bold text-[16px] text-[color:var(--white)] flex items-center gap-2">
                  <Code size={14} className="text-[color:var(--cyan-bright)]" /> TruLens & website wiring
                </h3>
              </div>
              <div className="card-body p-5 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[13px]  font-bold text-[rgba(232,234,230,0.72)] tracking-wider">TruLens URL</span>
                    <input
                      value={trulensUrlInput}
                      onChange={(e) => setTrulensUrlInput(e.target.value)}
                      placeholder="http://localhost:3000 or https://… tunnel"
                      className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[13px]  font-bold text-[rgba(232,234,230,0.72)] tracking-wider">Dealer slug (public stock)</span>
                    <input
                      value={dealerSlugInput}
                      onChange={(e) => setDealerSlugInput(e.target.value)}
                      placeholder="mkr-autosales"
                      className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[13px]  font-bold text-[rgba(232,234,230,0.72)] tracking-wider">Sales WhatsApp</span>
                    <input
                      value={waNumberInput}
                      onChange={(e) => setWaNumberInput(e.target.value)}
                      placeholder="2766… (country code, no +)"
                      className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono"
                    />
                  </label>
                </div>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                  Phone demo: run TruLens behind <b className="text-[color:var(--white)]">HTTPS</b> (e.g. cloudflared tunnel), paste that URL here, then Install PWA on the phone.
                  Full checklist: <span className="font-mono text-[color:var(--cyan-bright)]">PRODUCTION.md</span> in the TruSaaS folder.
                </p>
                <button
                  type="button"
                  className="btn btn-primary self-start text-[13px] font-bold"
                  onClick={() => {
                    setTruLensUrl(trulensUrlInput);
                    setDealerSlug(dealerSlugInput);
                    setDealerWaNumber(waNumberInput);
                    addNotification("Saved", "TruLens URL, slug & WhatsApp stored on this device", "info");
                  }}
                >
                  Save integration settings
                </button>
                <div>
                  <div className="text-[13px]  font-bold text-[rgba(232,234,230,0.72)] tracking-wider mb-1">Website stock widget (copy for web person)</div>
                  <pre className="text-[13px] bg-black/50 border border-white/10 rounded-xl p-3 overflow-x-auto text-[rgba(232,234,230,0.72)] font-mono whitespace-pre-wrap">
                    {stockWidgetSnippet(window.location.origin)}
                  </pre>
                  <button
                    type="button"
                    className="mt-2 text-[13px] font-bold text-[color:var(--cyan-bright)] hover:underline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(stockWidgetSnippet(window.location.origin));
                        setEmbedCopied(true);
                        setTimeout(() => setEmbedCopied(false), 1600);
                      } catch { /* ignore */ }
                    }}
                  >
                    {embedCopied ? "Copied!" : "Copy embed snippet"}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="card border-[color:var(--cyan-soft)] bg-gradient-to-br from-[color:var(--ink-2)] via-[color:var(--ink-2)] to-[color:var(--ink)]">
              <div className="card-header border-b border-white/5 px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-[color:var(--white)] flex items-center gap-2">
                    <Sparkles size={16} className="text-[color:var(--cyan)]" />
                    TruFlow Premium
                  </h3>
                  <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Full DMS · media hub · recon · website feed · TruLens export</p>
                </div>
                <span className="px-3 py-1 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] rounded-full text-[13px] font-semibold tracking-widest ">
                  Premium
                </span>
              </div>
              <div className="card-body p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)]">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] text-[color:var(--white)] block">Dealer website</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block">Full inventory showcase on your custom front-end portal www.trusaas.co.za.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)]">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] text-[color:var(--white)] block">Full DMS & CRM Logic</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block">Integrated Lead CRM, Lead scoring pipelines, tasks and automated AI lead assignments.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)]">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] text-[color:var(--white)] block">TrueAI VIR & Image Studio</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block">Generates automated visual inspection reports (VIR) and optimizes vehicle images using neural nets.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)]">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] text-[color:var(--white)] block">Smart Ledger & Recon</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block">Automated expense matching and real-time reconciliation logs with dealer capital ledger.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)]">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] text-[color:var(--white)] block">AI Chatbot Co-Pilot</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block">Customer-facing conversational agent on the showroom floor to answer dealer or visitor queries.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)]">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] text-[color:var(--white)] block">Search optimisation</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block">Optimizes raw metadata, vehicle specifications, and pricing for Search and Answer Engines.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[color:var(--glass)] border border-white/5 rounded-xl p-4 md:col-span-2">
                  <div className="p-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-faint)]">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-[16px] text-[color:var(--white)] block">Marketplace syndication</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block">Real-time syndication endpoints for synchronizing stock with AutoTrader, Cars.co.za and WordPress.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">System Actions</h3>
              </div>
              <div className="card-body p-4 flex flex-col gap-3">
                {getAccount()?.role === "admin" ? (
                  <>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
                      Deletes all stock, leads, invoices and signed documents for
                      <b className="text-[color:var(--white)]"> every dealership</b> on this instance and
                      restores the seed data. There is no backup.
                    </p>
                    <div>
                      <button onClick={handleResetState} className="btn bg-[color:var(--glass)] text-[color:var(--muted)] hover:bg-[color:var(--glass)] border border-[color:var(--glass-line)] cursor-pointer">
                        Reset all data
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-[13px] text-[rgba(232,234,230,0.55)]">
                    No system actions are available on this account.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Dealer Assist. Opens from the top bar — no floating launcher. */}
      <PwaInstallBanner appName="TruFlow Premium" accent="var(--blue)" dismissKey="truflow_premium_pwa_dismissed" />
      <ChatWidget open={assistOpen} onOpenChange={setAssistOpen} />

      {/* The public-facing website chatbot simulation used to float bottom-left
          of the dealer's own workstation, which put two different assistants on
          one screen — one for the dealer, one pretending to be the customer's.
          It belongs on the dealer's website, not in the DMS. Component kept;
          only the render is removed. */}

      {/* --- FORM MODALS --- */}

      {/* Log Lead Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">Add lead</h3>
              <button onClick={() => setIsLeadModalOpen(false)} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateLeadSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">First Name</label>
                  <input type="text" required value={newLeadForm.firstName} onChange={(e) => setNewLeadForm((p) => ({ ...p, firstName: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Last Name</label>
                  <input type="text" required value={newLeadForm.lastName} onChange={(e) => setNewLeadForm((p) => ({ ...p, lastName: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Phone</label>
                  <input type="text" required value={newLeadForm.phone} onChange={(e) => setNewLeadForm((p) => ({ ...p, phone: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Email</label>
                  <input type="email" required value={newLeadForm.email} onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Select vehicle</label>
                <select value={newLeadForm.vehicleId} onChange={(e) => setNewLeadForm((p) => ({ ...p, vehicleId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  {state.vehicles.map((v) => (
                    <option key={v.id} className="bg-[color:var(--ink-2)]" value={v.id}>{v.year} {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Ad Source</label>
                <select value={newLeadForm.source} onChange={(e) => setNewLeadForm((p) => ({ ...p, source: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  <option className="bg-[color:var(--ink-2)]" value="Website">Website Form</option>
                  <option className="bg-[color:var(--ink-2)]" value="Walk-in">Walk-in Showroom</option>
                  <option className="bg-[color:var(--ink-2)]" value="Facebook">Facebook Lead Gen</option>
                  <option className="bg-[color:var(--ink-2)]" value="AutoTrader">AutoTrader</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Initial Requirement notes</label>
                <textarea rows={2} value={newLeadForm.notes} onChange={(e) => setNewLeadForm((p) => ({ ...p, notes: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-sans"></textarea>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsLeadModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Commit Lead File</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">New invoice</h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateInvoiceSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Link to Lead Account</label>
                <select value={newInvoiceForm.leadId} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, leadId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  {state.leads.map((l) => (
                    <option key={l.id} className="bg-[color:var(--ink-2)]" value={l.id}>{l.firstName} {l.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Acquired Inventory</label>
                <select
                  value={newInvoiceForm.vehicleId}
                  onChange={(e) => {
                    const matchedVeh = state.vehicles.find((v) => v.id === e.target.value);
                    setNewInvoiceForm((p) => ({ ...p, vehicleId: e.target.value, amount: matchedVeh?.retailPrice || 0 }));
                  }}
                  className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans"
                >
                  {state.vehicles.map((v) => (
                    <option key={v.id} className="bg-[color:var(--ink-2)]" value={v.id}>{v.year} {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Amount (ZAR)</label>
                  <input type="number" required value={newInvoiceForm.amount} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Due Date</label>
                  <input type="date" required value={newInvoiceForm.dueDate} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-sans" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Finance Category</label>
                <select value={newInvoiceForm.paymentMethod} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  <option className="bg-[color:var(--ink-2)]" value="Bank Transfer">Direct EFT / Bank Transfer</option>
                  <option className="bg-[color:var(--ink-2)]" value="Dealer Finance">Dealer Arranged Finance</option>
                  <option className="bg-[color:var(--ink-2)]" value="Cash">Cash Payment</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsInvoiceModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Generate Invoice</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agreement Modal */}
      {isAgreementModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">New agreement</h3>
              <button onClick={() => setIsAgreementModalOpen(false)} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateAgreementSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Party Purchaser</label>
                <select value={newAgreementForm.leadId} onChange={(e) => setNewAgreementForm((p) => ({ ...p, leadId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  {state.leads.map((l) => (
                    <option key={l.id} className="bg-[color:var(--ink-2)]" value={l.id}>{l.firstName} {l.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Subject Vehicle</label>
                <select
                  value={newAgreementForm.vehicleId}
                  onChange={(e) => {
                    const matchedVeh = state.vehicles.find((v) => v.id === e.target.value);
                    setNewAgreementForm((p) => ({ ...p, vehicleId: e.target.value, purchasePrice: matchedVeh?.retailPrice || 0 }));
                  }}
                  className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans"
                >
                  {state.vehicles.map((v) => (
                    <option key={v.id} className="bg-[color:var(--ink-2)]" value={v.id}>{v.year} {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Negotiated Price</label>
                  <input type="number" required value={newAgreementForm.purchasePrice} onChange={(e) => setNewAgreementForm((p) => ({ ...p, purchasePrice: parseFloat(e.target.value) || 0 }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Deposit amount</label>
                  <input type="number" required value={newAgreementForm.depositAmount} onChange={(e) => setNewAgreementForm((p) => ({ ...p, depositAmount: parseFloat(e.target.value) || 0 }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Contract Class</label>
                <select value={newAgreementForm.type} onChange={(e) => setNewAgreementForm((p) => ({ ...p, type: e.target.value as any }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  <option className="bg-[color:var(--ink-2)]" value="Vehicle Sale">Vehicle Purchase Deed</option>
                  <option className="bg-[color:var(--ink-2)]" value="Deposit Hold">Securing Holding Deposit</option>
                  <option className="bg-[color:var(--ink-2)]" value="Trade-In Transfer">Trade-In Exchange Agreement</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsAgreementModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Publish Contract File</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">New task</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateTaskSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Task description header</label>
                <input type="text" required placeholder="e.g. Call client back with rates" value={newTaskForm.title} onChange={(e) => setNewTaskForm((p) => ({ ...p, title: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Associate Lead</label>
                  <select value={newTaskForm.leadId} onChange={(e) => setNewTaskForm((p) => ({ ...p, leadId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    <option className="bg-[color:var(--ink-2)]" value="">None</option>
                    {state.leads.map((l) => (
                      <option key={l.id} className="bg-[color:var(--ink-2)]" value={l.id}>{l.firstName} {l.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Associate Stock</label>
                  <select value={newTaskForm.vehicleId} onChange={(e) => setNewTaskForm((p) => ({ ...p, vehicleId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    <option className="bg-[color:var(--ink-2)]" value="">None</option>
                    {state.vehicles.map((v) => (
                      <option key={v.id} className="bg-[color:var(--ink-2)]" value={v.id}>{v.year} {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Assign to Rep</label>
                  <select value={newTaskForm.assignedUserId} onChange={(e) => setNewTaskForm((p) => ({ ...p, assignedUserId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    {state.users.map((u) => (
                      <option key={u.id} className="bg-[color:var(--ink-2)]" value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Due Date Target</label>
                  <input type="date" required value={newTaskForm.dueDate} onChange={(e) => setNewTaskForm((p) => ({ ...p, dueDate: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-sans" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Priority Rating</label>
                  <select value={newTaskForm.priority} onChange={(e) => setNewTaskForm((p) => ({ ...p, priority: e.target.value as any }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    <option className="bg-[color:var(--ink-2)]" value="Normal">Normal</option>
                    <option className="bg-[color:var(--ink-2)]" value="High">High</option>
                    <option className="bg-[color:var(--ink-2)]" value="Urgent">Urgent</option>
                    <option className="bg-[color:var(--ink-2)]" value="Low">Low</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Current State</label>
                  <select value={newTaskForm.status} onChange={(e) => setNewTaskForm((p) => ({ ...p, status: e.target.value as any }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    <option className="bg-[color:var(--ink-2)]" value="Pending">Pending Assignment</option>
                    <option className="bg-[color:var(--ink-2)]" value="In Progress">In Progress</option>
                    <option className="bg-[color:var(--ink-2)]" value="Completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsTaskModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Commit Operational Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">
                {issuedCode ? "Access code" : "Add a staff member"}
              </h3>
              <button onClick={() => { setIsUserModalOpen(false); setIssuedCode(null); setSeatError(""); }} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"><X size={16} /></button>
            </div>

            {/* Shown once. There is no way to read it back — only to issue a new one. */}
            {issuedCode ? (
              <div className="flex flex-col gap-3">
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                  Give this code to <b className="text-[color:var(--white)]">{issuedCode.name}</b>. It won't be
                  shown again — if it goes missing, issue a new one from the staff list.
                </p>
                <div className="bg-[color:var(--ink)] border border-[color:var(--cyan-soft)] rounded-xl px-4 py-4 text-center">
                  <span className="text-xl font-semibold font-mono tracking-[0.2em] text-[color:var(--white)] select-all">{issuedCode.code}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(issuedCode.code)}
                    className="btn btn-secondary"
                  >
                    Copy
                  </button>
                  <button type="button" onClick={() => setIssuedCode(null)} className="btn btn-primary">
                    Done
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleCreateUserSubmit} className="flex flex-col gap-3">
              {seatError && <p className="text-[13px] text-[color:var(--muted)]">{seatError}</p>}
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Full Name</label>
                <input type="text" required placeholder="Aiden Fourie" value={newUserForm.name} onChange={(e) => setNewUserForm((p) => ({ ...p, name: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">E-mail Address</label>
                <input type="email" required placeholder="aiden@true-cars.co.za" value={newUserForm.email} onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Account Role</label>
                  <select value={newUserForm.role} onChange={(e) => setNewUserForm((p) => ({ ...p, role: e.target.value as any }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    <option className="bg-[color:var(--ink-2)]" value="salesperson">Salesperson</option>
                    <option className="bg-[color:var(--ink-2)]" value="manager">Manager</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Contact Number</label>
                  <input type="text" required placeholder="082 111 2222" value={newUserForm.phone} onChange={(e) => setNewUserForm((p) => ({ ...p, phone: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]" />
                </div>
              </div>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                They'll get their own access code and see only this dealership's stock and leads.
                This adds a billable seat.
              </p>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add &amp; issue code</button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* --- DETAIL MODALS --- */}
      {leadDetailId && (
        <LeadDetailModal
          leadId={leadDetailId}
          vehicles={state.vehicles}
          users={state.users}
          allCommunications={state.communications}
          allTasks={state.tasks}
          onClose={() => setLeadDetailId(null)}
          onRefresh={loadAllState}
          documentsPanel={
            <DocumentsHub
              embedded
              leadId={leadDetailId}
              documents={filteredDocuments.filter((d) => d.leadId === leadDetailId)}
              getLeadLabel={getLeadLabel}
              getVehicleLabel={getVehicleLabel}
              onUpload={handleUploadDocument}
              onSign={handleSignDocument}
              onDelete={handleDeleteDocument}
            />
          }
        />
      )}

      {selectedDetailVehicle && (
        <VehicleDetailModal
          vehicle={state.vehicles.find((v) => v.id === selectedDetailVehicle.id) || selectedDetailVehicle}
          isOpen={true}
          onClose={() => setSelectedDetailVehicle(null)}
          onUpdateVehicle={handleUpdateVehicle}
          settings={state.settings}
          documentsPanel={
            <DocumentsHub
              embedded
              vehicleId={selectedDetailVehicle.id}
              documents={filteredDocuments.filter((d) => d.vehicleId === selectedDetailVehicle.id)}
              getLeadLabel={getLeadLabel}
              getVehicleLabel={getVehicleLabel}
              onUpload={handleUploadDocument}
              onSign={handleSignDocument}
              onDelete={handleDeleteDocument}
            />
          }
        />
      )}

      {/* EOD REPORT MODAL */}
      {showEODReport && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink)] border border-[color:var(--cyan-soft)] rounded-2xl w-full max-w-[620px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-150 p-6 flex flex-col gap-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[color:var(--cyan)] animate-ping" />
                  <span className="text-[13px] font-semibold tracking-widest  text-[color:var(--cyan)] font-mono">Operations Report</span>
                </div>
                <h3 className="font-sans text-xl font-semibold tracking-tight text-[color:var(--white)] mt-1">End of day summary</h3>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button 
                onClick={() => setShowEODReport(false)} 
                className="p-2 rounded-lg bg-[color:var(--glass)] border border-white/5 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Daily Summary Metrics Block */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)]  font-mono">Leads Worked</span>
                <span className="text-lg font-semibold text-[color:var(--white)]">12 Leads</span>
                <span className="text-[13px] text-[color:var(--cyan)]">Active response</span>
              </div>
              <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)]  font-mono">Cars Moved Today</span>
                <span className="text-lg font-semibold text-[color:var(--white)]">3 Units</span>
                <span className="text-[13px] text-[color:var(--cyan)]">Closed Won status</span>
              </div>
              <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-bold text-[color:var(--cyan-bright)]  font-mono">EOD Net Profit</span>
                <span className="text-lg font-semibold text-[color:var(--cyan)]">R 185,000</span>
                <span className="text-[13px] text-[color:var(--cyan)]">11.4% avg margin</span>
              </div>
            </div>

            {/* Financial and Recon Outlay Details */}
            <div className="bg-[color:var(--ink)] rounded-xl border border-white/5 p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center text-[13px] border-b border-white/3 pb-3">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Reconditioning Expenditures</span>
                <span className="font-mono font-bold text-[color:var(--muted)]">- R 18,500</span>
              </div>
              <div className="flex justify-between items-center text-[13px] border-b border-white/3 pb-3">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Gross Dealership Revenue</span>
                <span className="font-mono font-bold text-[color:var(--white)]">R 1,515,000</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Unpaid invoices</span>
                <span className="font-mono font-bold text-[color:var(--warning)]">R {state.invoices.filter(i => i.status === 'Sent').reduce((sum, i) => sum + i.amount, 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Daily Sold Vehicles Details */}
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold tracking-normal text-[rgba(232,234,230,0.72)] font-mono px-1">Sold today</span>
              <div className="flex flex-col gap-2">
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-3 py-3 flex justify-between items-center text-[13px]">
                  <div>
                    <span className="font-bold text-[color:var(--white)] block">Toyota Hilux 2.8 GD-6 Legend</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block font-mono">Stock ID: CT-5112 | Closed by Aiden Fourie</span>
                  </div>
                  <span className="font-mono font-semibold text-[color:var(--cyan)]">R 115,000 profit</span>
                </div>
                <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-3 py-3 flex justify-between items-center text-[13px]">
                  <div>
                    <span className="font-bold text-[color:var(--white)] block">Volkswagen Golf 8 GTI</span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block font-mono">Stock ID: JHB-8319 | Closed by Sipho Dlamini</span>
                  </div>
                  <span className="font-mono font-semibold text-[color:var(--cyan)]">R 70,000 profit</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 border-t border-[color:var(--cyan-faint)] pt-4">
              <button 
                type="button" 
                onClick={() => setShowEODReport(false)} 
                className="px-4 py-2 bg-[color:var(--glass)] hover:bg-white/10 rounded-xl text-[13px] font-semibold text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer active:scale-95 transition-all text-center"
              >
                Close Report
              </button>
              
              <button 
                type="button" 
                onClick={() => {
                  addNotification("EOD Summary Dispatched", "The compiled daily operations summary has been securely emailed to dealers@real-cars.co.za and all stakeholders.", "info");
                  setShowEODReport(false);
                }} 
                className="px-4 py-2 bg-gradient-to-r from-[color:var(--cyan-faint)] to-[color:var(--cyan-soft)] border border-[color:var(--cyan-soft)] text-[color:var(--cyan-bright)] hover:bg-[color:var(--cyan-soft)] rounded-xl text-[13px] font-bold cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 text-center"
              >
                📧 Email to Stakeholders
              </button>

              <button 
                type="button" 
                onClick={handleExportCSV} 
                className="px-4 py-2 bg-[color:var(--cyan)] text-[color:var(--ink)] font-semibold rounded-xl text-[13px] shadow-lg hover:bg-[color:var(--cyan-soft)] cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 text-center"
              >
                ⬇️ Export Spreadsheet (CSV)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- NOTIFICATIONS --- */}
      <div className="fixed top-6 right-6 z-[300] flex flex-col gap-3 w-full max-w-[360px] pointer-events-none">
        {notifications.map(notif => (
          <div 
            key={notif.id} 
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-10 duration-500 flex flex-col gap-2 transition-all ${
              notif.type === 'warning' 
                ? 'bg-[color:var(--glass)] border-[color:var(--glass-line)] text-[color:var(--warning)]' 
                : 'bg-[color:var(--cyan-faint)] border-[color:var(--cyan-soft)] text-[color:var(--blue)]'
            }`}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className={notif.type === 'warning' ? "animate-pulse" : ""} />
                <span className="text-[13px] font-semibold  tracking-[0.15em]">{notif.title}</span>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-white/30 hover:text-[color:var(--white)] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="text-[13px] font-medium leading-relaxed text-white/90 pr-2">
              {notif.message}
            </div>
            <div className="h-0.5 bg-[color:var(--glass)] rounded-full overflow-hidden mt-1">
              <div className="h-full bg-current animate-progress-shrink origin-left" />
            </div>
          </div>
        ))}
        </div>
      </div>
    )
  );
}
