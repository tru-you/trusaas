import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Home,
  TrendingUp,
  Car,
  Upload,
  Users,
  Star,
  Receipt,
  FileSignature,
  CheckSquare,
  ClipboardCheck,
  Award,
  LayoutGrid,
  Calculator,
  Settings as SettingsIcon,
  RefreshCw,
  Search,
  AlertTriangle,
  Shield,
  Trash2,
  Check,
  X,
  FileSpreadsheet,
  ShoppingCart,
  LogOut,
  Zap,
  Camera,
  Crosshair,
  MessageCircle,
  Copy,
  FileText,
  MessageSquare,
  CalendarClock,
  Download,
  Monitor,
  HelpCircle,
  ChevronDown,
  Contact,
  Globe2,
  Image,
} from "lucide-react";

import {
  fetchState,
  refreshFromServer,
  resetState,
  updateSettings,
  createVehicle,
  updateVehicle,
  setVehicleStatus,
  deleteVehicle,
  createLead,
  updateLead,
  autoAssignLeads,
  createTask,
  updateTask,
  deleteTask,
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
  deleteDocument,
  createClient,
  updateClient,
  deleteClient,
} from "./api";

import { Vehicle, Lead, Task, Invoice, Agreement, User, Communication, Expense, Client, DMSState, Dealership, DocStage } from "./types";
import { DOC_STAGES } from "./types";

import Counter from "./components/Counter";
import ChatWidget from "./components/ChatWidget";
import GuidePanel from "./components/GuidePanel";
import SetupPrompt, { SetupChecklistCard } from "./components/SetupPrompt";
import DocumentsHub from "./components/DocumentsHub";
import DealerDetailsSettings from "./components/DealerDetailsSettings";
import DocSettingsPanel from "./components/DocSettingsPanel";

/* Split out of the initial bundle — none of these is needed to paint the
   dashboard, and together they were roughly a third of a 540KB single chunk
   that every dealer downloaded before the login screen appeared. They load
   when the modal or section is first opened. */
const LeadDetailModal = lazy(() => import("./components/LeadDetailModal"));
const AccountingRecon = lazy(() => import("./components/AccountingRecon"));
const VehicleDetailModal = lazy(() => import("./components/VehicleDetailModal"));
const DealershipAdmin = lazy(() => import("./components/DealershipAdmin"));
const TruSocialSettings = lazy(() => import("./components/TruSocialSettings"));
const AccountingIntegrationsSettings = lazy(() => import("./components/AccountingIntegrationsSettings"));
/* DocHub — desktop-only, so the chunk (plus any future pdf-lib dep it
   pulls in) never reaches a phone. Gated on useIsDesktop() at the render site
   below, which is what actually keeps mobile from paying for it. */
const DocHubPanel = lazy(() => import("./components/dochub/DocHubPanel"));
const DocFlowSettings = lazy(() => import("./components/dochub/DocFlowSettings"));
import AmortizationCalc from "./components/AmortizationCalc";
import CustomerLeadForm from "./components/CustomerLeadForm";
import { CommissionEstimator } from "./components/CommissionEstimator";
import LoginSplash from "./components/LoginSplash";
import WebManagementGrid from "./components/WebManagementGrid";
import BulkImport from "./components/BulkImport";
import TestDriveCalendar from "./components/TestDriveCalendar";
import { hasValidSession, clearSession, getAccount, authFetch, SESSION_EXPIRED_EVENT } from "./lib/session";
import { fetchSetupStatus, setupSnoozed, snoozeSetup, type SetupStatus } from "./lib/setupStatus";
import { useIsDesktop } from "./lib/useIsDesktop";
import { computeDmsGalleryReadiness } from "./lib/dmsReadiness";
import {
  PRODUCT_NAME,
  PRODUCT_TIER,
  getDealerSlug,
  openTruLens,
  openSupportWhatsApp,
} from "./lib/productConfig";
import {
  openStockWhatsApp,
  copyStockBlurb,
} from "./lib/salesShare";
import { initGlassMotion } from "./lib/glassMotion";
import { TRUFLOW_MOBILE_URL } from "./lib/ecosystem";

/** Which dealership a newly-added vehicle belongs to — loaded from the
 *  server so every onboarded dealer appears automatically.
 *  The hardcoded DEALERSHIPS array was removed because it only listed MKR
 *  and Cars on Caledon, so every other dealer got the wrong name and URL. */


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
  const supp = ((v.supplementaryIncome || []) as any[]).reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
  const rand = retail - basis + supp;
  const totalRev = retail + supp;
  return { rand, pct: totalRev > 0 ? (rand / totalRev) * 100 : 0 };
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
/**
 * The add-vehicle form.
 *
 * fuelType and transmission were `as any` in the useState initialiser, which
 * switched off checking for the two fields most likely to be typo'd — every
 * <option> already emits exactly the values Vehicle allows, so the cast was
 * hiding nothing but itself.
 *
 * category is the form's own type, not Vehicle's: the select offers an "Auto —
 * decide from price & model" choice whose value is "", and Vehicle has no such
 * member. "" is translated to undefined at the API boundary rather than being
 * sent as an empty string the website would have to special-case.
 */
type NewVehicleForm = {
  year: number;
  make: string;
  model: string;
  trim: string;
  engine: string;
  fuelType: Vehicle["fuelType"];
  transmission: Vehicle["transmission"];
  bodyType: string;
  retailPrice: number;
  costPrice: number;
  mileage: number;
  stockNumber: string;
  description: string;
  dealershipId: string;
  category: NonNullable<Vehicle["category"]> | "";
};

/**
 * NoInfer on options is what makes T come from `value`.
 *
 * Without it TypeScript infers T from both `value` and `options`, and the
 * option literals widen to plain string — so T became string, and passing a
 * setState for a narrow union like "ALL" | "NEEDS" | "PARTIAL" | "READY" was an
 * error. The practical cost was worse than the error: with T widened, a typo in
 * an option value type-checked fine and silently set a filter to a state the
 * reducer never matches.
 */
function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: { value: NoInfer<T>; label: string }[];
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-white/10 bg-[color:var(--ink-2)] p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
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
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastBackupMb, setLastBackupMb] = useState<number | null>(null);
  // Lifted out of ChatWidget so the dashboard can open the assistant directly —
  // the floating bubble is easy to miss on a desk monitor.
  const [assistOpen, setAssistOpen] = useState(false);
  // In-app how-to guides. Opens from the top bar, and once — on a dealer's very
  // first session — it auto-opens so the Lens → Flow → Website spine is the
  // first thing they meet instead of a cold dashboard.
  const [guideOpen, setGuideOpen] = useState(false);
  // First-run setup checklist — server-derived (see lib/setupStatus), so every
  // device agrees on it. setupOpen is the modal's own toggle; the card has a
  // separate per-device snooze because "hide for a week" shouldn't need a
  // round-trip.
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupOpen, setSetupOpen] = useState(true);
  const [setupCardHidden, setSetupCardHidden] = useState(() => setupSnoozed());
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

  // First-run: show the guides once, then never auto-open again. A flag in
  // localStorage, not the token, so it survives sign-out and is per-device —
  // the guide is about learning this browser, not the account.
  //
  // The "seen" flag is written when the panel is DISMISSED (see
  // handleGuideOpenChange), not here. Writing it at open-time raced React's
  // double-invoked effects in dev — the flag landed on the first pass and the
  // second, committed pass then saw it and never opened. Marking on dismiss is
  // both race-free and more honest: seen means they actually closed it.
  useEffect(() => {
    if (!isLoggedIn) return;
    // Hold off until setup status resolves: the setup modal takes precedence
    // over the first-run tour — never stack two overlays on a brand-new
    // dealer. The guide opens next session (or right after setup completes).
    if (setupStatus === null) return;
    const setupWillPrompt =
      !setupStatus.skipPrompt &&
      !setupStatus.complete &&
      !setupStatus.acknowledgedAt &&
      getAccount()?.role !== "salesperson";
    if (setupWillPrompt) return;
    try {
      if (!localStorage.getItem("truflow_guide_seen")) setGuideOpen(true);
    } catch {
      /* private browsing — skip the tour rather than nag every load */
    }
  }, [isLoggedIn, setupStatus]);

  // Opening is a plain state set; closing also records that the first-run tour
  // has been seen so it won't auto-open again on this device.
  const handleGuideOpenChange = (open: boolean) => {
    setGuideOpen(open);
    if (!open) {
      try {
        localStorage.setItem("truflow_guide_seen", "1");
      } catch {
        /* private browsing — nothing to persist */
      }
    }
  };

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
  const sessionAccount = getAccount();
  const isMasterAdmin = sessionAccount?.role === 'admin';
  const rawDealershipId = sessionAccount?.dealershipId;
  const isDesktop = useIsDesktop();

  const [adminDealerScope, setAdminDealerScope] = useState<string | null>(null);
  const dealershipId = (isMasterAdmin && adminDealerScope) ? adminDealerScope : rawDealershipId;

  /* Tenant scoping ----------------------------------------------------------
     The server already scopes /api/state to the signed-in tenant, so this is a
     second, narrower net — useful for an admin looking at everything, wrong as
     a hard filter.

     It used to filter on `dealershipId` even when that was undefined, which
     happens whenever there is no user record for the tenant (the demo ships
     with none). Every list then matched nothing: the Leads header read
     "0 open" while the board beside it showed two, because the board built its
     own list straight off state.leads. Records with no dealershipId are kept
     too — TruLens imports arrive without one. */
  const mine = (d?: string) => !d || d === dealershipId;
  const showAll = (isMasterAdmin && !adminDealerScope) || !dealershipId;

  const filteredVehicles = !state ? [] : showAll ? state.vehicles : state.vehicles.filter(v => mine(v.dealershipId));
  /** Stock the dealer can still act on: tenant-scoped, minus archived units.
   *
   *  Anything that lists, counts or offers a car to work with should read this
   *  rather than `filteredVehicles`. Archived units were originally excluded in
   *  one list only, so they went on leaking into the photo-readiness tiles, the
   *  new-enquiry dropdown and the aged-stock counts. `filteredVehicles` is still
   *  the right source where sold history matters — Stock Health's realised
   *  margin has to keep counting them. */
  const activeStock = filteredVehicles.filter((v) => !v.archivedAt);
  const filteredLeads = !state ? [] : showAll ? state.leads : state.leads.filter(l => mine(l.dealershipId));
  const filteredTasks = !state ? [] : showAll ? state.tasks : state.tasks.filter(t => mine(t.dealershipId));
  const filteredInvoices = !state ? [] : showAll ? state.invoices : state.invoices.filter(i => mine(i.dealershipId));
  const filteredAgreements = !state ? [] : showAll ? state.agreements : state.agreements.filter(a => mine(a.dealershipId));
  const filteredDocuments = !state ? [] : showAll ? (state.documents || []) : (state.documents || []).filter(d => mine(d.dealershipId));
  const filteredCommunications = !state ? [] : showAll ? state.communications : state.communications.filter(c => mine(c.dealershipId));
  const filteredExpenses = !state ? [] : showAll ? state.expenses : state.expenses.filter(e => mine(e.dealershipId));
  const [selectedDetailVehicle, setSelectedDetailVehicle] = useState<Vehicle | null>(null);
  const [leadDetailId, setLeadDetailId] = useState<string | null>(null);
  const [leadInitialTab, setLeadInitialTab] = useState<"overview" | "dochub" | undefined>(undefined);
  const [clientSearchState, setClientSearchState] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // The view follows the logged-in account. This was a "simulated role
  // selector" pill that let anyone flip to Dealer Owner regardless of their
  // real login — a permissions hole now that seats are live. principal/admin
  // see the owner view; managers and salespeople see their own.
  const account = sessionAccount;
  const accountRole: 'salesperson' | 'manager' | 'owner' =
    account?.role === 'admin' || account?.role === 'principal' ? 'owner'
    : account?.role === 'manager' ? 'manager' : 'salesperson';
  const selectedRole = accountRole;

  // Setup checklist: fetched on login and re-fetched whenever the dealer moves
  // between sections — fields are completed over in Settings, so coming back
  // is the natural moment the card/modal should clear. Salespeople can't
  // reach Settings, so they never fetch or see any of it.
  useEffect(() => {
    if (!isLoggedIn) return;
    if (accountRole === "salesperson") return;
    let cancelled = false;
    fetchSetupStatus(dealershipId || undefined).then((s) => {
      if (!cancelled) setSetupStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, activeSection, accountRole, dealershipId]);

  // The modal is armed once per login; closing it (either button acknowledges
  // server-side, or "Set up now" routes away) keeps it closed for the rest of
  // the session — the Overview card carries the reminder from here.
  useEffect(() => {
    if (isLoggedIn) setSetupOpen(true);
  }, [isLoggedIn]);

  /** Modal shows once per account until acknowledged; the dashboard card
   *  keeps nagging only about REQUIRED items, so optional branding gaps never
   *  become a permanent badge. */
  const setupModalVisible =
    !!setupStatus &&
    setupOpen &&
    !setupStatus.skipPrompt &&
    !setupStatus.complete &&
    !setupStatus.acknowledgedAt;

  const [showEODReport, setShowEODReport] = useState(false);
  const [docFlowSettingsOpen, setDocFlowSettingsOpen] = useState(false);

  // Filters & Searches
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState("ALL");
  const [inventoryPhotoFilter, setInventoryPhotoFilter] = useState<"ALL" | "NEEDS" | "PARTIAL" | "READY">("ALL");
  const [inventoryAgeFilter, setInventoryAgeFilter] = useState<"ALL" | "30" | "60" | "90">("ALL");
  /** Inventory pagination — grid renders in pages of 24 so a 100+ car
   *  floor doesn't mount every heavy card + image at once. Any filter
   *  change resets to the first page. */
  const INVENTORY_PAGE = 24;
  const [inventoryVisibleCount, setInventoryVisibleCount] = useState(INVENTORY_PAGE);
  useEffect(() => {
    setInventoryVisibleCount(INVENTORY_PAGE);
  }, [inventorySearch, inventoryStatusFilter, inventoryPhotoFilter, inventoryAgeFilter]);
  const [leadCrmTab, setLeadCRMTab] = useState<"kanban" | "list">("kanban");
  const [filterOverdueOnly, setFilterOverdueOnly] = useState(false);
  const [leadQuery, setLeadQuery] = useState("");

  // Modal Open states
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; type: 'info' | 'warning' | 'error' }[]>([]);
  const notifiedTaskIds = React.useRef<Set<string>>(new Set());

  const addNotification =(title: string, message: string, type: 'info' | 'warning' | 'error' = 'info') => {
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
                new Notification("TruFlow: Task Due Soon", {
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
      // Both calls used a bare fetch, so neither carried the session token and
      // both 401'd — the button always reported failure.
      const data = await autoAssignLeads();
      setState(await fetchState());
      addNotification(
        "Leads assigned",
        data?.message || "Leads shared out across the team.",
        "info"
      );
    } catch (err: any) {
      console.error(err);
      addNotification(
        "Could not assign leads",
        err?.message || "Something went wrong sharing the leads out.",
        "warning"
      );
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Form Fields State
  const [newLeadForm, setNewLeadForm] = useState({ firstName: "", lastName: "", phone: "", email: "", vehicleId: "", source: "Website", notes: "" });
  const [newInvoiceForm, setNewInvoiceForm] = useState({ leadId: "", vehicleId: "", amount: 0, paymentMethod: "Bank Transfer", status: "Sent" as any, dueDate: new Date().toISOString().slice(0, 10) });
  const [newAgreementForm, setNewAgreementForm] = useState({ leadId: "", vehicleId: "", purchasePrice: 0, depositAmount: 0, type: "Vehicle Sale" as any, status: "Pending Signature" as any });
  const [newTaskForm, setNewTaskForm] = useState({ title: "", leadId: "", vehicleId: "", assignedUserId: "", dueDate: new Date().toISOString().slice(0, 10), priority: "Normal" as any, status: "Pending" as any });
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", role: "salesperson" as any, phone: "" });
  // Staff logins ("seats") — the principal manages these, and activeSeats is
  // what the dealership is billed on.
  const [seats, setSeats] = useState<Seat[]>([]);
  const [activeSeats, setActiveSeats] = useState(0);
  const [seatError, setSeatError] = useState("");
  /** A freshly issued code, shown once. Never fetched back from the server. */
  const [issuedCode, setIssuedCode] = useState<{ name: string; code: string } | null>(null);
  const [newVehicleForm, setNewVehicleForm] = useState<NewVehicleForm>({ year: new Date().getFullYear(), make: "", model: "", trim: "", engine: "", fuelType: "Petrol", transmission: "Automatic", bodyType: "", retailPrice: 0, costPrice: 0, mileage: 0, stockNumber: "", description: "", dealershipId: getAccount()?.dealershipId || "", category: "" });

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
          className="px-4 py-2 bg-[color:var(--cyan)] on-fill rounded text-[13px] font-semibold hover:bg-opacity-80"
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
        <div className="font-semibold text-[16px] tracking-wide">Starting TruFlow Premium…</div>
        <div className="text-[13px] text-[rgba(232,234,230,0.72)] text-center max-w-xs">
          Loading floor data from <span className="font-mono text-[color:var(--cyan)]">localhost:3001</span>.
          If this hangs, restart the server (`npm run dev` in truflow-premium).
        </div>
        <button
          type="button"
          onClick={loadAllState}
          className="mt-2 px-4 py-2 rounded-lg bg-[color:var(--cyan)] on-fill text-[13px] font-semibold"
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

  const activeVehiclesCount = state.vehicles.filter((v) => v.status !== "SOLD" && !v.archivedAt).length;
  const unresolvedLeadsCount = state.leads.filter((l) => l.status !== "Closed Won" && l.status !== "Closed Lost").length;
  /**
   * Stock that cannot sell yet, because it isn't online.
   *
   * This replaced a "Website analytics" card of hardcoded numbers (51 visits,
   * 94% bounce) that were never wired to anything. A car in stock with no
   * photos is dead capital — it is paying floorplan and cannot be shopped —
   * and nothing in the app put that number in front of the dealer daily.
   * Stock health already owns the money view; this owns the "why isn't it
   * moving" view, and every figure comes from the same readiness helper the
   * All Vehicles table grades each row with.
   */
  const notOnline = (() => {
    const inStock = activeStock.filter((v) => v.status !== "SOLD");
    const graded = inStock.map((v) => ({ v, r: computeDmsGalleryReadiness(v as any) }));
    const noPhotos = graded.filter((g) => g.r.level === "capture");
    const incomplete = graded.filter((g) => g.r.level === "partial");
    const blocked = [...noPhotos, ...incomplete];
    // Worst offender by age, because "4 cars need photos" is a chore whereas
    // "one has been sitting 34 days" is a decision.
    const oldest = blocked.reduce<(typeof blocked)[number] | null>(
      (worst, g) => (!worst || (g.v.daysInInventory || 0) > (worst.v.daysInInventory || 0) ? g : worst),
      null,
    );
    return {
      inStock: inStock.length,
      blocked: blocked.length,
      noPhotos: noPhotos.length,
      incomplete: incomplete.length,
      ready: graded.filter((g) => g.r.webReady).length,
      oldest,
    };
  })();

  const soldUnitsCount = state.vehicles.filter((v) => v.status === "SOLD").length;
  const totalRevenue = state.invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0);

  /* Leads waiting on a first reply ------------------------------------------
     The number that actually decides whether a lead converts is how long it
     sat before anyone answered it — pipeline value can't be acted on at 9am,
     but "3 people are waiting, one since yesterday" can. A lead counts as
     waiting when it is still open and has never been contacted. */
  const openLeads = state.leads.filter((l) => l.status !== "Closed Won" && l.status !== "Closed Lost");
  const awaitingReply = openLeads.filter((l) => !l.lastContactedAt);
  const negotiatingCount = openLeads.filter((l) => l.status === "Negotiating").length;
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

  /** Whose floor this is. Matches the signed-in dealership first, then
   *  falls back so the banner never renders a bare "· live". */
  const currentDealership = (state?.dealerships || []).find((d: any) => d.id === dealershipId);
  const dealershipLabel =
    currentDealership?.name
    || account?.label || "Your dealership";
  // The embed snippet was reading from a localStorage default that ships as
  // "mkr-autosales", so every dealer's Settings page showed MKR. Prefer the
  // signed-in dealership's slug; fall through to the stored value only for the
  // master admin, who has no dealership of their own.
  const currentDealerSlug = currentDealership?.slug || (isMasterAdmin ? undefined : dealershipId);
  const dealerProducts: string[] = (currentDealership as any)?.products || [];
  const hasProduct = (p: string) => isMasterAdmin && !adminDealerScope ? true : dealerProducts.includes(p);
  const todayLabel = new Date().toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* Card subtexts should answer "compared to what?" — "Ready for viewing" and
     "Cleared this cycle" are decoration. Aged stock and unpaid invoices are
     the two numbers a dealer principal actually chases. */
  const AGED_DAYS = 60;
  /* Uses stockAge(), the same helper Stock Health measures with. This counted
     `daysInInventory` directly — a value written once on create and never
     updated — while Stock Health preferred `dateAcquired`, so the Overview tile
     and the Stock Health tile reported different aged-stock counts for the same
     floor, at the same threshold. */
  const agedStockCount = state.vehicles.filter(
    (v) => v.status !== "SOLD" && !v.archivedAt && stockAge(v) > AGED_DAYS
  ).length;
  /* The headline money figure is deal value less what was spent making the car
     ready — sale price minus recon, summed over sold units. It replaces the old
     invoice-derived "Banked" number, which assumed the DMS raised the invoice;
     dealers invoice from their own systems, so that number was never real. */
  /* End-of-day totals, computed once. The CSV export and the on-screen report
     each derived these four lines independently and identically, so changing
     one would have silently disagreed with the other. */
  const eodTotals = (() => {
    const sold = state.vehicles.filter((v) => v.status === "SOLD");
    const totalRevenue = sold.reduce((s, v) => s + (v.retailPrice || 0), 0);
    const totalProfit = sold.reduce(
      (s, v) => s + ((v.retailPrice || 0) - (v.costPrice || 0)),
      0,
    );
    const reconTotal = state.vehicles
      .flatMap((v: any) => v.reconTasks || [])
      .reduce((s: number, t: any) => s + (t.cost || 0), 0);
    const marginPct = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0";
    return { sold, totalRevenue, totalProfit, reconTotal, marginPct };
  })();

  const soldVehicles = state.vehicles.filter((v) => v.status === "SOLD");
  const grossAfterRecon = soldVehicles.reduce(
    (sum, v) => sum + ((v.retailPrice || 0) - reconSpend(v)),
    0
  );
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
  /* The "Going out" tile and its top-bar chip are gone. It counted vehicles in
     PENDING — a status nothing had written since the stock kanban was removed —
     so it read zero forever. Rebuilding it on `Closed Won && !docFlowCompletedAt`
     was worse: no historical deal carries that stamp, so it counted every deal
     ever closed. Neither number was true, and Deal Readiness already answers
     "what is still outstanding" properly. */

  /* Nav "needs attention" signals — one shared rule per destination, so the
     bottom bar and the sidebar read from the same source. Each value is a
     genuine to-do count: leads waiting on a first reply, overdue tasks/actions,
     and stock that can't sell yet because it has no photos / an incomplete
     listing. Rendered as a dot on mobile (a number on a tab is noise) and as a
     count on desktop, and only when the value is > 0. */
  const navAttention: Record<string, number> = {
    leads: awaitingReply.length,
    tasks: overdueCount,
    inventory: notOnline.blocked,
  };

  // Grouped menu sections for elegant layout
  const groupedNavigation = [
    {
      category: "Showroom Floor",
      items: [
        { id: "dashboard", label: "Overview", icon: Home },
        { id: "inventory", label: "All Vehicles", icon: Car },
        { id: "upload", label: "Add vehicle", icon: Upload },
        { id: "bulk_import", label: "Bulk Import", icon: FileSpreadsheet },
      ]
    },
    {
      category: "Operations & CRM",
      items: [
        { id: "leads", label: "Lead CRM", icon: Users },
        { id: "clients", label: "Clients", icon: Contact },
        { id: "tasks", label: "Tasks", icon: CheckSquare },
        { id: "test_drives", label: "Showroom Diary", icon: CalendarClock },
        { id: "stock_health", label: "Stock health", icon: TrendingUp },
        { id: "accounting_recon", label: "Finance & Recon", icon: Receipt },
      ]
    },
    {
      /* Built, backed by real server routes, and previously unreachable — no nav
         entry pointed at any of them. Invoices and agreements each have full
         GET/POST/PUT routes behind them (including pay and sign); the repayment
         calculator is self-contained arithmetic seeded from real stock. */
      category: "Deals & Finance",
      items: [
        { id: "deal_readiness", label: "Deal Readiness", icon: ClipboardCheck },
        { id: "documents", label: "Documents", icon: FileText },
        { id: "payment", label: "Repayment calculator", icon: Calculator },
      ]
    },
    /* Media & Web — restored at owner direction (was cut in eeedfb5). Stock
       media is the gallery-readiness hub and the only surface with the public
       feed link; Web Management is the power-user grid. */
    {
      category: "Media & Web",
      items: [
        { id: "media_web", label: "Stock media", icon: Image },
        { id: "web_management", label: "Web Management", icon: Globe2 },
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
        ['dashboard', 'inventory', 'upload', 'bulk_import', 'leads', 'clients', 'tasks', 'test_drives', 'accounting_recon', 'media_web', 'web_management',
         'deal_readiness', 'documents', 'payment'].includes(item.id)
      );
    } else if (selectedRole === 'manager') {
      items = items.filter(item =>
        ['dashboard', 'inventory', 'upload', 'bulk_import', 'leads', 'clients', 'tasks', 'test_drives', 'accounting_recon', 'stock_health', 'media_web', 'web_management', 'manager', 'settings',
         'deal_readiness', 'documents', 'payment'].includes(item.id)
      );
    }
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  /* Mobile "More" sheet buckets, keyed by nav item id. One source so the
     phone's three buckets can never drift from the sidebar's five groups: an
     item only has to be added to groupedNavigation and to one bucket here.
     Unmapped items fall back to the "other" profile bucket below so nothing
     silently disappears from a phone. */

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

  const handleCreateClient = async (client: Omit<Client, "id" | "createdAt">) => {
    await createClient(client);
    loadAllState();
  };

  const handleUpdateClient = async (id: string, updates: Partial<Client>) => {
    await updateClient(id, updates);
    loadAllState();
  };

  const handleDeleteClient = async (id: string) => {
    await deleteClient(id);
    loadAllState();
  };

  const handleUpdateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    await updateVehicle(id, updates);
    loadAllState();
  };

  /** Cancellation: a closed sale fell through. Put the car back in stock — which
   *  re-lists it on the website, since the public feed only publishes INVENTORY
   *  — and reopen the deals that closed on it, so the two never drift apart.
   *
   *  The reopen is the server's job now: this used to look up one Closed Won
   *  lead here and force it to Negotiating, which both missed any second deal
   *  on the car and invented a stage the deal may never have been at. */
  const handleReturnToStock = async (v: Vehicle) => {
    const label = `${v.year} ${v.make} ${v.model}`;
    if (!confirm(`Return ${label} to stock?\n\nThis re-lists it on your website and reopens the linked deal.`)) return;
    try {
      const { coupledLeads } = await setVehicleStatus(v.id, "INVENTORY");
      loadAllState();
      addNotification(
        "Returned to stock",
        `${label} is back in inventory and live on your website again` +
          (coupledLeads.length
            ? `, and ${coupledLeads.length === 1 ? "its deal was" : `${coupledLeads.length} deals were`} reopened.`
            : "."),
        "info",
      );
    } catch (err: any) {
      addNotification("Could not return to stock", err?.message || "Something went wrong.", "warning");
    }
  };

  /** Mark a car sold, resolving which deal closed on it when that is ambiguous.
   *
   *  A car can carry several open deals, and only the dealer knows which
   *  customer actually bought it — so ask, rather than guess. A car with no
   *  open deals is sold outside the system entirely (cash off the floor,
   *  invoiced elsewhere), which must stay a single click: no prompt at all. */
  const handleMarkSold = async (v: Vehicle) => {
    const label = `${v.year} ${v.make} ${v.model}`;
    const openLeads = state.leads.filter(
      (l) => l.vehicleId === v.id && l.status !== "Closed Won" && l.status !== "Closed Lost",
    );

    let closeLeadId: string | undefined;
    if (openLeads.length === 1) {
      closeLeadId = openLeads[0].id;
    } else if (openLeads.length > 1) {
      const choice = prompt(
        `Who bought the ${label}?\n\n` +
          openLeads.map((l, i) => `${i + 1}. ${l.firstName} ${l.lastName}`).join("\n") +
          `\n0. Sold outside the system — no deal here\n\nEnter a number:`,
      );
      if (choice === null) return; // cancelled — do not touch the car
      const n = parseInt(choice, 10);
      if (n >= 1 && n <= openLeads.length) {
        closeLeadId = openLeads[n - 1].id;
      } else if (n !== 0) {
        /* Anything that is neither a listed deal nor the explicit "0 — sold
           outside the system" is a typo, not an instruction. Selling the car
           anyway would leave the buyer's deal sitting open with the dealer
           told only "Marked sold." */
        addNotification(
          "Not sold",
          `"${choice}" is not one of the options, so ${label} was left alone. Try again.`,
          "warning",
        );
        return;
      }
    }

    try {
      const { coupledLeads } = await setVehicleStatus(v.id, "SOLD", closeLeadId);
      loadAllState();
      addNotification(
        "Marked sold",
        `${label} is sold and off the website` +
          (coupledLeads.length ? ", and its deal was closed." : "."),
        "info",
      );
    } catch (err: any) {
      addNotification("Could not mark sold", err?.message || "Something went wrong.", "warning");
    }
  };

  /** Remove a unit from stock.
   *  Deleting a car that a deal, invoice or lead points at leaves those records
   *  referencing something that no longer exists — the lead's vehicle shows as
   *  blank and the invoice loses what it was for. So say what is attached
   *  before asking, and archive rather than delete once the sale is recorded
   *  here: that is a record of a transaction, not stock to tidy away.
   *
   *  A car sold outside the DMS has no record here to protect, so it deletes
   *  cleanly. Refusing those outright — as this used to, pointing at an
   *  "archive" that did not exist — left them stuck on the floor forever. */
  const handleDeleteVehicle = async (id: string) => {
    const v = state.vehicles.find((x) => x.id === id);
    if (!v) return;
    const label = `${v.year} ${v.make} ${v.model} (${v.stockNumber})`;

    /* Already archived: the sale here is what stopped it being deleted in the
       first place, so running this again would only re-archive it. Say where
       the way back is instead of silently doing nothing useful. */
    if (v.archivedAt) {
      addNotification(
        "Already archived",
        `${label} is archived and still counted in your sold figures. Filter stock by "Archived" to restore it.`,
        "info",
      );
      return;
    }

    /* Is the sale actually recorded here? A closed deal, an invoice, an
       agreement or a signed document all mean deleting would destroy the record
       of a transaction — those get archived instead. A car sold outside the DMS
       has none of them, so deleting it destroys nothing and simply removes it.

       An open or lost enquiry is not a record of a sale: those are unlinked by
       the server rather than blocking removal. The same rule is enforced
       server-side, since Light never runs this code. */
    const closedDeals = state.leads.filter((l) => l.vehicleId === id && l.status === "Closed Won");
    const linkedInvoices = state.invoices.filter((i) => i.vehicleId === id);
    const linkedAgreements = state.agreements.filter((a) => a.vehicleId === id);
    const signedDocs = state.documents.filter((d) => d.vehicleId === id && d.status === "Signed");
    const recorded = [
      closedDeals.length && `${closedDeals.length} closed deal${closedDeals.length > 1 ? "s" : ""}`,
      linkedInvoices.length && `${linkedInvoices.length} invoice${linkedInvoices.length > 1 ? "s" : ""}`,
      linkedAgreements.length && `${linkedAgreements.length} agreement${linkedAgreements.length > 1 ? "s" : ""}`,
      signedDocs.length && `${signedDocs.length} signed document${signedDocs.length > 1 ? "s" : ""}`,
    ].filter(Boolean).join(", ");

    if (recorded) {
      if (
        !confirm(
          `${label} has ${recorded} against it, so it cannot be deleted without ` +
            `destroying the record of the sale.\n\nArchive it instead? It leaves the ` +
            `stock list but stays in your sold figures.`,
        )
      )
        return;
      try {
        /* Status goes with it: archiving retires a unit whose sale is recorded,
           so leaving it INVENTORY kept it counting as live stock and publishing
           to the dealer's website. The server enforces the same pairing, so a
           Light or raw-API archive cannot get this wrong either. */
        await updateVehicle(id, { archivedAt: new Date().toISOString(), status: "SOLD" });
        setSelectedDetailVehicle(null);
        loadAllState();
        addNotification("Archived", `${label} is off the floor and still counted in sold figures.`, "info");
      } catch (err: any) {
        addNotification("Could not archive vehicle", err?.message || "Something went wrong.", "warning");
      }
      return;
    }

    const openEnquiries = state.leads.filter(
      (l) => l.vehicleId === id && l.status !== "Closed Won",
    ).length;
    const warning = openEnquiries
      ? `\n\n${openEnquiries} enquir${openEnquiries === 1 ? "y" : "ies"} will be kept but unlinked from this car.`
      : "";
    if (!confirm(`Remove ${label} from stock?${warning}\n\nThis cannot be undone.`)) return;

    try {
      await deleteVehicle(id);
      setSelectedDetailVehicle(null);
      loadAllState();
      addNotification("Removed from stock", `${label} is no longer on the floor.`, "info");
    } catch (err: any) {
      addNotification("Could not remove vehicle", err?.message || "Something went wrong.", "warning");
    }
  };

  /* Tasks accumulate — completed and stale ones clutter the list with no way to
     clear them. A direct per-row delete keeps it tidy. Guarded by a confirm
     because it removes the task for the whole dealership and isn't reversible,
     matching the stock-removal flow. */
  const handleDeleteTask = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?\n\nThis removes the task for everyone and cannot be undone.`)) return;
    try {
      await deleteTask(id);
      loadAllState();
      addNotification("Task deleted", `"${title}" was removed from the list.`, "info");
    } catch (err: any) {
      addNotification("Could not delete task", err?.message || "Something went wrong.", "warning");
    }
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

  /* Lead search — filters the shared, tenant-scoped lead list on anything a
     salesperson might reach for: name, phone, email or the stock it points at.
     One matcher so Board and List answer the same query. */
  const leadMatchesQuery = (l: { firstName?: string; lastName?: string; phone?: string; email?: string; vehicleId?: string }) => {
    const q = leadQuery.trim().toLowerCase();
    if (!q) return true;
    return [l.firstName, l.lastName, l.phone, l.email, getVehicleLabel(l.vehicleId)]
      .some((f) => (f || "").toLowerCase().includes(q));
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
    setActiveSection("dashboard");
    setIsLoggedIn(false);
  };

  /** LoginSplash has already exchanged the code for a token by this point. */
  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  // Submit functions
  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLead({
      ...newLeadForm,
    });
    setIsLeadModalOpen(false);
    setNewLeadForm({ firstName: "", lastName: "", phone: "", email: "", vehicleId: state.vehicles[0]?.id || "", source: "Website", notes: "" });
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
        source: "Website Chat",
        notes: "Captured via Live Receptionist chat widget."
      });
      loadAllState();
    } catch (e) {
      console.error(e);
    }
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
    const { category, ...vehicleFields } = newVehicleForm;
    await createVehicle({
      ...vehicleFields,
      // "" is the form's "Auto" choice, not a category. Sending it would put an
      // empty string on the record and leave the website matching against a
      // tier that doesn't exist; omitting the key lets it fall back to guessing
      // from price and model, which is what "Auto" promises.
      ...(category ? { category } : {}),
      images: [] as string[],
      damagePhotos: [] as string[],
      vinPhotos: [] as string[],
      serviceBookPhotos: [] as string[],
      extrasPhotos: [] as string[],
    });
    const stock = newVehicleForm.stockNumber;
    addNotification(
      "Vehicle on floor",
      `${newVehicleForm.year} ${newVehicleForm.make} ${newVehicleForm.model} (${stock}) — open TruLens to shoot, then Export to DMS`,
      "info"
    );
    setActiveSection("inventory");
    setNewVehicleForm({
      year: new Date().getFullYear(),
      make: "",
      model: "",
      trim: "",
      engine: "",
      fuelType: "Petrol",
      transmission: "Automatic",
      bodyType: "",
      retailPrice: 0,
      costPrice: 0,
      mileage: 0,
      stockNumber: "",
      description: "",
      dealershipId: dealershipId || "",
      category: "",
    });
    loadAllState();
    if (hasProduct("lens") && confirm("Stock created. Open TruLens now to shoot this unit?")) {
      openTruLens(stock);
    }
  };

  const handleExportCSV = () => {
    const { sold, totalRevenue, totalProfit, reconTotal } = eodTotals;
    const rows: (string | number)[][] = [
      ["TruFlow - End of Day Operations Summary"],
      ["Date", new Date().toISOString().split('T')[0]],
      [],
      ["Key Performance Indicators", "Value"],
      ["Leads Engaged / Worked", `${state.leads.length} Leads`],
      ["Vehicles Moved (Sold)", `${sold.length} Units`],
      ["Total Reconditioning Outlay", `R ${reconTotal.toLocaleString()}`],
      ["Gross Sales Revenue", `R ${totalRevenue.toLocaleString()}`],
      ["Total Profit Realized", `R ${totalProfit.toLocaleString()}`],
      [],
      ["Finalized Sales Transactions"],
      ["Stock Ref", "Vehicle Model", "Sale Amount", "Calculated Gross Margin"],
      ...sold.map(v => [v.stockNumber || "", `${v.year} ${v.make} ${v.model}`, `R ${(v.retailPrice || 0).toLocaleString()}`, `R ${((v.retailPrice || 0) - (v.costPrice || 0)).toLocaleString()}`]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
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
  };

  return (
    !isLoggedIn ? (
      <LoginSplash onLogin={handleLogin} />
    ) : (
      <div className="min-h-full flex-1 bg-[color:var(--ink)] text-[color:var(--white)] relative select-none perspective-scene">
        {/* Scroll indicator */}
        <div className="scroll-progress transition-transform" />

      {/* Grid Pattern overlays */}
      <div className="bg-grid" />

      <aside
        style={{
          paddingTop: "1.25rem",
          paddingBottom: "1.25rem",
          paddingLeft: "1.25rem",
        }}
        className="glass-sidebar flex fixed left-0 top-0 bottom-0 w-[240px] pr-5 flex-col z-[180]"
      >
        <div className="mb-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-center px-1">
            <svg viewBox="0 0 512 512" className="h-20 w-20" aria-label="TruFlow">
              <defs>
                <radialGradient id="chassisBase" cx="50%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#0E182A"/><stop offset="60%" stopColor="#04070D"/><stop offset="100%" stopColor="#000000"/>
                </radialGradient>
                <linearGradient id="cyanGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF"/><stop offset="18%" stopColor="#E0F2FE"/><stop offset="42%" stopColor="#38BDF8"/><stop offset="70%" stopColor="#00F2FE"/><stop offset="90%" stopColor="#0D9488"/><stop offset="100%" stopColor="#022C2A"/>
                </linearGradient>
                <linearGradient id="machinedTitanium" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF"/><stop offset="15%" stopColor="#CBD5E1"/><stop offset="40%" stopColor="#64748B"/><stop offset="75%" stopColor="#1E293B"/><stop offset="100%" stopColor="#0A0E17"/>
                </linearGradient>
                <linearGradient id="specularWhite" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFFFFF"/><stop offset="50%" stopColor="#A5F3FC"/><stop offset="100%" stopColor="rgba(255,255,255,0.2)"/>
                </linearGradient>
                <filter id="neonBloom" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="16" result="blur"/><feComposite in="SourceGraphic" in2="blur" operator="over"/>
                </filter>
              </defs>
              <circle cx="256" cy="256" r="246" fill="url(#chassisBase)" stroke="rgba(255,255,255,0.12)" strokeWidth="2"/>
              <circle cx="256" cy="240" r="130" fill="url(#cyanGlass)" opacity="0.25" filter="url(#neonBloom)"/>
              <g transform="translate(256, 256) rotate(-30)">
                <ellipse cx="0" cy="0" rx="212" ry="68" fill="none" stroke="url(#cyanGlass)" strokeWidth="7" filter="url(#neonBloom)" opacity="0.8"/>
                <ellipse cx="0" cy="0" rx="212" ry="68" fill="none" stroke="#00F2FE" strokeWidth="2.5" opacity="0.95"/>
                <circle cx="190" cy="-28" r="8" fill="#FFFFFF" filter="url(#neonBloom)"/>
              </g>
              <g transform="translate(256, 245) scale(1.18)">
                <path d="M-88 -65 L0 -128 L0 -25 L-48 38 L-88 -10 Z" fill="url(#machinedTitanium)" stroke="#090D16" strokeWidth="1.5"/>
                <path d="M-48 38 L0 -25 L0 98 L-48 38 Z" fill="url(#machinedTitanium)" opacity="0.9"/>
                <path d="M88 -65 L0 -128 L0 -25 L48 38 L88 -10 Z" fill="url(#cyanGlass)" filter="url(#neonBloom)" opacity="0.95"/>
                <path d="M88 -65 L0 -128 L0 -25 L48 38 L88 -10 Z" fill="url(#cyanGlass)"/>
                <path d="M48 38 L0 -25 L0 98 L48 38 Z" fill="url(#cyanGlass)"/>
                <polygon points="0,-128 34,-92 0,-56 -34,-92" fill="url(#specularWhite)" opacity="0.95" filter="url(#neonBloom)"/>
                <polygon points="0,-128 34,-92 0,-56 -34,-92" fill="#FFFFFF"/>
                <line x1="0" y1="-128" x2="0" y2="98" stroke="#FFFFFF" strokeWidth="3" opacity="0.95"/>
                <path d="M-88 -65 L0 -128 L88 -65" fill="none" stroke="url(#specularWhite)" strokeWidth="2.5" opacity="0.9"/>
              </g>
            </svg>
          </div>
          {/* Admin dealer context switcher — pick a dealer to see their world. */}
          {isMasterAdmin && state?.dealerships && state.dealerships.length > 0 && (
            <div className="mt-2 w-full px-1">
              <select
                value={adminDealerScope || ""}
                onChange={(e) => setAdminDealerScope(e.target.value || null)}
                className="w-full bg-[color:var(--ink-2)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] cursor-pointer"
              >
                <option value="">All dealerships</option>
                {state.dealerships.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          {/* The dealer's OWN showroom. This was hardcoded to true-cars.co.za,
              so every dealership's sidebar linked to our consumer site instead
              of to their website. */}
          {(() => {
            const mine = dealershipId
              ? (state?.dealerships || []).find((d: any) => d.id === dealershipId)
              : undefined;
            const site = mine?.websiteUrl;
            if (!site) return null;
            const label = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
            return (
              <>
                {/* The bare URL sat directly above a button that goes to the
                    same place — the button says what it does, the URL didn't. */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <a href={site} target="_blank" rel="noopener noreferrer"
                     className="text-[13px] px-3 py-1 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-faint)] transition-colors">
                    Your showroom
                  </a>
                  {hasProduct("flow-lite") && (
                    <a href={TRUFLOW_MOBILE_URL} target="_blank" rel="noopener noreferrer"
                       className="text-[13px] px-3 py-1 rounded-full bg-[rgba(0,136,255,0.08)] text-[#38BDF8] border border-[rgba(0,136,255,0.2)] hover:bg-[rgba(0,136,255,0.12)] transition-colors">
                      TruFlow Mobile
                    </a>
                  )}
                </div>
              </>
            );
          })()}
        </div>

         <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1 scrollbar-thin">
          {filteredNavigation.map((group) => (
            <div key={group.category} className="flex flex-col gap-1">
              <span className="font-mono text-[13px] text-[rgba(232,234,230,0.72)] tracking-wide font-semibold pl-3 mb-1 block">
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
                    className={`glass-nav-item flex items-center gap-3 px-3 py-2.5 min-h-11 text-[13px] font-semibold rounded-xl text-left relative cursor-pointer border ${
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
                    {navAttention[n.id] > 0 ? (
                      <span
                        aria-label={`${navAttention[n.id]} awaiting action`}
                        className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[12px] font-semibold grid place-items-center leading-none tabular-nums"
                      >
                        {navAttention[n.id] > 99 ? "99+" : navAttention[n.id]}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Support + sign out. No WhatsApp green — brand.css is explicit that
            cyan carries every live state, and a sticker-green button read as a
            widget, not the product. The glyph and the "WhatsApp" label carry
            channel recognition instead. The deep-link pre-fills who is asking
            and where they were, so support opens with context. */}
        <div className="pt-2.5 mt-1.5 border-t border-white/10 shrink-0 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() =>
              openSupportWhatsApp(
                `TruFlow ${PRODUCT_TIER} support · ${dealershipLabel}\nSection: ${activeSection}\n\n`
              )
            }
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-faint)] transition-colors cursor-pointer"
            title="Message TruSaaS support on WhatsApp"
          >
            <MessageCircle size={15} className="text-[color:var(--cyan-bright)] shrink-0" />
            Support
            <span className="ml-auto text-[12px] font-normal text-[color:var(--muted)]">WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-[13px] font-semibold tracking-normal text-[color:var(--white-dim)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] hover:bg-[color:var(--glass)] hover:text-[color:var(--white-dim)] transition-all cursor-pointer"
            title="Sign out of TruFlow"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 md:ml-[240px] min-h-0 px-4 py-6 pb-[calc(96px_+_env(safe-area-inset-bottom,0px))] md:px-8 md:py-8 md:pb-[calc(2rem_+_env(safe-area-inset-bottom,0px))] z-10 flex flex-col gap-6 w-full md:w-auto">
        {/* Top Profile Bar - Hidden on mobile */}
        {/* The top bar was a row of pills on a hairline with nothing behind it,
            so it read as the first row of content rather than as chrome. It now
            uses the same surface vocabulary as .card — ink-2, a lit top
            hairline, one soft shadow — and sticks, which also keeps the three
            counters reachable instead of only true at the top of the page.
            Inset rather than full-bleed on purpose: negative margins to reach
            the page edge would push past main's max-width and introduce a
            horizontal scrollbar at wide viewports. */}
        <div className="flex justify-between items-center gap-4 sticky top-3 z-[60] rounded-xl px-4 py-2.5 bg-[color:var(--ink-2)]/92 backdrop-blur-md border border-[color:var(--glass-line)] shadow-[0_1px_0_rgba(232,234,230,0.06)_inset,0_18px_40px_-28px_rgba(0,0,0,0.8)]">
           {/* Morning strip — the floor at a glance, on every screen. Only the
               unanswered-lead figure is allowed to go red; if everything shouts,
               nothing does. */}
           <div className="flex items-center gap-2 min-w-0">
             <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[length:var(--t-micro)] bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] font-medium">
               <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--cyan)] animate-pulse" />
               <span>{dealershipLabel}</span>
               <span className="opacity-40 select-none">•</span>
               <span>live</span>
               <span className="opacity-40 select-none">•</span>
               <span>{new Date().toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}</span>
             </span>
           </div>

           <div className="flex items-center gap-2 shrink-0">
             <button
               type="button"
               onClick={() => setGuideOpen(true)}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] hover:text-[color:var(--white-dim)] transition-colors cursor-pointer text-[13px] font-semibold"
               title="How-to guides"
             >
               <HelpCircle size={14} />
               Guides
             </button>
             {(selectedRole === 'manager' || selectedRole === 'owner') && (
               <button
                 type="button"
                 onClick={() => setShowEODReport(true)}
                 className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] hover:text-[color:var(--white-dim)] transition-colors cursor-pointer text-[13px] font-semibold"
                 title="End of day summary"
               >
                 <TrendingUp size={14} />
                 EOD
               </button>
             )}
             <button
               type="button"
               onClick={() => setAssistOpen(true)}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)] hover:text-[color:var(--ink)] transition-colors cursor-pointer text-[13px] font-semibold"
               title="Ask Dealer Assist"
             >
               <MessageCircle size={14} />
               Assist
             </button>
             {/* Who is signed in now lives under the sidebar logo — it was
                 repeated three times across the top bar. */}
             <button
               type="button"
               onClick={handleLogout}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--glass)] text-[color:var(--muted)] hover:bg-[color:var(--glass)] hover:text-[color:var(--white-dim)] transition-all cursor-pointer border border-[color:var(--glass-line)] text-[13px] font-semibold tracking-normal"
               title="Log out"
             >
               <LogOut size={14} />
               Log out
             </button>
           </div>
        </div>

        {/* OVERVIEW SECTION */}
        {activeSection === "dashboard" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
            {/* Framed header. The plain heading read like a page title on a
                form; a dealer opening this at 8am should see whose floor it is,
                that it is live, and have the assistant one click away. */}
            {/* Framed header — desktop only. On a phone the sticky mobile header
                already names the dealership and date, so this card is redundant
                there (flex). The date folds into the live pill; the
                page-title heading and the strapline prose are gone. */}
            <div className="card py-4 px-6 flex items-center justify-between gap-4">
              <h1 className="font-sans text-xl font-semibold tracking-tight text-[color:var(--white)]">
                Dealership overview
              </h1>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigateTo("upload")} className="btn btn-primary">
                  New inventory
                </button>
              </div>
            </div>

            {/* First-run setup reminder. The modal fires once per account; this
                quiet card keeps only the REQUIRED gaps visible until they're
                done (or snoozed for a week). */}
            {accountRole !== "salesperson" && !setupCardHidden && (
              <SetupChecklistCard
                status={setupStatus}
                onGoToSettings={() => navigateTo("settings")}
                onSnooze={() => {
                  snoozeSetup(7);
                  setSetupCardHidden(true);
                }}
              />
            )}

            {/* Stats — mobile. Re-cut for a salesperson on the floor: the one
                number that is actionable the moment the app opens leads
                full-width with a chevron into leads; the rest fold down into a
                pair and a strip. The 5-tile desktop grid is below (hidden md). */}
            {(() => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const allDrives = state.leads.flatMap(l => (l as any).testDrives || []);
              const todayDrives = allDrives.filter((d: any) => d.scheduledAt?.slice(0, 10) === todayStr);
              const todayTestDrives = todayDrives.filter((d: any) => d.type === 'test_drive').length;
              const todayVisits = todayDrives.filter((d: any) => d.type === 'viewing').length;
              const todayTradeIns = todayDrives.filter((d: any) => d.type === 'trade_in').length;
              const todayLeads = state.leads.filter(l => l.createdAt?.slice(0, 10) === todayStr).length;
              return (
                <>
                  <div className="grid grid-cols-3 lg:grid-cols-5 gap-2">
                    <button onClick={() => navigateTo("leads")} className="stat-card px-3 py-3 text-center cursor-pointer border-[color:var(--cyan-soft)] transition-colors">
                      <div className="text-[11px] font-mono text-[color:var(--muted)]">Needs reply</div>
                      <div className={`text-[24px] font-semibold leading-none mt-1.5 ${replyIsLate ? "text-[color:var(--white)]" : "text-[color:var(--muted)]"}`}><Counter value={awaitingReply.length} /></div>
                      <div className="text-[11px] text-[rgba(232,234,230,0.45)] mt-1">{awaitingReply.length > 0 ? `oldest ${formatWait(oldestWaitMs)}` : "all clear"}</div>
                    </button>
                    <button onClick={() => navigateTo("tasks")} className="stat-card px-3 py-3 text-center cursor-pointer border-[color:var(--glass-line)] transition-colors">
                      <div className="text-[11px] font-mono text-[color:var(--muted)]">Due today</div>
                      <div className="text-[24px] font-semibold leading-none text-[color:var(--white)] mt-1.5"><Counter value={dueTodayCount} /></div>
                      <div className="text-[11px] text-[rgba(232,234,230,0.45)] mt-1">{overdueCount > 0 ? `${overdueCount} late` : "on track"}</div>
                    </button>
                    <button onClick={() => navigateTo("inventory")} className="stat-card px-3 py-3 text-center cursor-pointer border-[color:var(--glass-line)] transition-colors">
                      <div className="text-[11px] font-mono text-[color:var(--muted)]">In stock</div>
                      <div className="text-[24px] font-semibold leading-none text-[color:var(--white)] mt-1.5"><Counter value={activeVehiclesCount} /></div>
                      <div className="text-[11px] text-[rgba(232,234,230,0.45)] mt-1">{agedStockCount > 0 ? `${agedStockCount} aged` : "fresh"}</div>
                    </button>
                    <div className="stat-card px-3 py-3 text-center border-[color:var(--glass-line)]">
                      <div className="text-[11px] font-mono text-[color:var(--muted)]">Sold</div>
                      <div className="text-[24px] font-semibold leading-none text-[color:var(--white)] mt-1.5"><Counter value={soldUnitsCount} /></div>
                      <div className="text-[11px] text-[rgba(232,234,230,0.45)] mt-1">{activeVehiclesCount + soldUnitsCount > 0 ? `${Math.round((soldUnitsCount / (activeVehiclesCount + soldUnitsCount)) * 100)}% moved` : ""}</div>
                    </div>
                    <div className="stat-card px-3 py-3 text-center border-[color:var(--glass-line)]">
                      <div className="text-[11px] font-mono text-[color:var(--muted)]">Gross after recon</div>
                      <div className="text-[24px] font-semibold leading-none text-[color:var(--cyan-bright)] mt-1.5"><Counter value={grossAfterRecon} prefix="R " /></div>
                      <div className="text-[11px] text-[rgba(232,234,230,0.45)] mt-1">{soldVehicles.length > 0 ? `${soldVehicles.length} deals` : ""}</div>
                    </div>
                  </div>
                  <div>
                  <div className="text-[11px] font-mono font-medium text-[color:var(--muted)] mb-1">Today's activity</div>
                  <div className="flex items-center justify-center gap-4 flex-wrap bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-[10px] px-4 py-2.5">
                    <button onClick={() => navigateTo("test_drives")} className="flex items-baseline gap-1 px-2 py-0.5 rounded hover:bg-white/5 cursor-pointer transition-colors">
                      <span className="text-[18px] font-semibold text-[color:var(--white)]">{todayTestDrives}</span>
                      <span className="text-[11px] text-[color:var(--muted)]">test drives</span>
                    </button>
                    <span className="w-px h-[14px] bg-[color:var(--glass-line)]" />
                    <button onClick={() => navigateTo("test_drives")} className="flex items-baseline gap-1 px-2 py-0.5 rounded hover:bg-white/5 cursor-pointer transition-colors">
                      <span className="text-[18px] font-semibold text-[color:var(--white)]">{todayVisits}</span>
                      <span className="text-[11px] text-[color:var(--muted)]">visits</span>
                    </button>
                    <span className="w-px h-[14px] bg-[color:var(--glass-line)]" />
                    <button onClick={() => navigateTo("test_drives")} className="flex items-baseline gap-1 px-2 py-0.5 rounded hover:bg-white/5 cursor-pointer transition-colors">
                      <span className="text-[18px] font-semibold text-[color:var(--white)]">{todayTradeIns}</span>
                      <span className="text-[11px] text-[color:var(--muted)]">trade-ins</span>
                    </button>
                    <span className="w-px h-[14px] bg-[color:var(--glass-line)]" />
                    <button onClick={() => navigateTo("leads")} className="flex items-baseline gap-1 px-2 py-0.5 rounded hover:bg-white/5 cursor-pointer transition-colors">
                      <span className="text-[18px] font-semibold text-[color:var(--cyan-bright)]">{todayLeads}</span>
                      <span className="text-[11px] text-[color:var(--muted)]">new leads</span>
                    </button>
                  </div>
                  </div>
                </>
              );
            })()}

            {/* Stock needing action — the money-bleed list. Overview's stats
                count aged stock; this surfaces the actual UNITS so the dealer
                principal can take the action in one click. Flagged:
                stale (40+ days held — the floorplan-distress convention) and/or
                overpriced (asking 10%+ over the dealer's own market benchmark,
                truPrice). Worst-first: critical age, then age, then over-by. */}
            {(() => {
              const STALE_STOCK_DAYS = 40;
              const OVERPRICED_PCT = 0.10;
              const flagged = state.vehicles
                .filter((v) => v.status !== "SOLD" && !v.archivedAt)
                .map((v: any) => {
                  const days = stockAge(v);
                  const tp = Number(v.truPrice) || 0;
                  const overBy = tp > 0 && (v.retailPrice || 0) > tp * (1 + OVERPRICED_PCT)
                    ? Math.round((v.retailPrice || 0) - tp)
                    : 0;
                  return { v, days, overBy, sev: days >= 60 ? 2 : days >= STALE_STOCK_DAYS ? 1 : 0 };
                })
                .filter((f) => f.sev > 0 || f.overBy > 0)
                .sort((a, b) => (b.sev - a.sev) || (b.days - a.days) || (b.overBy - a.overBy));
              const shown = flagged.slice(0, 6);
              const rest = flagged.length - shown.length;
              if (flagged.length === 0) return null;
              return (
                <div className="card">
                  <div className="card-header flex justify-between items-center border-b border-white/5 px-4 py-3">
                    <h3 className="font-semibold text-[16px]">Stock needing action</h3>
                    <button onClick={() => navigateTo("stock_health")} className="btn btn-secondary btn-sm">Stock health</button>
                  </div>
                  <div className="card-body p-0 overflow-x-auto">
                    <table className="stack-mobile w-full text-[13px] text-left border-collapse min-w-[640px]">
                      <thead>
                        <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                          <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Vehicle</th>
                          <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Signal</th>
                          <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Asking</th>
                          <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)] text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((f) => (
                          <tr key={f.v.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                            <td className="py-3 px-4">
                              <div className="font-medium text-[color:var(--white)]">{f.v.year} {f.v.make} {f.v.model}</div>
                              <div className="text-[11px] text-[color:var(--muted)]">{f.v.trim ? `${f.v.trim} • ` : ""}Stock {f.v.stockNumber}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono border ${f.days >= 60 ? "bg-[rgba(184,106,106,0.12)] text-[#B86A6A] border-[rgba(184,106,106,0.25)]" : "bg-[rgba(245,158,11,0.1)] text-[#F59E0B] border-[rgba(245,158,11,0.3)]"}`}>{f.days}d held</span>
                              {f.overBy > 0 && (
                                <span className="ml-1.5 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-mono bg-[rgba(184,106,106,0.12)] text-[#B86A6A] border border-[rgba(184,106,106,0.25)]">R{f.overBy.toLocaleString()} over mkt</span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-[color:var(--white)]">R {(f.v.retailPrice || 0).toLocaleString()}</td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => setSelectedDetailVehicle(f.v)} className="btn btn-secondary btn-sm">Reprice</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rest > 0 && (
                      <div className="px-4 py-2.5 text-[12px] text-[color:var(--muted)] border-t border-white/5">
                        {rest} more — full list in <button onClick={() => navigateTo("stock_health")} className="underline hover:text-[color:var(--white)]">Stock health</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Leads — highest priority, what needs attention now */}
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
                <table className="stack-mobile w-full text-[13px] text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] bg-[color:var(--glass)]">
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Customer</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Car</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Channel</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Stage</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Agent</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.leads.slice(0, 5).map((l) => (
                      <tr key={l.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4 font-semibold text-[color:var(--white)]">
                          {l.firstName} {l.lastName}
                          <span className="block text-[13px] font-normal text-[rgba(232,234,230,0.72)] mt-0.5">{l.phone}</span>
                        </td>
                        <td data-label="Model" className="py-3 px-4 font-semibold">{getVehicleLabel(l.vehicleId)}</td>
                        <td data-label="Channel" className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] rounded text-[13px] font-semibold tracking-normal">
                            {l.source}
                          </span>
                        </td>
                        <td data-label="Stage" className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] rounded text-[13px] font-semibold tracking-normal">
                            {l.status}
                          </span>
                        </td>
                        <td data-label="Agent" className="py-3 px-4 text-[rgba(232,234,230,0.72)]">{getUserLabel(l.assignedUserId)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setLeadDetailId(l.id)}
                            className="px-4 py-2 bg-[color:var(--cyan)] hover:bg-[color:var(--cyan-soft)] text-[color:var(--ink)] transition-all font-semibold rounded-lg text-[13px] cursor-pointer shadow-lg shadow-[color:var(--cyan-faint)] active:scale-95"
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

            {/* Showroom Inventory */}
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
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-[13px] text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)] bg-[color:var(--glass)]">
                      <th className="py-2.5 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Vehicle</th>
                      <th className="py-2.5 px-3 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Stock #</th>
                      <th className="py-2.5 px-3 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)] text-right">Retail</th>
                      <th className="py-2.5 px-3 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)] text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.vehicles.filter((v) => v.status === "INVENTORY").slice(0, 6).map((v) => {
                      const days = Number(v.daysInInventory) || 0;
                      return (
                        <tr key={v.id} onClick={() => setSelectedDetailVehicle(v)} className="border-b border-white/5 cursor-pointer hover:bg-white/[0.03] transition-colors">
                          <td className="py-2.5 px-4 font-semibold text-[color:var(--white)]">{v.year} {v.make} {v.model}
                            <span className="block text-[11px] font-normal text-[rgba(232,234,230,0.55)]">{v.transmission} · {v.fuelType}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[color:var(--muted)]">{v.stockNumber}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-[color:var(--cyan-bright)]">{formatZAR(v.retailPrice)}</td>
                          <td className={`py-2.5 px-3 text-right font-mono ${days >= 60 ? "text-amber-400" : "text-[rgba(232,234,230,0.72)]"}`}>{days}d</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] font-mono font-medium text-[color:var(--muted)]">Web readiness</div>
              <button onClick={() => navigateTo("web_management")} className="text-[11px] font-semibold text-[color:var(--cyan)] hover:underline cursor-pointer">Manage</button>
            </div>
            <div className="flex items-center justify-center gap-4 flex-wrap bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-[10px] px-4 py-2.5">
              {notOnline.blocked === 0 ? (
                <span className="text-[11px] text-[rgba(232,234,230,0.72)]">
                  All {notOnline.inStock} {notOnline.inStock === 1 ? "car" : "cars"} have galleries
                </span>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5 px-2">
                    <span className="text-[18px] font-semibold text-amber-400">{notOnline.blocked}</span>
                    <span className="text-[11px] text-[color:var(--muted)]">not online</span>
                  </div>
                  <span className="w-px h-[14px] bg-[color:var(--glass-line)]" />
                  <div className="flex items-baseline gap-1.5 px-2">
                    <span className="text-[18px] font-semibold text-[color:var(--white)]">{notOnline.noPhotos}</span>
                    <span className="text-[11px] text-[color:var(--muted)]">no photos</span>
                  </div>
                  <span className="w-px h-[14px] bg-[color:var(--glass-line)]" />
                  <div className="flex items-baseline gap-1.5 px-2">
                    <span className="text-[18px] font-semibold text-[color:var(--white)]">{notOnline.incomplete}</span>
                    <span className="text-[11px] text-[color:var(--muted)]">short</span>
                  </div>
                  <span className="w-px h-[14px] bg-[color:var(--glass-line)]" />
                  <div className="flex items-baseline gap-1.5 px-2">
                    <span className="text-[18px] font-semibold text-[color:var(--cyan-bright)]">{notOnline.ready}</span>
                    <span className="text-[11px] text-[color:var(--muted)]">ready</span>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        )}

        {/* ALL VEHICLES SECTION */}
        {activeSection === "inventory" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            {/* Search + filters — single compact bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[180px] max-w-[280px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,234,230,0.72)]" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="Search stock..."
                  className="w-full bg-[color:var(--glass)] border border-white/5 rounded-lg pl-9 pr-3 py-1.5 text-[13px] text-[color:var(--white)] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[color:var(--cyan)]"
                />
              </div>
              <Segmented
                value={inventoryStatusFilter}
                onChange={setInventoryStatusFilter}
                options={[
                  { value: "ALL", label: "All" },
                  { value: "INVENTORY", label: "In stock" },
                  { value: "SOLD", label: "Sold" },
                  { value: "ARCHIVED", label: "Archived" },
                ]}
              />
              <Segmented
                value={inventoryPhotoFilter}
                onChange={setInventoryPhotoFilter}
                options={[
                  { value: "ALL", label: "All" },
                  { value: "NEEDS", label: "Needs shoot" },
                  { value: "PARTIAL", label: "Partial" },
                  { value: "READY", label: "Web-ready" },
                ]}
              />
              <Segmented
                value={inventoryAgeFilter}
                onChange={setInventoryAgeFilter}
                options={[
                  { value: "ALL", label: "Any" },
                  { value: "30", label: "30+" },
                  { value: "60", label: "60+" },
                  { value: "90", label: "90+" },
                ]}
              />
              <div className="ml-auto flex items-center gap-1.5">
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
                  className="p-1.5 rounded-lg bg-[color:var(--glass)] border border-white/5 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] transition-colors"
                  title="Refresh photos from TruLens"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const live = state.vehicles.filter((v: any) => !v.archivedAt && v.status === "INVENTORY");
                    const rows = live.map((v: any) => {
                      const days = stockAge(v);
                      const r = computeDmsGalleryReadiness(v as any);
                      return [
                        v.stockNumber || "",
                        v.year || "",
                        v.make || "",
                        v.model || "",
                        v.trim || "",
                        v.transmission || "",
                        v.fuelType || "",
                        v.colour || "",
                        Number(v.mileage || 0).toLocaleString(),
                        Number(v.retailPrice || 0).toLocaleString(),
                        Number(v.costPrice || 0).toLocaleString(),
                        days.toString(),
                        r.label,
                        (v.images?.length || 0).toString(),
                        v.showOnWebsite !== false ? "Yes" : "No",
                        v.dateAcquired || "",
                      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
                    });
                    const header = "Stock #,Year,Make,Model,Trim,Transmission,Fuel,Colour,Mileage (km),Retail Price,Cost Price,Days in Stock,Gallery Status,Photos,On Website,Date Acquired";
                    const csv = [header, ...rows].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `TruFlow_Stock_List_${new Date().toISOString().split("T")[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                    addNotification("Stock List Exported", `${live.length} vehicles downloaded as CSV.`, "info");
                  }}
                  className="p-1.5 rounded-lg bg-[color:var(--glass)] border border-white/5 text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] transition-colors"
                  title="Export stock list CSV"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>

            {/* Grid list — paginated so 100+ cars don't render at once */}
            {(() => {
              const filteredInventory = state.vehicles
                .filter((v) => {
                  /* Archived units are off the floor: retired sold stock kept
                     only so the sale still counts in the money figures. Hidden
                     from every other view, but reachable through their own
                     filter — archiving must not be a one-way door. */
                  if (inventoryStatusFilter === "ARCHIVED") {
                    if (!v.archivedAt) return false;
                  } else if (v.archivedAt) {
                    return false;
                  }
                  const mSearch =
                    (v.make || "").toLowerCase().includes(inventorySearch.toLowerCase()) ||
                    (v.model || "").toLowerCase().includes(inventorySearch.toLowerCase()) ||
                    (v.stockNumber || "").toLowerCase().includes(inventorySearch.toLowerCase());
                  const mStatus =
                    inventoryStatusFilter === "ALL" ||
                    inventoryStatusFilter === "ARCHIVED" ||
                    v.status === inventoryStatusFilter;
                  const r = computeDmsGalleryReadiness(v as any);
                  const mPhoto =
                    inventoryPhotoFilter === "ALL" ||
                    (inventoryPhotoFilter === "NEEDS" && r.level === "capture") ||
                    (inventoryPhotoFilter === "PARTIAL" && r.level === "partial") ||
                    (inventoryPhotoFilter === "READY" && r.webReady);
                  const days = Number(v.daysInInventory) || 0;
                  const mAge = inventoryAgeFilter === "ALL" || days >= Number(inventoryAgeFilter);
                  return mSearch && mStatus && mPhoto && mAge;
                });
              const liveInventory = filteredInventory.filter((v) => v.status !== "SOLD");
              const soldInventory = filteredInventory.filter((v) => v.status === "SOLD");
              const visibleInventory = liveInventory.slice(0, inventoryVisibleCount);
              return (
                <>
                  <div className="overflow-x-auto card">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-[rgba(232,234,230,0.55)] border-b border-white/10">
                          <th className="text-left font-medium px-4 py-2.5">Vehicle</th>
                          <th className="text-left font-medium px-3 py-2.5">Stock #</th>
                          <th className="text-right font-medium px-3 py-2.5">Mileage</th>
                          <th className="text-left font-medium px-3 py-2.5">Trans</th>
                          <th className="text-left font-medium px-3 py-2.5">Fuel</th>
                          <th className="text-right font-medium px-3 py-2.5">Retail</th>
                          {selectedRole !== 'salesperson' && <th className="text-right font-medium px-3 py-2.5">Cost</th>}
                          <th className="text-right font-medium px-3 py-2.5">Age</th>
                          <th className="text-center font-medium px-3 py-2.5">Photos</th>
                          <th className="text-center font-medium px-3 py-2.5">Web</th>
                          <th className="text-center font-medium px-3 py-2.5">Status</th>
                          <th className="text-right font-medium px-4 py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleInventory.map((v) => {
                          const readiness = computeDmsGalleryReadiness(v as any);
                          const days = Number(v.daysInInventory) || 0;
                          const ageTone =
                            days >= 90 ? "text-red-400" : days >= 60 ? "text-amber-400" : days >= 30 ? "text-yellow-400" : "text-[rgba(232,234,230,0.72)]";
                          return (
                            <tr
                              key={v.id}
                              onClick={() => setSelectedDetailVehicle(v)}
                              className="border-t border-white/5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                            >
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-3">
                                  {v.images?.[0] ? (
                                    <img src={v.images[0]} alt="" className="w-10 h-7 rounded object-cover shrink-0 border border-white/5" />
                                  ) : (
                                    <div className="w-10 h-7 rounded bg-[color:var(--ink-2)] border border-white/5 flex items-center justify-center text-[10px] font-semibold text-[color:var(--muted)] shrink-0">
                                      {(v.make || "?").slice(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <div>
                                    <span className="text-[color:var(--white)] font-semibold">{v.year} {v.make} {v.model}</span>
                                    {v.trim && <span className="block text-[11px] text-[rgba(232,234,230,0.55)]">{v.trim}</span>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[color:var(--muted)]">{v.stockNumber}</td>
                              <td className="px-3 py-2.5 text-right text-[rgba(232,234,230,0.72)] font-mono">{Number(v.mileage || 0).toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-[rgba(232,234,230,0.72)]">{v.transmission || "—"}</td>
                              <td className="px-3 py-2.5 text-[rgba(232,234,230,0.72)]">{v.fuelType || "—"}</td>
                              <td className="px-3 py-2.5 text-right text-[color:var(--cyan-bright)] font-mono font-semibold">{formatZAR(Number(v.retailPrice) || 0)}</td>
                              {selectedRole !== 'salesperson' && <td className="px-3 py-2.5 text-right text-[rgba(232,234,230,0.72)] font-mono">{formatZAR(v.costPrice || 0)}</td>}
                              <td className={`px-3 py-2.5 text-right font-mono ${ageTone}`}>{days}d</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ color: readiness.color, background: readiness.color + "22" }}>
                                  {readiness.photoCount > 0 ? readiness.photoCount : "—"}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                <label className="cursor-pointer">
                                  <span className={"relative inline-flex h-[18px] w-[32px] items-center rounded-full transition-colors " + (v.showOnWebsite !== false ? "bg-[color:var(--cyan)]" : "bg-white/15")}>
                                    <span className={"inline-block h-[14px] w-[14px] rounded-full bg-white transition-transform " + (v.showOnWebsite !== false ? "translate-x-[16px]" : "translate-x-[2px]")} />
                                  </span>
                                  <input type="checkbox" className="sr-only" checked={v.showOnWebsite !== false} onChange={() => handleUpdateVehicle(v.id, { showOnWebsite: v.showOnWebsite === false } as Partial<Vehicle>)} />
                                </label>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${v.archivedAt ? "bg-white/5 text-[color:var(--muted)]" : v.status === "INVENTORY" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : "bg-white/5 text-[color:var(--muted)]"}`}>
                                  {v.archivedAt ? "Archived" : v.status === "INVENTORY" ? "In Stock" : "Sold"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  {v.archivedAt ? (
                                    <button type="button" onClick={async () => { try { await updateVehicle(v.id, { archivedAt: null }); loadAllState(); addNotification("Restored", `${v.year} ${v.make} ${v.model} is back on the floor.`, "info"); } catch (err: any) { addNotification("Could not restore vehicle", err?.message || "Something went wrong.", "warning"); } }} className="tru-btn-secondary px-2.5 py-1 text-[11px] font-semibold cursor-pointer">Restore</button>
                                  ) : v.status !== "SOLD" ? (
                                    <button type="button" onClick={() => handleMarkSold(v)} className="tru-btn-secondary px-2.5 py-1 text-[11px] font-semibold cursor-pointer">Sold</button>
                                  ) : (
                                    <button type="button" onClick={() => handleReturnToStock(v)} className="tru-btn-secondary px-2.5 py-1 text-[11px] font-semibold cursor-pointer">Unsell</button>
                                  )}
                                  {hasProduct("lens") && v.status === "INVENTORY" && !v.archivedAt && (
                                    <button type="button" onClick={() => openTruLens(v.stockNumber)} className="px-2 py-1 rounded text-[11px] font-semibold bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] border border-[color:var(--cyan-soft)]"><Camera size={10} /></button>
                                  )}
                                  <button type="button" onClick={() => openStockWhatsApp(v)} className="px-2 py-1 rounded text-[11px] font-semibold bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]"><MessageCircle size={10} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {liveInventory.length > 0 && (
                    <div className="flex items-center justify-between gap-3 flex-wrap pt-2 text-[13px] text-[rgba(232,234,230,0.55)]">
                      <span>
                        Showing {visibleInventory.length} of {liveInventory.length} in stock
                        {soldInventory.length > 0 && ` · ${soldInventory.length} sold`}
                      </span>
                      {liveInventory.length > inventoryVisibleCount && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setInventoryVisibleCount((n) => n + INVENTORY_PAGE)
                            }
                            className="btn bg-[color:var(--glass)] text-[color:var(--white)] border border-[color:var(--glass-line)] text-[13px] font-semibold"
                          >
                            Show {Math.min(INVENTORY_PAGE, liveInventory.length - inventoryVisibleCount)} more
                          </button>
                          <button
                            type="button"
                            onClick={() => setInventoryVisibleCount(liveInventory.length)}
                            className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px]"
                          >
                            Show all
                          </button>
                        </div>
                      )}
                      {liveInventory.length > INVENTORY_PAGE &&
                        inventoryVisibleCount > INVENTORY_PAGE &&
                        liveInventory.length <= inventoryVisibleCount && (
                          <button
                            type="button"
                            onClick={() => setInventoryVisibleCount(INVENTORY_PAGE)}
                            className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px]"
                          >
                            Collapse
                          </button>
                        )}
                    </div>
                  )}

                  {/* ── SOLD VEHICLES — collapsible table with deal details ── */}
                  {soldInventory.length > 0 && (
                    <details className="card overflow-hidden mt-2">
                      <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold text-[color:var(--white)] select-none flex items-center gap-2 [&::-webkit-details-marker]:hidden hover:bg-white/[0.02] transition-colors">
                        <ChevronDown size={14} className="text-[color:var(--muted)] transition-transform [[open]>&]:rotate-180" />
                        Sold Stock · {soldInventory.length} vehicle{soldInventory.length === 1 ? "" : "s"}
                        <span className="text-[color:var(--muted)] font-normal ml-auto">
                          {formatZAR(soldInventory.reduce((s, v) => s + (v.retailPrice || 0), 0))} revenue
                        </span>
                      </summary>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]">
                          <thead>
                            <tr className="text-[rgba(232,234,230,0.55)] border-t border-white/5">
                              <th className="text-left font-medium px-4 py-2">Vehicle</th>
                              <th className="text-left font-medium px-3 py-2">Stock #</th>
                              <th className="text-right font-medium px-3 py-2">Cost</th>
                              <th className="text-right font-medium px-3 py-2">Sold Price</th>
                              <th className="text-right font-medium px-3 py-2">Profit</th>
                              <th className="text-right font-medium px-3 py-2">Margin</th>
                              <th className="text-right font-medium px-4 py-2">Days held</th>
                            </tr>
                          </thead>
                          <tbody>
                            {soldInventory.map((v) => {
                              const m = grossMargin(v);
                              const days = stockAge(v);
                              return (
                                <tr
                                  key={v.id}
                                  onClick={() => setSelectedDetailVehicle(v)}
                                  className="border-t border-white/5 cursor-pointer hover:bg-white/[0.03] transition-colors"
                                >
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-3">
                                      {v.images?.[0] ? (
                                        <img src={v.images[0]} alt="" className="w-10 h-7 rounded object-cover shrink-0 border border-white/5" />
                                      ) : (
                                        <div className="w-10 h-7 rounded bg-[color:var(--ink-2)] border border-white/5 flex items-center justify-center text-[10px] font-semibold text-[color:var(--muted)] shrink-0">
                                          {(v.make || "?").slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                      <span className="text-[color:var(--white)]">{v.year} {v.make} {v.model}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono text-[color:var(--muted)]">{v.stockNumber}</td>
                                  <td className="px-3 py-2.5 text-right text-[rgba(232,234,230,0.72)] font-mono">{formatZAR(v.costPrice || 0)}</td>
                                  <td className="px-3 py-2.5 text-right text-[color:var(--white)] font-mono font-semibold">{formatZAR(v.retailPrice || 0)}</td>
                                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${m.rand >= 0 ? "text-[color:var(--cyan)]" : "text-[color:var(--muted)]"}`}>
                                    {formatZAR(m.rand)}
                                  </td>
                                  <td className={`px-3 py-2.5 text-right font-mono ${m.pct >= 10 ? "text-[color:var(--cyan)]" : "text-[color:var(--muted)]"}`}>
                                    {m.pct.toFixed(1)}%
                                  </td>
                                  <td className="px-4 py-2.5 text-right text-[rgba(232,234,230,0.72)]">{days}d</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-white/10 font-semibold">
                              <td className="px-4 py-2.5 text-[color:var(--white)]" colSpan={2}>Totals</td>
                              <td className="px-3 py-2.5 text-right font-mono text-[rgba(232,234,230,0.72)]">{formatZAR(soldInventory.reduce((s, v) => s + (v.costPrice || 0), 0))}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-[color:var(--white)]">{formatZAR(soldInventory.reduce((s, v) => s + (v.retailPrice || 0), 0))}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-[color:var(--cyan)]">{formatZAR(soldInventory.reduce((s, v) => s + grossMargin(v).rand, 0))}</td>
                              <td className="px-3 py-2.5 text-right font-mono text-[color:var(--cyan)]">
                                {(() => {
                                  const rev = soldInventory.reduce((s, v) => s + (v.retailPrice || 0), 0);
                                  const prof = soldInventory.reduce((s, v) => s + grossMargin(v).rand, 0);
                                  return rev > 0 ? ((prof / rev) * 100).toFixed(1) + "%" : "—";
                                })()}
                              </td>
                              <td className="px-4 py-2.5"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </details>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* UPLOAD VEHICLE SECTION */}
        {activeSection === "upload" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Add vehicle</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                  Create stock metadata here.{hasProduct("lens") && <> <b className="text-[color:var(--white)]">Photos only in TruLens</b> (guided shoot → Export to DMS).</>}
                </p>
              </div>
              <div className="flex gap-2">
                {hasProduct("lens") && (
                  <button
                    type="button"
                    onClick={() => openTruLens()}
                    className="btn btn-primary flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold"
                  >
                    <Camera size={12} /> Open TruLens
                  </button>
                )}
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
                  {/* Showroom tier — which category page this car lands on */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Showroom Category</label>
                    <select
                      value={newVehicleForm.category}
                      onChange={(e) => setNewVehicleForm((p) => ({ ...p, category: e.target.value as NewVehicleForm["category"] }))}
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
                    <span className="text-[13px] font-semibold font-mono tracking-wider  text-[color:var(--cyan)]">Showroom Vehicle Specifications</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Year</label>
                        <input
                          type="number"
                          value={newVehicleForm.year}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, year: parseInt(e.target.value) || 2026 }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Make</label>
                        <input
                          type="text"
                          value={newVehicleForm.make}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, make: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Model</label>
                        <input
                          type="text"
                          value={newVehicleForm.model}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, model: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Trim Level</label>
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
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Engine</label>
                        <input
                          type="text"
                          value={newVehicleForm.engine}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, engine: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Transmission</label>
                        <select
                          value={newVehicleForm.transmission}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, transmission: e.target.value as NewVehicleForm["transmission"] }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                        >
                          <option className="bg-[color:var(--ink-2)]" value="Automatic">Automatic</option>
                          <option className="bg-[color:var(--ink-2)]" value="Manual">Manual</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Fuel Type</label>
                        <select
                          value={newVehicleForm.fuelType}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, fuelType: e.target.value as NewVehicleForm["fuelType"] }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                        >
                          <option className="bg-[color:var(--ink-2)]" value="Diesel">Diesel</option>
                          <option className="bg-[color:var(--ink-2)]" value="Petrol">Petrol</option>
                          <option className="bg-[color:var(--ink-2)]" value="Hybrid">Hybrid</option>
                          <option className="bg-[color:var(--ink-2)]" value="Electric">Electric</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Body Type</label>
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
                        className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Cost Price (ZAR)</label>
                      <input
                        type="number"
                        value={newVehicleForm.costPrice}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, costPrice: parseFloat(e.target.value) || 0 }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Mileage (km)</label>
                      <input
                        type="number"
                        value={newVehicleForm.mileage}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, mileage: parseInt(e.target.value) || 0 }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Stock Number</label>
                      <input
                        type="text"
                        value={newVehicleForm.stockNumber}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, stockNumber: e.target.value }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none font-mono"
                      />
                    </div>
                  </div>

                  {hasProduct("lens") && (
                    <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] rounded-xl p-4 flex flex-col gap-2">
                      <span className="text-[13px] font-semibold font-mono tracking-wider  text-[color:var(--cyan)] flex items-center gap-2">
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
                        className="self-start mt-1 text-[13px] font-semibold tracking-normal px-3 py-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)]"
                      >
                        Open TruLens for this stock #
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Description</label>
                    <textarea
                      rows={3}
                      value={newVehicleForm.description}
                      onChange={(e) => setNewVehicleForm((p) => ({ ...p, description: e.target.value }))}
                      className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none font-sans"
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

        {/* BULK IMPORT */}
        {activeSection === "bulk_import" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8">
            <BulkImport
              existingStockNumbers={state.vehicles.map(v => v.stockNumber)}
              onImportVehicles={async (vehicles) => {
                for (const v of vehicles) {
                  await createVehicle({
                    ...v,
                    images: [],
                    damagePhotos: [],
                    vinPhotos: [],
                    serviceBookPhotos: [],
                    extrasPhotos: [],
                  });
                }
              }}
            />
          </div>
        )}

        {/* TEST DRIVES & VIEWINGS CALENDAR */}
        {activeSection === "test_drives" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8">
            <TestDriveCalendar
              leads={state.leads}
              vehicles={state.vehicles}
              onUpdateLead={(id, updates) => updateLead(id, updates)}
            />
          </div>
        )}

        {/* LEAD CRM SECTION */}
        {/* STOCK HEALTH — ageing and margin, the two numbers that decide whether
            a yard makes money. Everything shown was already in the data. */}
        {activeSection === "stock_health" && (() => {
          /* `live` excludes archived units explicitly. Archiving now forces
             SOLD, so the status test would catch them anyway — but this once
             relied on that invariant while nothing maintained it, and an
             archived car sat in Capital in stock. Say it outright.

             `sold` deliberately keeps them: archiving retires a car from the
             floor without retracting the sale, so realised margin must still
             count it. Filtering them here would shrink the money figures every
             time a dealer tidied up. */
          const live = filteredVehicles.filter((v) => v.status === "INVENTORY" && !v.archivedAt);
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
                            <td data-label="Vehicle" className="px-4 py-3 text-[13px] md:text-[15px]">
                              <span className="text-[color:var(--white)]">{v.year} {v.make} {v.model}</span>
                              <span className="text-[13px] text-[rgba(232,234,230,0.55)] ml-2">{v.stockNumber}</span>
                            </td>
                            <td data-label="Age" className="px-3 py-3 text-[13px] md:text-[15px] text-right" style={{ color: band.tone }}>{days}d</td>
                            <td data-label="Cost" className="px-3 py-3 text-[13px] md:text-[15px] text-right text-[rgba(232,234,230,0.72)]">{formatZAR(v.costPrice || 0)}</td>
                            <td data-label="Recon" className="px-3 py-3 text-[13px] md:text-[15px] text-right text-[rgba(232,234,230,0.72)]">{reconSpend(v) ? formatZAR(reconSpend(v)) : "—"}</td>
                            <td data-label="Asking" className="px-3 py-3 text-[13px] md:text-[15px] text-right text-[rgba(232,234,230,0.72)]">{formatZAR(v.retailPrice || 0)}</td>
                            <td data-label="Margin" className={`px-4 py-3 text-[13px] md:text-[15px] text-right font-medium ${m.rand < 0 ? "text-[color:var(--muted)]" : "text-[color:var(--white)]"}`}>
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
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--faint)]" />
                  <input
                    type="search"
                    value={leadQuery}
                    onChange={(e) => setLeadQuery(e.target.value)}
                    placeholder="Search leads…"
                    aria-label="Search leads"
                    className="pl-9 pr-3 py-2 rounded-lg border bg-[color:var(--glass)] border-white/5 text-[13px] text-[color:var(--white)] placeholder-[color:var(--faint)] outline-none focus:border-[color:var(--cyan-soft)] w-[180px] md:w-[220px]"
                  />
                </div>
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
                {/* De-glowed: a convenience action, not the loudest control in
                    the section. Ghost, no cyan fill, no pulse; the count is the
                    reason you'd tap it. */}
                <button
                  onClick={handleAutoAssign}
                  disabled={isAutoAssigning || (state?.leads.filter(l => l.status === "New").length === 0)}
                  className="tru-btn-ghost px-3 min-h-[36px] text-[13px] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={14} className={isAutoAssigning ? "animate-spin" : ""} />
                  {isAutoAssigning ? "Assigning…" : `Auto-assign ${state?.leads.filter(l => l.status === "New").length ?? 0} new`}
                </button>
                <button onClick={() => setIsLeadModalOpen(true)} className="btn btn-primary">
                  New lead
                </button>
              </div>
            </div>

            {/* Toggle view tabs */}
            <div className="flex gap-4 border-b border-white/5 pb-2">
              <button
                onClick={() => setLeadCRMTab("kanban")}
                className={`text-[13px] font-semibold transition-all border-b-2 pb-2 cursor-pointer ${
                  leadCrmTab === "kanban" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setLeadCRMTab("list")}
                className={`text-[13px] font-semibold transition-all border-b-2 pb-2 cursor-pointer ${
                  leadCrmTab === "list" ? "text-[color:var(--white)] border-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] border-transparent hover:text-[color:var(--white)]"
                }`}
              >
                List
              </button>
            </div>

            {leadCrmTab === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
                {["New", "Contacted", "Test Drive Scheduled", "Negotiating", "Closed Won", "Closed Lost"].map((stage) => {
                  // Off the scoped list, not state.leads — the board was the
                  // one view ignoring tenant scoping, which is why its counts
                  // disagreed with the header above it.
                  const stageLeads = filteredLeads.filter((l) => {
                    if (!leadMatchesQuery(l)) return false;
                    const statusMatch = l.status === stage;
                    const overdueMatch = !filterOverdueOnly || leadOverdue(l);
                    return statusMatch && overdueMatch;
                  });

                  return (
                    <div key={stage} className="flex-1 min-w-[220px] max-w-[280px] bg-[color:var(--glass)] rounded-xl p-3 flex flex-col gap-3 min-h-[460px] border border-white/5">
                      <div className="flex justify-between items-center border-b border-white/5 pb-1">
                        <span className="text-[13px] font-semibold text-[color:var(--muted)]">{stage}</span>
                        <span className="px-2 py-0.5 bg-[color:var(--glass)] rounded-full text-[13px] font-semibold text-[rgba(232,234,230,0.72)]">{stageLeads.length}</span>
                      </div>
                      <div className="flex-1 flex flex-col gap-3">
                        {stageLeads.map((l) => (
                          <div
                            key={l.id}
                            onClick={() => setLeadDetailId(l.id)}
                            className="pipeline-card p-3 flex flex-col gap-1 cursor-pointer transition-all hover:-translate-y-0.5 active:scale-98"
                          >
                            <div className="flex justify-between items-start">
                              <div className="font-medium text-[15px] text-[color:var(--white)]">{l.firstName} {l.lastName}</div>
                              {l.digitalScore >= 80 ? (
                                <span className="bg-[color:var(--cyan)] text-[color:var(--ink)] text-[12px] px-2 py-0.5 rounded font-medium tracking-normal">Hot</span>
                              ) : l.digitalScore >= 50 ? (
                                <span className="bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[12px] px-2 py-0.5 rounded font-medium tracking-normal border border-[color:var(--cyan-soft)]">Warm</span>
                              ) : (
                                <span className="bg-[color:var(--glass)] text-[color:var(--muted)] text-[12px] px-2 py-0.5 rounded font-medium tracking-normal border border-[color:var(--glass-line)]">Cold</span>
                              )}
                            </div>
                            <div className="text-[13px] md:text-[15px] text-[color:var(--white-dim)] truncate">{getVehicleLabel(l.vehicleId)}</div>
                            <div className="text-[12px] text-[color:var(--muted)] mt-1">{l.source}</div>

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
                                <span className="text-[13px] text-[color:var(--cyan)] font-semibold">Intent: {l.digitalScore}%</span>
                              </div>
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                {l.phone && (
                                  <button
                                    type="button"
                                    className="text-[13px] font-semibold px-2 py-0.5 rounded bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]"
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
                  <table className="stack-mobile w-full text-[13px] text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px]">
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Customer</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Car</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Origin</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Next step</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Status</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Agent</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)] text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads
                        .filter((l) => {
                          if (!leadMatchesQuery(l)) return false;
                          return !filterOverdueOnly || leadOverdue(l);
                        })
                        .map((l) => (
                          <tr key={l.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                            <td className="py-3 px-4 text-[13px] md:text-[15px] font-semibold text-[color:var(--white)]">
                              {l.firstName} {l.lastName}
                              <span className="block text-[13px] font-normal text-[rgba(232,234,230,0.72)] mt-0.5">{l.phone} / {l.email}</span>
                            </td>
                            <td data-label="Asset" className="py-3 px-4 text-[13px] md:text-[15px] font-semibold">{getVehicleLabel(l.vehicleId)}</td>
                            <td data-label="Origin" className="py-3 px-4">
                              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">{l.source}</span>
                            </td>
                            <td data-label="Next step" className="py-3 px-4">
                              {(() => {
                                const d = dueLabel(l);
                                return d ? (
                                  <span className={`text-[13px] font-medium ${d.overdue ? "text-[color:var(--muted)]" : "text-[rgba(232,234,230,0.72)]"}`}>
                                    {d.overdue ? "● " : ""}{d.text}
                                  </span>
                                ) : (
                                  <span className="text-[13px] text-[color:var(--faint)]">—</span>
                                );
                              })()}
                            </td>
                            <td data-label="Status" className="py-3 px-4">
                              <span className="text-[13px] font-medium text-[color:var(--white)]">{l.status}</span>
                            </td>
                            <td data-label="Agent" className="py-3 px-4 text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)]">{getUserLabel(l.assignedUserId)}</td>
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
                                  className="px-3 py-2 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] rounded-lg text-[13px] font-semibold"
                                >
                                  WhatsApp
                                </button>
                              )}
                              <button
                                onClick={() => setLeadDetailId(l.id)}
                                className="tru-btn-secondary px-4 min-h-[36px] text-[13px] cursor-pointer"
                              >
                                Review
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

        {/* DEAL READINESS SECTION — replaces the old Invoices + Agreements
            generators. Dealers issue invoices and contracts from their own
            systems; here we track only the status of each step to close and
            hand a deal over, so no customer documents live on the server. */}
        {activeSection === "deal_readiness" && (() => {
          const CHECK_ITEMS = [
            { key: "natis", label: "NATIS" },
            { key: "roadworthy", label: "Roadworthy" },
            { key: "invoiced", label: "Invoiced" },
            { key: "depositReceived", label: "Deposit" },
            { key: "delivered", label: "Delivered" },
          ] as const;
          const FINANCE_OPTS = ["N/A", "Submitted", "Approved", "Declined"] as const;
          /* Labels only — the ORDER comes from DOC_STAGES so this cannot drift
             from the server's idea of the sequence. It previously repeated the
             order by hand, under a comment warning not to. */
          const DOCHUB_LABELS: Record<DocStage, string> = {
            proforma: "Proforma",
            deed: "Offer to Purchase",
            compliance: "Compliance",
            invoice: "Invoice",
            handover: "Handover",
          };
          /* Completed deals drop off: this page is what is still outstanding.
             They stay reachable through Lead CRM, and the vehicle keeps its
             own record of the sale.

             Desktop only. The DocHub stage strip that explains WHY a deal
             disappeared is itself desktop-gated, so applying this on a phone
             removed deals with nothing on screen accounting for it — and a
             mobile user cannot reach DocHub to put it back either. */
          const deals = filteredLeads.filter(
            (l) =>
              (l.status === "Negotiating" || l.status === "Closed Won") &&
              !(isDesktop && l.docFlowCompletedAt)
          );
          const patchChecklist = async (lead: any, patch: any) => {
            await updateLead(lead.id, { dealChecklist: { ...(lead.dealChecklist || {}), ...patch } });
            loadAllState();
          };
          const openDocHub = (leadId: string) => {
            setLeadInitialTab("dochub");
            setLeadDetailId(leadId);
          };
          /* Compliance flow settings target(s). Configured once, not read every
             visit, so it now lives behind a header button + dialog rather than a
             full-width card at the top of the page. Desktop-only, same as before;
             the components behind it stay lazy-loaded. */
          const docFlowTarget = state?.dealerships
            ? (dealershipId ? state.dealerships.filter((d) => d.id === dealershipId) : state.dealerships)
            : [];
          const docFlowDemo =
            dealershipId && docFlowTarget.length === 0
              ? [{ id: dealershipId, name: sessionAccount?.label || "Demo Dealership", location: "" }]
              : [];
          const docFlowList = docFlowTarget.length > 0 ? docFlowTarget : docFlowDemo;
          return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Deal Readiness</h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[12px] text-[color:var(--muted)] bg-[color:var(--glass)] border border-[color:var(--glass-line)]">
                    <Monitor size={12} /> Desktop
                  </span>
                </div>
                {/* Configure the DocHub flow once — behind a button, not a card
                    that re-reads itself every visit. Desktop-only, same gate. */}
                {isDesktop && docFlowList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDocFlowSettingsOpen(true)}
                    className="tru-btn-secondary inline-flex items-center gap-2 px-3 min-h-[36px] rounded-[8px] text-[13px] font-semibold cursor-pointer shrink-0"
                  >
                    <SettingsIcon size={14} />
                    Compliance flow settings
                  </button>
                )}
              </div>

              {/* Compliance flow settings dialog. Same isDesktop gate and Suspense
                  boundary as the card it replaces — the lazy chunks still never
                  load on a phone. */}
              {isDesktop && docFlowSettingsOpen && docFlowList.length > 0 && (
                <div
                  className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-[2px] p-4 md:p-8"
                  onClick={() => setDocFlowSettingsOpen(false)}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    onClick={(e) => e.stopPropagation()}
                    className="card w-full max-w-2xl my-auto"
                    style={{ boxShadow: "var(--shadow-modal)" }}
                  >
                    <div className="card-header border-b border-white/5 px-5 py-3 flex items-center gap-2">
                      <FileText size={14} className="text-[color:var(--cyan-bright)]" />
                      <h3 className="font-semibold text-[16px] text-[color:var(--white)]">Compliance flow settings</h3>
                      <button
                        type="button"
                        onClick={() => setDocFlowSettingsOpen(false)}
                        aria-label="Close"
                        className="ml-auto h-8 w-8 grid place-items-center rounded-lg text-[color:var(--white-dim)] hover:bg-white/5 cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="p-5 flex flex-col gap-6">
                      {docFlowTarget.length === 0 && docFlowDemo.length > 0 && (
                        <div className="text-[12px] text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md px-3 py-2">
                          Preview only — this account has no persisted dealership record, so Save will not work.
                          Sign in with a dealer code to persist changes.
                        </div>
                      )}
                      {docFlowList.map((d) => (
                        <Suspense key={d.id} fallback={<div className="text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
                          <DocFlowSettings dealership={d as Dealership} isAdmin={isMasterAdmin} onSaved={loadAllState} />
                        </Suspense>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {deals.length === 0 ? (
                <div className="card p-8 text-center text-[13px] text-[rgba(232,234,230,0.72)]">
                  No active deals yet. A deal appears here once a lead reaches <span className="text-[color:var(--white)] font-semibold">Negotiating</span>.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {deals.map((lead) => {
                    const cl: any = lead.dealChecklist || {};
                    const done =
                      CHECK_ITEMS.filter((i) => cl[i.key]).length +
                      (cl.financeStatus && cl.financeStatus !== "N/A" ? 1 : 0);
                    const total = CHECK_ITEMS.length + 1;
                    /* Where the checklist and DocHub disagree, keyed to the box
                       it contradicts. DocHub stays authoritative and nothing is
                       auto-corrected — surfacing the conflict beats silently
                       picking a winner. Presentation moved from an amber banner
                       to a muted glyph beside the offending label; derivation
                       unchanged. Desktop only. */
                    const conflictByKey: Record<string, string> = {};
                    if (isDesktop) {
                      const pastCompliance = lead.docFlowCompletedAt
                        ? true
                        : lead.docStage
                        ? DOC_STAGES.indexOf(lead.docStage) > DOC_STAGES.indexOf("compliance")
                        : false;
                      const invoiceFinalised = filteredDocuments.some(
                        (d) => d.leadId === lead.id && d.stage === "invoice" && d.status === "Signed",
                      );
                      const enteredDocHub = !!lead.docStage || !!lead.docFlowCompletedAt;
                      if (pastCompliance && !cl.natis)
                        conflictByKey.natis = "Compliance is signed off, but NATIS is un-ticked.";
                      if (pastCompliance && !cl.roadworthy)
                        conflictByKey.roadworthy = "Compliance is signed off, but Roadworthy is un-ticked.";
                      if (enteredDocHub && !!cl.invoiced !== invoiceFinalised)
                        conflictByKey.invoiced = cl.invoiced
                          ? "Checklist says invoiced, but the DocHub invoice stage is not finalised."
                          : "The DocHub invoice is finalised, but the Invoiced box is un-ticked.";
                    }
                    return (
                      <div key={lead.id} className="card p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <span className="font-semibold text-[15px] text-[color:var(--white)] block truncate">
                              {lead.firstName} {lead.lastName}
                            </span>
                            <span className="block text-[13px] text-[rgba(232,234,230,0.72)] truncate">
                              {getVehicleLabel(lead.vehicleId)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[13px] font-medium text-[rgba(232,234,230,0.72)]">{lead.status}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] text-[rgba(232,234,230,0.55)] tabular-nums">{done}/{total}</span>
                              <div className="w-14 h-[3px] rounded-full bg-[rgba(232,234,230,0.12)] overflow-hidden">
                                <div className="h-full bg-[color:var(--cyan)] transition-all" style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* DocHub stage strip — a compact five-dot indicator of
                            where this deal is in the paperwork lifecycle, with a
                            button that jumps straight into the DocHub tab on the
                            lead modal (no double-click via Overview). Desktop only:
                            the modal DocHub tab itself is gated the same way. */}
                        {isDesktop && (() => {
                          /* A completed deal has every stage behind it. Reading
                             docStage alone cannot see that — it is null on both
                             completion and on a lead that never started — so a
                             finished deal showed five grey dots. */
                          const currentIdx = lead.docFlowCompletedAt
                            ? DOC_STAGES.length
                            : lead.docStage
                            ? DOC_STAGES.indexOf(lead.docStage)
                            : -1;
                          return (
                            <div className="flex items-center gap-3.5 pt-3 border-t border-white/5">
                              {/* Segmented rail: one thin bar per stage over its
                                  label. Done/current bars are cyan, pending bars
                                  faint. Order still from DOC_STAGES. */}
                              <div className="flex items-end gap-1.5 flex-1 min-w-0">
                                {DOC_STAGES.map((stage, idx) => {
                                  const filled = idx <= currentIdx;
                                  const current = idx === currentIdx;
                                  return (
                                    <div key={stage} className="flex-1 min-w-0 flex flex-col gap-1">
                                      <span
                                        className="h-[3px] rounded-full"
                                        style={{ background: filled ? "var(--cyan)" : "rgba(232,234,230,0.14)" }}
                                      />
                                      <span className={`text-[12px] truncate ${current ? "text-[color:var(--white)] font-semibold" : "text-[color:var(--muted)]"}`}>
                                        {DOCHUB_LABELS[stage]}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={() => openDocHub(lead.id)}
                                className="shrink-0 px-3 min-h-[32px] rounded-[8px] bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] border border-[color:var(--cyan-soft)] text-[12px] font-semibold hover:bg-[color:var(--cyan)] hover:text-black transition-colors"
                              >
                                Open Compliance Hub
                              </button>
                            </div>
                          );
                        })()}

                        {/* Checklist + finance on one wrapping row. A conflict
                            with DocHub shows as a muted glyph after the box it
                            contradicts (message in its title), and finance folds
                            in after a hairline divider rather than sitting in its
                            own headed block. */}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
                          {CHECK_ITEMS.map((item) => {
                            const on = !!cl[item.key];
                            const conflict = conflictByKey[item.key];
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => patchChecklist(lead, { [item.key]: !on })}
                                aria-pressed={on}
                                className="flex items-center gap-2 text-[13px] cursor-pointer"
                              >
                                <span
                                  className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] transition-all shrink-0"
                                  style={on
                                    ? { background: "var(--cyan)", color: "var(--ink)" }
                                    : { boxShadow: "inset 0 0 0 1px rgba(232,234,230,0.22), inset 0 2px 3px rgba(0,0,0,0.4)" }}
                                >
                                  {on && <Check size={12} strokeWidth={3} />}
                                </span>
                                <span className={on ? "text-[color:var(--white)]" : "text-[rgba(232,234,230,0.72)]"}>{item.label}</span>
                                {conflict && (
                                  <span title={conflict} className="inline-flex shrink-0">
                                    <AlertTriangle size={13} className="text-[color:var(--muted)]" />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          <span className="w-px h-[18px] bg-[color:var(--glass-line)] shrink-0" />
                          <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">Finance</span>
                          <div className="flex gap-1 flex-wrap">
                            {FINANCE_OPTS.map((o) => {
                              const active = (cl.financeStatus || "N/A") === o;
                              return (
                                <button
                                  key={o}
                                  type="button"
                                  onClick={() => patchChecklist(lead, { financeStatus: o })}
                                  className={`px-3 min-h-[28px] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors ${
                                    active ? "tru-btn-secondary" : "text-[color:var(--faint)] hover:text-[color:var(--white)]"
                                  }`}
                                >
                                  {o}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
        {/* DOCUMENTS — DEALS IN PROGRESS */}
        {activeSection === "documents" && (() => {
          /* Same ordered labels as Deal Readiness: the ORDER comes from
             DOC_STAGES so the rail and the modal DocHub can never disagree. */
          const DOCHUB_LABELS: Record<DocStage, string> = {
            proforma: "Proforma",
            deed: "Offer to Purchase",
            compliance: "Compliance",
            invoice: "Invoice",
            handover: "Handover",
          };
          const docsDeals = filteredLeads.filter(
            (l) =>
              (l.status === "Negotiating" || l.status === "Closed Won") &&
              !(isDesktop && l.docFlowCompletedAt)
          );
          return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Documents</h1>
                  {!isDesktop && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[12px] text-[color:var(--muted)] bg-[color:var(--glass)] border border-[color:var(--glass-line)]">
                      <Monitor size={12} /> Desktop
                    </span>
                  )}
                </div>
              </div>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] max-w-2xl -mt-3 leading-relaxed">
                Every live deal, at a glance — where its paperwork stands and one tap into the signing flow.
              </p>

              {docsDeals.length === 0 ? (
                <div className="card p-8 text-center text-[13px] text-[rgba(232,234,230,0.72)]">
                  No active deals yet. A deal appears here once a lead reaches <span className="text-[color:var(--white)] font-semibold">Negotiating</span>.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {docsDeals.map((lead) => {
                    const currentIdx = lead.docFlowCompletedAt
                      ? DOC_STAGES.length
                      : lead.docStage
                      ? DOC_STAGES.indexOf(lead.docStage)
                      : 0;
                    const openHub = () => {
                      setLeadInitialTab("dochub");
                      setLeadDetailId(lead.id);
                    };
                    return (
                      <div key={lead.id} className="card p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <span className="font-semibold text-[15px] text-[color:var(--white)] block truncate">
                              {lead.firstName} {lead.lastName}
                            </span>
                            <span className="block text-[13px] text-[rgba(232,234,230,0.72)] truncate">
                              {getVehicleLabel(lead.vehicleId)}
                            </span>
                          </div>
                          <span className="text-[13px] font-medium text-[rgba(232,234,230,0.72)]">
                            {lead.docFlowCompletedAt
                              ? "Complete"
                              : lead.docStage
                              ? DOCHUB_LABELS[lead.docStage]
                              : "Not started"}
                          </span>
                        </div>

                        {/* DocHub stage rail — same five-dot language as Deal
                            Readiness. The Open Compliance Hub action stays desktop-only,
                            matching where the modal's DocHub tab is available. */}
                        <div className="flex items-center gap-3.5 pt-3 border-t border-white/5">
                          <div className="flex items-end gap-1.5 flex-1 min-w-0">
                            {DOC_STAGES.map((stage, idx) => {
                              const filled = idx <= currentIdx;
                              const current = idx === currentIdx;
                              return (
                                <div key={stage} className="flex-1 min-w-0 flex flex-col gap-1">
                                  <span
                                    className="h-[3px] rounded-full"
                                    style={{ background: filled ? "var(--cyan)" : "rgba(232,234,230,0.14)" }}
                                  />
                                  <span className={`text-[12px] truncate ${current ? "text-[color:var(--white)] font-semibold" : "text-[color:var(--muted)]"}`}>
                                    {DOCHUB_LABELS[stage]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {isDesktop ? (
                            <button
                              type="button"
                              onClick={openHub}
                              className="shrink-0 px-3 min-h-[32px] rounded-[8px] bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] border border-[color:var(--cyan-soft)] text-[12px] font-semibold hover:bg-[color:var(--cyan)] hover:text-black transition-colors"
                            >
                              Open Compliance Hub
                            </button>
                          ) : (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[12px] text-[color:var(--faint)]">
                              <Monitor size={13} /> Desktop
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ACCOUNTING & RECON SECTION */}
        {activeSection === "accounting_recon" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <Suspense fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
              <AccountingRecon
              state={state}
              onAddExpense={handleCreateExpense}
              onReconcileExpense={handleReconcileExpense}
              onUpdateVehicle={handleUpdateVehicle}
              role={selectedRole}
            />
            </Suspense>
          </div>
        )}


        {/* CLIENTS DATABASE SECTION */}
        {activeSection === "clients" && (() => {
          const clients = (state.clients || []) as Client[];
          const [clientSearch, setClientSearch] = [clientSearchState, setClientSearchState];
          const filtered = clients.filter(c => {
            if (!clientSearch) return true;
            const q = clientSearch.toLowerCase();
            return `${c.firstName} ${c.lastName} ${c.company || ''} ${c.phone} ${c.email} ${c.code}`.toLowerCase().includes(q);
          });

          return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Client Database</h1>
                  <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">{clients.length} client{clients.length !== 1 ? 's' : ''} on file</p>
                </div>
                <button
                  onClick={() => setEditingClient({} as any)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[rgba(29,185,84,0.15)] text-[rgb(29,185,84)] border border-[rgba(29,185,84,0.3)] hover:bg-[rgba(29,185,84,0.25)] transition-colors"
                >
                  <Contact className="w-4 h-4" /> Add Client
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(232,234,230,0.4)]" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => setClientSearchState(e.target.value)}
                  placeholder="Search by name, company, phone, email…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[color:var(--white)] placeholder:text-[rgba(232,234,230,0.35)] focus:outline-none focus:border-[rgba(29,185,84,0.5)]"
                />
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-16 text-[rgba(232,234,230,0.45)] text-sm">
                  {clients.length === 0 ? "No clients yet. Add your first client to build your database." : "No clients match your search."}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.06)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] bg-[rgba(255,255,255,0.02)]">
                        <th className="px-4 py-3 font-medium">Code</th>
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Company</th>
                        <th className="px-4 py-3 font-medium">Phone</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">ID Number</th>
                        <th className="px-4 py-3 font-medium">City</th>
                        <th className="px-4 py-3 font-medium">Added</th>
                        <th className="px-4 py-3 font-medium w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(c => (
                        <tr
                          key={c.id}
                          className="border-t border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)] cursor-pointer transition-colors"
                          onClick={() => setEditingClient(c)}
                        >
                          <td className="px-4 py-3 text-[rgba(232,234,230,0.55)] font-mono text-xs">{c.code || '—'}</td>
                          <td className="px-4 py-3 text-[color:var(--white)] font-medium">{c.title ? `${c.title} ` : ''}{c.firstName} {c.lastName}</td>
                          <td className="px-4 py-3 text-[rgba(232,234,230,0.72)]">{c.company || '—'}</td>
                          <td className="px-4 py-3 text-[rgba(232,234,230,0.72)]">{c.phone || '—'}</td>
                          <td className="px-4 py-3 text-[rgba(232,234,230,0.72)]">{c.email || '—'}</td>
                          <td className="px-4 py-3 text-[rgba(232,234,230,0.55)] font-mono text-xs">{c.idNumber || '—'}</td>
                          <td className="px-4 py-3 text-[rgba(232,234,230,0.55)]">{c.city || '—'}</td>
                          <td className="px-4 py-3 text-[rgba(232,234,230,0.45)] text-xs">{c.createdAt}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={e => { e.stopPropagation(); if (confirm(`Delete ${c.firstName} ${c.lastName}?`)) handleDeleteClient(c.id); }}
                              className="p-1.5 rounded hover:bg-[rgba(255,60,60,0.1)] text-[rgba(232,234,230,0.35)] hover:text-[rgb(255,80,80)] transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {editingClient && (
                <div className="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-6" onClick={() => setEditingClient(null)}>
                  <div className="bg-[rgb(24,24,24)] rounded-2xl border border-[rgba(255,255,255,0.08)] w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.06)]">
                      <h2 className="text-lg font-semibold text-[color:var(--white)]">{editingClient.id ? 'Edit Client' : 'New Client'}</h2>
                      <button onClick={() => setEditingClient(null)} className="p-1.5 rounded-lg hover:bg-[rgba(255,255,255,0.06)] text-[rgba(232,234,230,0.55)]"><X className="w-5 h-5" /></button>
                    </div>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const fd = new FormData(e.currentTarget);
                        const data: any = {};
                        fd.forEach((v, k) => { if (v) data[k] = v; });
                        if (editingClient.id) {
                          await handleUpdateClient(editingClient.id, data);
                        } else {
                          await handleCreateClient(data);
                        }
                        setEditingClient(null);
                      }}
                      className="p-6 grid grid-cols-2 gap-4"
                    >
                      {[
                        { name: 'code', label: 'Client Code', placeholder: 'e.g. CMA001' },
                        { name: 'title', label: 'Title', placeholder: 'Mr / Mrs / Ms' },
                        { name: 'firstName', label: 'First Name *', placeholder: 'First name', required: true },
                        { name: 'lastName', label: 'Last Name *', placeholder: 'Last name', required: true },
                        { name: 'company', label: 'Company', placeholder: 'Company name' },
                        { name: 'phone', label: 'Phone *', placeholder: '082 000 0000', required: true },
                        { name: 'phone2', label: 'Phone 2', placeholder: 'Alt phone' },
                        { name: 'email', label: 'Email *', placeholder: 'email@example.com', required: true },
                        { name: 'idNumber', label: 'ID / Reg Number', placeholder: 'SA ID number' },
                        { name: 'vatNumber', label: 'VAT Number', placeholder: 'VAT number' },
                        { name: 'address', label: 'Address Line 1', placeholder: 'Street address' },
                        { name: 'address2', label: 'Address Line 2', placeholder: 'Address line 2' },
                        { name: 'suburb', label: 'Suburb', placeholder: 'Suburb' },
                        { name: 'city', label: 'City', placeholder: 'City' },
                        { name: 'province', label: 'Province', placeholder: 'Province' },
                        { name: 'postalCode', label: 'Postal Code', placeholder: 'Postal code' },
                      ].map(f => (
                        <label key={f.name} className="flex flex-col gap-1">
                          <span className="text-[11px] uppercase tracking-wider text-[rgba(232,234,230,0.45)] font-medium">{f.label}</span>
                          {f.name === 'province' ? (
                            <select
                              name={f.name}
                              defaultValue={(editingClient as any)[f.name] || ''}
                              className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[color:var(--white)] focus:outline-none focus:border-[rgba(29,185,84,0.5)]"
                            >
                              <option value="">Select province</option>
                              {['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'].map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              name={f.name}
                              type="text"
                              defaultValue={(editingClient as any)[f.name] || ''}
                              placeholder={f.placeholder}
                              required={(f as any).required}
                              className="px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-sm text-[color:var(--white)] placeholder:text-[rgba(232,234,230,0.25)] focus:outline-none focus:border-[rgba(29,185,84,0.5)]"
                            />
                          )}
                        </label>
                      ))}
                      <div className="col-span-2 flex justify-end gap-3 mt-4">
                        <button type="button" onClick={() => setEditingClient(null)} className="px-4 py-2 rounded-lg text-sm text-[rgba(232,234,230,0.55)] hover:bg-[rgba(255,255,255,0.06)] transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2 rounded-lg text-sm font-medium bg-[rgb(29,185,84)] text-white hover:bg-[rgb(25,160,72)] transition-colors">
                          {editingClient.id ? 'Save Changes' : 'Add Client'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* CUSTOMER FORM SECTION */}
        {activeSection === "customer_form" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Add a customer</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Use this form for remote customer registration.</p>
            </div>
            <div className="max-w-lg">
              <CustomerLeadForm dealershipId={dealershipId || "d1"} vehicles={activeStock} onSuccess={() => alert("Lead Captured!")} />
            </div>
          </div>
        )}

        {/* TASKS SECTION */}
        {activeSection === "tasks" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Tasks</h1>
                {(() => {
                  const open = state.tasks.filter((t) => t.status !== "Completed").length;
                  const done = state.tasks.length - open;
                  return (
                    <p className="text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                      {open} open · {done} done
                    </p>
                  );
                })()}
              </div>
              <button onClick={() => setIsTaskModalOpen(true)} className="btn btn-primary">
                New task
              </button>
            </div>

            {/* Checklist records */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Tasks</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="stack-mobile w-full text-[13px] text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] font-mono">
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Task</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Priority</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Assigned to</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Due Date</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Status</th>
                      <th className="py-3 px-4 text-right font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.tasks.map((t) => (
                      <tr key={t.id} className={`border-b border-white/[0.06] hover:bg-[color:var(--glass)] ${t.status === "Completed" ? "opacity-45" : ""}`}>
                        <td className="py-3 px-4">
                          <span className={`font-semibold text-[13px] md:text-[15px] text-[color:var(--white)] block ${t.status === "Completed" ? "line-through" : ""}`}>{t.title}</span>
                          <span className="text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)] block mt-0.5">
                            Focus: {getVehicleLabel(t.vehicleId || "")} / Lead: {getLeadLabel(t.leadId || "")}
                          </span>
                        </td>
                        <td data-label="Priority" className="py-3 px-4">
                          <span className="text-[13px] font-medium text-[color:var(--white-dim)] inline-flex items-center gap-1.5">
                            {t.priority === "Urgent" && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--state-attention)]" />}
                            {t.priority}
                          </span>
                        </td>
                        <td data-label="Assigned" className="py-3 px-4 text-[13px] md:text-[15px] font-semibold text-[rgba(232,234,230,0.72)]">{getUserLabel(t.assignedUserId)}</td>
                        <td data-label="Due" className="py-3 px-4 text-[13px] md:text-[15px]">{t.dueDate}</td>
                        <td data-label="Status" className="py-3 px-4">
                          <span className="text-[13px] font-medium text-[rgba(232,234,230,0.72)]">{t.status}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2 w-full">
                            {t.status !== "Completed" ? (
                              <button
                                onClick={async () => {
                                  await updateTask(t.id, { status: "Completed" });
                                  loadAllState();
                                }}
                                className="tru-btn-ghost px-3 min-h-[36px] text-[13px] cursor-pointer"
                              >
                                Resolve
                              </button>
                            ) : (
                              <Check size={16} className="text-[color:var(--cyan)]" />
                            )}
                            <button
                              onClick={() => handleDeleteTask(t.id, t.title)}
                              aria-label={`Delete task: ${t.title}`}
                              title="Delete task"
                              className="flex items-center justify-center h-9 w-9 rounded-[10px] text-[rgba(232,234,230,0.55)] hover:text-[#C07676] hover:bg-[rgba(184,106,106,0.14)] cursor-pointer transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
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
                <p className="text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                  {activeSeats} {activeSeats === 1 ? "person" : "people"} with access
                </p>
              </div>
              <button onClick={() => { setIssuedCode(null); setSeatError(""); setIsUserModalOpen(true); }} className="btn btn-primary">
                Add staff
              </button>
            </div>

            {seatError && <p className="text-[13px] text-[color:var(--muted)]">{seatError}</p>}

            {/* Who can sign in. Separate from the performance cards below, which
                also cover people who no longer have access. */}
            <div className="card p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1">
                <span className="text-[13px] font-semibold tracking-normal text-[rgba(232,234,230,0.72)]">Access</span>
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
                      <div className={`text-[13px] font-semibold truncate ${s.isActive ? "text-[color:var(--white)]" : "text-[rgba(232,234,230,0.72)] line-through"}`}>
                        {s.name}
                      </div>
                      <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">
                        {s.role}{s.isActive ? "" : " · no access"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRotateSeat(s.userId, s.name)}
                        className="text-[13px]  font-semibold text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"
                        title="Issue a replacement code"
                      >
                        New code
                      </button>
                      <button
                        onClick={() => handleToggleSeat(s.userId, !s.isActive)}
                        className={`text-[13px]  font-semibold cursor-pointer ${s.isActive ? "text-[color:var(--muted)] hover:opacity-80" : "text-[color:var(--cyan)] hover:opacity-80"}`}
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
                      <div className="w-9 h-9 rounded-full bg-[color:var(--cyan)] flex items-center justify-center font-semibold text-[13px] text-[color:var(--ink)]">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-[13px] text-[color:var(--white)]">{u.name}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">{u.role}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mt-1">
                      <div className="bg-[color:var(--glass)] border border-white/5 rounded p-2">
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{leadsAssigned}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider mt-0.5">Leads</div>
                      </div>
                      <div className="bg-[color:var(--glass)] border border-white/5 rounded p-2">
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{dealsCompleted}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider mt-0.5">Sales</div>
                      </div>
                      <div className="bg-[color:var(--glass)] border border-white/5 rounded p-2">
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{u.isActive ? "Online" : "Away"}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold tracking-wider mt-0.5">Status</div>
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
                <table className="stack-mobile w-full text-[13px] text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)] tracking-normal text-[13px] font-mono">
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Assigned to</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Email</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Role</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Phone</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.users.map((u) => (
                      <tr key={u.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4 text-[13px] md:text-[15px] font-semibold text-[color:var(--white)]">{u.name}</td>
                        <td data-label="Email" className="py-3 px-4 text-[13px] md:text-[15px] font-semibold">{u.email}</td>
                        <td data-label="Role" className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[13px] font-semibold tracking-normal ${
                            u.role === "admin" ? "bg-[color:var(--glass)] text-[color:var(--muted)]" : "bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)]"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td data-label="Contact" className="py-3 px-4 text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)]">{u.phone}</td>
                        <td data-label="Access" className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] rounded text-[13px] font-semibold tracking-normal">
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
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Repayment calculator</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Model lease structures & monthly amortization schedules</p>
            </div>
            <AmortizationCalc initialPrice={state.vehicles[0]?.retailPrice || 485000} />
          </div>
        )}

        {/* WEB MANAGEMENT — inline-editable stock grid */}
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
                className="btn btn-primary text-[13px] font-semibold flex items-center gap-2 px-4 py-3"
              >
                <Camera size={14} /> Open TruLens capture
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-semibold">With photos</div>
                <div className="text-2xl font-semibold text-[color:var(--cyan)] mt-1">
                  {activeStock.filter(v => (v.images?.length || 0) > 0).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-semibold">Need shoot</div>
                <div className="text-2xl font-semibold text-[color:var(--warning)] mt-1">
                  {activeStock.filter(v => computeDmsGalleryReadiness(v).level === "capture").length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-semibold">Web-ready gallery</div>
                <div className="text-2xl font-semibold text-[color:var(--cyan-bright)] mt-1">
                  {activeStock.filter(v => computeDmsGalleryReadiness(v).webReady).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-semibold">Public stock feed</div>
                <a
                  className="text-[13px] text-[color:var(--cyan-bright)] font-mono mt-2 block break-all hover:underline"
                  href={`/api/public/stock?dealer=${encodeURIComponent(currentDealerSlug || getDealerSlug())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/public/stock?dealer={currentDealerSlug || getDealerSlug()}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {activeStock.map(v => {
                const r = computeDmsGalleryReadiness(v as any);
                return (
                  <div key={v.id} className="card overflow-hidden flex flex-col">
                    <div className="aspect-[4/3] bg-[color:var(--ink-2)] relative">
                      {r.photoCount > 0 ? (
                        <img src={v.images![0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[rgba(232,234,230,0.45)] gap-2">
                          <Camera size={28} />
                          <span className="text-[13px] font-semibold tracking-normal">No gallery yet</span>
                        </div>
                      )}
                      <span
                        className="absolute top-2 left-2 text-[13px] font-semibold px-2 py-0.5 rounded border"
                        style={{ color: r.color, borderColor: r.color + "55", background: r.color + "22" }}
                        title={r.reasons.join(" -+ ")}
                      >
                        {r.label}
                      </span>
                      {r.photoCount > 0 && (
                        <span className="absolute top-2 right-2 text-[13px] font-semibold px-2 py-0.5 rounded bg-black/50 text-[color:var(--white)]">
                          {r.photoCount} photos
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{v.year} {v.make} {v.model}</div>
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

        {activeSection === "web_management" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8">
            <WebManagementGrid
              vehicles={state.vehicles}
              onUpdateVehicle={(id, updates) => handleUpdateVehicle(id, updates)}
              role={selectedRole}
            />
          </div>
        )}


        {/* SETTINGS MODULE */}
        {activeSection === "settings" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Settings</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                {PRODUCT_NAME} — stock, CRM, media hub, full finance & website embeds
              </p>
            </div>

            {/* Backup. Admin only, and the server enforces that independently.
                The mounted disk holds the only copy of every dealer's photos,
                and taking one previously meant the Render shell or a pasted
                console snippet — the endpoint cannot be reached by typing its
                URL, because auth is a bearer token from localStorage rather
                than a cookie, so a plain navigation arrives unauthenticated. */}
            {getAccount()?.role === "admin" && (
              <div className="card border-[color:var(--cyan-soft)]">
                <div className="card-header border-b border-white/5 px-5 py-3">
                  <h3 className="font-semibold text-[16px] text-[color:var(--white)] flex items-center gap-2">
                    <Download size={14} className="text-[color:var(--cyan-bright)]" /> Backup
                  </h3>
                </div>
                <div className="card-body p-5 flex flex-col gap-3">
                  <p className="text-[13px] text-[rgba(232,234,230,0.72)] max-w-2xl">
                    Downloads the entire DMS — every dealership, vehicle, photo, lead and
                    invoice — as a dated JSON file. The disk on the server holds the only
                    copy, so keep a recent one somewhere else.
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      disabled={backingUp}
                      onClick={async () => {
                        setBackingUp(true);
                        try {
                          const res = await authFetch("/api/admin/backup", { cache: "no-store" });
                          if (!res.ok) {
                            const msg = res.status === 403
                              ? "Only the master admin can download a backup."
                              : `Backup failed (${res.status}).`;
                            addNotification("Backup failed", msg, "warning");
                            return;
                          }
                          const blob = await res.blob();
                          /* Surface the size. A backup taken while signed in as a
                             dealership used to come back as that dealer's slice with
                             nothing to say it was partial, and a partial backup that
                             looks complete is worse than none. */
                          const mb = blob.size / 1024 / 1024;
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `truflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                          setLastBackupMb(mb);
                          addNotification(
                            "Backup downloaded",
                            `${mb.toFixed(1)} MB saved. Keep it somewhere off this server.`,
                            "info"
                          );
                        } catch (err: any) {
                          addNotification("Backup failed", err?.message || "Network error", "warning");
                        } finally {
                          setBackingUp(false);
                        }
                      }}
                      className="btn btn-primary"
                    >
                      <Download size={14} /> {backingUp ? "Preparing…" : "Download full backup"}
                    </button>
                    {/* The other half. Without it the backup above was a file
                        nobody could put back: this instance could be downloaded
                        and could be wiped, and restoring meant writing to the
                        mounted disk through the Render shell. */}
                    <label className="btn btn-secondary cursor-pointer">
                      <Upload size={14} /> {restoring ? "Restoring…" : "Restore from backup…"}
                      <input
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        disabled={restoring}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = ""; // let the same file be picked twice
                          if (!file) return;
                          setRestoring(true);
                          try {
                            const parsed = JSON.parse(await file.text());
                            const vehicles = Array.isArray(parsed?.vehicles) ? parsed.vehicles.length : null;
                            const dealers = Array.isArray(parsed?.dealerships) ? parsed.dealerships.length : null;
                            if (vehicles === null || dealers === null) {
                              addNotification("Not a TruFlow backup", "No vehicles/dealerships arrays in that file.", "warning");
                              return;
                            }
                            if (!confirm(
                              `Replace EVERYTHING on this instance with this file?\n\n` +
                              `${file.name}\n${dealers} dealerships, ${vehicles} vehicles\n\n` +
                              `The current state is snapshotted on the server first, but every ` +
                              `dealership on this instance is overwritten.`
                            )) return;
                            const res = await authFetch("/api/admin/restore", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ confirm: "RESTORE", state: parsed }),
                            });
                            const body = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              addNotification("Restore failed", body?.message || body?.error || `HTTP ${res.status}`, "warning");
                              return;
                            }
                            addNotification(
                              "Restored",
                              `${body.restored?.dealerships ?? 0} dealerships, ${body.restored?.vehicles ?? 0} vehicles. ` +
                              `Previous state kept as ${body.previousStateSavedAs || "—"}.`,
                              "info"
                            );
                            loadAllState();
                          } catch (err: any) {
                            addNotification("Restore failed", err?.message || "Could not read that file", "warning");
                          } finally {
                            setRestoring(false);
                          }
                        }}
                      />
                    </label>
                    {lastBackupMb !== null && (
                      <span className="text-[13px] font-mono text-[rgba(232,234,230,0.72)]">
                        last: {lastBackupMb.toFixed(1)} MB
                        {lastBackupMb < 1 && (
                          <b className="text-[color:var(--warning)] ml-2">
                            — suspiciously small, check you are master admin
                          </b>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Onboarding a dealership. Admin only — the server enforces it too,
                so this gate only avoids rendering a form that would 403. */}
            {getAccount()?.role === "admin" && (
              <Suspense fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
                <DealershipAdmin
                  onNotify={addNotification}
                  scopedDealershipId={adminDealerScope}
                  onDealerSaved={loadAllState}
                />
              </Suspense>
            )}

            {/* TruSocial — connect and auto-publish to social channels.
                For a dealer login, show their own panel. Master admin
                accesses this per-dealer via DealershipAdmin's "Social" tab
                instead of a stacked panel per dealer. */}
            {!isMasterAdmin && (() => {
              const socialDealers = dealershipId
                ? hasProduct("social") ? [currentDealership] : []
                : (state?.dealerships || []).filter((d: any) => (d.products || []).includes("social"));
              return socialDealers.map((d: any) => (
                <Suspense key={d.id} fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
                  <TruSocialSettings
                    dealershipId={d.id}
                    dealerName={dealershipId ? undefined : d.name}
                    truSocialEnabled={!!d.truSocialEnabled}
                    onNotify={addNotification}
                  />
                </Suspense>
              ));
            })()}

            {/* Dealer details — self-service editor for the identity fields
                quoted on invoices, agreements and public listings. Master
                admin edits these per-dealer inside DealershipAdmin's tabs,
                so this stack now only renders for dealer logins. Demo (no
                real dealer row in shared state) still gets a stub so the
                form is testable — Save 404s and the amber banner explains why. */}
            {!isMasterAdmin && state?.dealerships && (() => {
              const target = dealershipId
                ? state.dealerships.filter((d) => d.id === dealershipId)
                : state.dealerships;
              const synthesizedDemo =
                dealershipId && target.length === 0
                  ? [{
                      id: dealershipId,
                      name: sessionAccount?.label || "Demo Dealership",
                      location: "",
                    } as Dealership]
                  : [];
              const list = target.length > 0 ? target : synthesizedDemo;
              return (
                <>
                  {target.length === 0 && synthesizedDemo.length > 0 && (
                    <div className="text-[12px] text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md px-3 py-2">
                      Preview only — this account has no persisted dealership record, so Save will not work.
                      Sign in with a dealer code to persist changes.
                    </div>
                  )}
                  {list.map((d) => (
                    <React.Fragment key={d.id}>
                      <DealerDetailsSettings dealership={d} isAdmin={isMasterAdmin} onSaved={loadAllState} />
                      <DocSettingsPanel dealership={d} isAdmin={isMasterAdmin} onSaved={loadAllState} />
                      {/* Accounting integrations (Xero/QuickBooks/Zoho via Codat) —
                          feeds DocHub's 'connect' invoice mode. Same per-dealer loop
                          as the two panels above since it's part of the same document
                          settings surface, not gated behind a product flag. */}
                      <Suspense fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
                        <AccountingIntegrationsSettings
                          dealershipId={d.id}
                          dealerName={dealershipId ? undefined : d.name}
                          accountingEnabled={!!(d as any).accountingEnabled}
                          onNotify={addNotification}
                        />
                      </Suspense>
                    </React.Fragment>
                  ))}
                </>
              );
            })()}


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
      <ChatWidget open={assistOpen} onOpenChange={setAssistOpen} />
      <GuidePanel
        open={guideOpen}
        onOpenChange={handleGuideOpenChange}
        currentSection={activeSection}
        hasProduct={hasProduct}
        onAskAssist={() => setAssistOpen(true)}
      />

      {/* First-run setup checklist. Takes precedence over the guide tour — the
          first-run effect holds the tour back while this is about to fire. */}
      <SetupPrompt
        open={setupModalVisible}
        onOpenChange={(o) => {
          if (!o) setSetupOpen(false);
        }}
        status={setupStatus}
        onGoToSettings={() => navigateTo("settings")}
        dealershipId={dealershipId || undefined}
      />

      {/* The public-facing website chatbot simulation used to float bottom-left
          of the dealer's own workstation, which put two different assistants on
          one screen — one for the dealer, one pretending to be the customer's.
          It belongs on the dealer's website, not in the DMS. Component kept;
          only the render is removed. */}

      {/* --- FORM MODALS --- */}

      {/* Log Lead Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-4 md:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">Add lead</h3>
              <button onClick={() => setIsLeadModalOpen(false)} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateLeadSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">First Name</label>
                  <input type="text" required value={newLeadForm.firstName} onChange={(e) => setNewLeadForm((p) => ({ ...p, firstName: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Last Name</label>
                  <input type="text" required value={newLeadForm.lastName} onChange={(e) => setNewLeadForm((p) => ({ ...p, lastName: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Phone</label>
                  <input type="text" required value={newLeadForm.phone} onChange={(e) => setNewLeadForm((p) => ({ ...p, phone: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Email</label>
                  <input type="email" required value={newLeadForm.email} onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
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
                <textarea rows={2} value={newLeadForm.notes} onChange={(e) => setNewLeadForm((p) => ({ ...p, notes: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors font-sans"></textarea>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsLeadModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Commit Lead File</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-4 md:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">New task</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateTaskSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Task description header</label>
                <input type="text" required placeholder="e.g. Call client back with rates" value={newTaskForm.title} onChange={(e) => setNewTaskForm((p) => ({ ...p, title: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
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
                  <input type="date" required value={newTaskForm.dueDate} onChange={(e) => setNewTaskForm((p) => ({ ...p, dueDate: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors font-sans" />
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
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-4 md:p-6 flex flex-col gap-4">
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
                <div className="bg-[rgba(232,234,230,0.04)] border border-[rgba(232,234,230,0.14)] shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)] rounded-[12px] px-4 py-4 text-center">
                  <span className="text-[22px] font-semibold font-mono tracking-[0.2em] text-[color:var(--white)] select-all">{issuedCode.code}</span>
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
                <input type="text" required placeholder="Full name" value={newUserForm.name} onChange={(e) => setNewUserForm((p) => ({ ...p, name: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">E-mail Address</label>
                <input type="email" required placeholder="name@dealership.co.za" value={newUserForm.email} onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
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
                  <input type="text" required placeholder="082 111 2222" value={newUserForm.phone} onChange={(e) => setNewUserForm((p) => ({ ...p, phone: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
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

      {/* --- DETAIL MODALS ---
          Both of these are lazy(), so they must sit inside a Suspense boundary.
          Without one, clicking a lead or a vehicle threw on render and the
          error boundary swallowed it — the row simply did nothing. */}
      {leadDetailId && (
        <Suspense fallback={<div className="fixed inset-0 z-[400] grid place-items-center bg-black/60 text-[13px] text-[rgba(232,234,230,0.72)]">Opening…</div>}>
        <LeadDetailModal
          leadId={leadDetailId}
          vehicles={state.vehicles}
          users={state.users}
          allCommunications={state.communications}
          allTasks={state.tasks}
          dealership={state.dealerships.find(d => d.id === dealershipId) || state.dealerships[0]}
          clients={state.clients || []}
          onClose={() => { setLeadDetailId(null); setLeadInitialTab(undefined); }}
          onRefresh={loadAllState}
          initialTab={leadInitialTab}
          documentsPanel={
            <DocumentsHub
              embedded
              leadId={leadDetailId}
              /* DocHub-tracked documents (stage set) are excluded here — they have
                 their own tab with proper sign/finalize/skip flows that advance
                 lead.docStage and write the audit trail. Signing one through this
                 generic hub's plain signDocument() would mark it Signed without
                 ever calling finalizeStageDocument, leaving DocHub showing the
                 stage as still outstanding while the document claims otherwise. */
              documents={filteredDocuments.filter((d) => d.leadId === leadDetailId && !d.stage)}
              getLeadLabel={getLeadLabel}
              getVehicleLabel={getVehicleLabel}
              onUpload={handleUploadDocument}
              onSign={handleSignDocument}
              onDelete={handleDeleteDocument}
            />
          }
          docHubPanel={(() => {
            if (!isDesktop) return undefined;
            const leadForPanel = state.leads.find((l) => l.id === leadDetailId);
            if (!leadForPanel) return undefined;
            const dealerForPanel = state.dealerships.find(
              (d) => d.id === (leadForPanel.dealershipId || dealershipId),
            );
            return (
              <DocHubPanel
                lead={leadForPanel}
                dealership={dealerForPanel}
                onLeadRefresh={loadAllState}
              />
            );
          })()}
        />
        </Suspense>
      )}

      {selectedDetailVehicle && (
        <Suspense fallback={<div className="fixed inset-0 z-[400] grid place-items-center bg-black/60 text-[13px] text-[rgba(232,234,230,0.72)]">Opening…</div>}>
        <VehicleDetailModal
          vehicle={state.vehicles.find((v) => v.id === selectedDetailVehicle.id) || selectedDetailVehicle}
          isOpen={true}
          onClose={() => setSelectedDetailVehicle(null)}
          onUpdateVehicle={handleUpdateVehicle}
          onDeleteVehicle={handleDeleteVehicle}
          onReturnToStock={handleReturnToStock}
          settings={state.settings}
          dealershipId={dealershipId || selectedDetailVehicle?.dealershipId}
          hasLens={hasProduct("lens")}
          dealership={state.dealerships.find(d => d.id === dealershipId) || state.dealerships[0]}
          truSocialEnabled={(() => {
            // Publish tab shows only for a dealer that both carries the "social"
            // product and has TruSocial switched on — the publish targets are
            // OAuth connections, so anything less would only ever fail.
            const d: any = (state?.dealerships || []).find(
              (x: any) => x.id === (dealershipId || selectedDetailVehicle?.dealershipId)
            );
            return !!d?.truSocialEnabled && hasProduct("social");
          })()}
          documentsPanel={
            <DocumentsHub
              embedded
              vehicleId={selectedDetailVehicle.id}
              // Same DocHub exclusion as the lead-scoped instance above.
              documents={filteredDocuments.filter((d) => d.vehicleId === selectedDetailVehicle.id && !d.stage)}
              getLeadLabel={getLeadLabel}
              getVehicleLabel={getVehicleLabel}
              onUpload={handleUploadDocument}
              onSign={handleSignDocument}
              onDelete={handleDeleteDocument}
            />
          }
        />
        </Suspense>
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
            {(() => {
              const { sold, totalRevenue, totalProfit, reconTotal, marginPct } = eodTotals;
              return (<>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]  font-mono">Leads Worked</span>
                <span className="text-lg font-semibold text-[color:var(--white)]">{state.leads.length} Leads</span>
                <span className="text-[13px] text-[color:var(--cyan)]">Active response</span>
              </div>
              <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]  font-mono">Cars Moved</span>
                <span className="text-lg font-semibold text-[color:var(--white)]">{sold.length} Units</span>
                <span className="text-[13px] text-[color:var(--cyan)]">Closed Won status</span>
              </div>
              <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-[color:var(--cyan-bright)]  font-mono">Net Profit</span>
                <span className="text-lg font-semibold text-[color:var(--cyan)]">R {totalProfit.toLocaleString()}</span>
                <span className="text-[13px] text-[color:var(--cyan)]">{marginPct}% avg margin</span>
              </div>
            </div>

            <div className="bg-[color:var(--ink)] rounded-xl border border-white/5 p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center text-[13px] border-b border-white/3 pb-3">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Reconditioning Expenditures</span>
                <span className="font-mono font-semibold text-[color:var(--muted)]">- R {reconTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[13px] border-b border-white/3 pb-3">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Gross Dealership Revenue</span>
                <span className="font-mono font-semibold text-[color:var(--white)]">R {totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Unpaid invoices</span>
                <span className="font-mono font-semibold text-[color:var(--warning)]">R {state.invoices.filter(i => i.status === 'Sent').reduce((sum, i) => sum + i.amount, 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold tracking-normal text-[rgba(232,234,230,0.72)] font-mono px-1">Sold vehicles</span>
              <div className="flex flex-col gap-2">
                {sold.length === 0 && <span className="text-[13px] text-[rgba(232,234,230,0.72)] px-1">No sold vehicles on record.</span>}
                {sold.map(v => (
                  <div key={v.id} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-3 py-3 flex justify-between items-center text-[13px]">
                    <div>
                      <span className="font-semibold text-[color:var(--white)] block">{v.year} {v.make} {v.model} {v.trim}</span>
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block font-mono">Stock ID: {v.stockNumber}</span>
                    </div>
                    <span className="font-mono font-semibold text-[color:var(--cyan)]">R {((v.retailPrice || 0) - (v.costPrice || 0)).toLocaleString()} profit</span>
                  </div>
                ))}
              </div>
            </div>
              </>);
            })()}

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
                  addNotification("EOD Summary Dispatched", "The compiled daily operations summary has been emailed to stakeholders.", "info");
                  setShowEODReport(false);
                }} 
                className="px-4 py-2 bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] text-[color:var(--cyan-bright)] hover:bg-[color:var(--cyan-soft)] rounded-xl text-[13px] font-semibold cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 text-center"
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
