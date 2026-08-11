import logo from "./assets/images/PI-AppIcon.svg";
import React, { useState, useEffect, useMemo, lazy, Suspense } from "react";
import Assistant from "./components/Assistant";
import {
  Home,
  TrendingUp,
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
  Camera,
  Crosshair,
  Image,
  MessageCircle,
  Copy,
  FileText,
  MessageSquare,
  CalendarClock,
  Download,
  MoreHorizontal,
  Monitor,
} from "lucide-react";

import {
  fetchState,
  refreshFromServer,
  resetState,
  updateSettings,
  createProperty,
  updateProperty,
  setPropertyStatus,
  deleteProperty,
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
  deleteDocument
} from "./api";

import { Property, Enquiry, Task, Invoice, Agreement, User, Communication, Expense, DMSState, Agency, DocStage } from "./types";
import { DOC_STAGES } from "./types";

import Counter from "./components/Counter";
import ChatWidget from "./components/ChatWidget";
import DocumentsHub from "./components/DocumentsHub";
import AgencyDetailsSettings from "./components/AgencyDetailsSettings";
import DocSettingsPanel from "./components/DocSettingsPanel";
import PwaInstallBanner from "./components/PwaInstallBanner";
import InstallAppButton from "./components/InstallAppButton";

/* Split out of the initial bundle — none of these is needed to paint the
   dashboard, and together they were roughly a third of a 540KB single chunk
   that every agency downloaded before the login screen appeared. They load
   when the modal or section is first opened. */
const EnquiryDetailModal = lazy(() => import("./components/EnquiryDetailModal"));
const AccountingRecon = lazy(() => import("./components/AccountingRecon"));
const PropertyDetailModal = lazy(() => import("./components/PropertyDetailModal"));
const AgencyAdmin = lazy(() => import("./components/AgencyAdmin"));
const TruSocialSettings = lazy(() => import("./components/TruSocialSettings"));
/* DocHub — desktop-only, so the chunk (plus any future pdf-lib dep it
   pulls in) never reaches a phone. Gated on useIsDesktop() at the render site
   below, which is what actually keeps mobile from paying for it. */
const DocHubPanel = lazy(() => import("./components/dochub/DocHubPanel"));
const DocFlowSettings = lazy(() => import("./components/dochub/DocFlowSettings"));
import AmortizationCalc from "./components/AmortizationCalc";
import CustomerLeadForm from "./components/CustomerLeadForm";
import { CommissionEstimator } from "./components/CommissionEstimator";
import LoginSplash from "./components/LoginSplash";
import MobileDevice from "./components/MobileDevice";
import { hasValidSession, clearSession, getAccount, authFetch, SESSION_EXPIRED_EVENT } from "./lib/session";
import { useIsDesktop } from "./lib/useIsDesktop";
import { computeDmsGalleryReadiness } from "./lib/dmsReadiness";
import {
  PRODUCT_NAME,
  PRODUCT_TIER,
  getAgencySlug,
  openTruLens,
  openSupportWhatsApp,
} from "./lib/productConfig";
import {
  openListingWhatsApp,
  copyListingBlurb,
} from "./lib/salesShare";
import { initGlassMotion } from "./lib/glassMotion";
import { TRUFLOW_LITE_URL } from "./lib/ecosystem";

/** Which agency a newly-added property belongs to — loaded from the
 *  server so every onboarded agency appears automatically.
 *  The hardcoded DEALERSHIPS array was removed because it only listed MKR
 *  and Homes on Caledon, so every other agency got the wrong name and URL. */


/* ── Pipeline discipline ────────────────────────────────────────────────────
   A Enquiry is only "in the pipeline" if someone knows what happens next and
   when. These drive the board, the overdue filter and the day's worklist. */

const DAY_MS = 86400000;
const today = () => new Date().toISOString().slice(0, 10);
const daysBetween = (iso?: string | null) =>
  iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS) : null;

/** How long a Enquiry may sit in each stage before it needs chasing. A deal in
 *  Negotiating going quiet for a week is the expensive kind of forgotten. */
const STAGE_SLA_DAYS: Record<string, number> = {
  "New": 1,
  "Contacted": 3,
  "Viewing Scheduled": 2,
  "Negotiating": 3,
};

/** Overdue means the next step's date has passed, or nobody set one and the
 *  Enquiry has been sitting longer than its stage allows. Closed enquiries never are. */
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

/** Moving a Enquiry on should propose the next step, not leave a blank. */
const NEXT_STEP_ON_STAGE: Record<string, { action: string; inDays: number }> = {
  "New":                  { action: "First contact",       inDays: 0 },
  "Contacted":            { action: "Follow up",           inDays: 2 },
  "Viewing Scheduled": { action: "Confirm viewing",   inDays: 1 },
  "Negotiating":          { action: "Chase decision",       inDays: 2 },
};


/* ── Listing economics ────────────────────────────────────────────────────────
   Everything here already existed in the data and was never added up. A home's
   real cost is what you paid plus what you spent getting it saleable, and the
   number a principal actually wants is what's left after both. */

/** What has been spent reconditioning this home. */
function reconSpend(v: any): number {
  return (v.maintenanceTasks || []).reduce((sum: number, t: any) => sum + (Number(t.cost) || 0), 0);
}

/** Purchase price plus recon — the number a margin is honestly measured against. */
function costBasis(v: any): number {
  return (Number(v.costPrice) || 0) + reconSpend(v);
}

/** Gross margin. Projected while the home is in listing, realised once it's sold. */
function grossMargin(v: any): { rand: number; pct: number } {
  const retail = Number(v.askingPrice) || 0;
  const basis = costBasis(v);
  const rand = retail - basis;
  return { rand, pct: retail > 0 ? (rand / retail) * 100 : 0 };
}

/** Days a home has been in listing. Prefers the acquisition date over the stored
 *  counter, which is written once on create and then never moves. */
function marketAge(v: any): number {
  if (v.dateAcquired) {
    const d = Math.floor((Date.now() - new Date(v.dateAcquired).getTime()) / 86400000);
    if (!Number.isNaN(d) && d >= 0) return d;
  }
  return Number(v.daysOnMarket) || 0;
}

/** Bands match the colours already used on the property cards. */
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
 * The add-property form.
 *
 * category is the form's own type, not Property's: the select offers an "Auto —
 * decide from price & property type" choice whose value is "", and Property has no such
 * member. "" is translated to undefined at the API boundary rather than being
 * sent as an empty string the website would have to special-case.
 */
type NewPropertyForm = {
  yearBuilt: number;
  propertyType: Property["propertyType"];
  suburb: string;
  finish: string;
  bedrooms: number;
  bathrooms: number;
  garages: number;
  erfSize: string;
  askingPrice: number;
  costPrice: number;
  floorSize: string;
  listingRef: string;
  description: string;
  agencyId: string;
  category: NonNullable<Property["category"]> | "";
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
  const sessionAccount = getAccount();
  const isMasterAdmin = sessionAccount?.role === 'admin';
  const rawAgencyId = sessionAccount?.agencyId;
  const isDesktop = useIsDesktop();

  const [adminAgencyScope, setAdminAgencyScope] = useState<string | null>(null);
  const agencyId = (isMasterAdmin && adminAgencyScope) ? adminAgencyScope : rawAgencyId;

  /* Tenant scoping ----------------------------------------------------------
     The server already scopes /api/state to the signed-in tenant, so this is a
     second, narrower net — useful for an admin looking at everything, wrong as
     a hard filter.

     It used to filter on `agencyId` even when that was undefined, which
     happens whenever there is no user record for the tenant (the demo ships
     with none). Every list then matched nothing: the Leads header read
     "0 open" while the board beside it showed two, because the board built its
     own list straight off state.enquiries. Records with no agencyId are kept
     too — TruLens imports arrive without one. */
  const mine = (d?: string) => !d || d === agencyId;
  const showAll = (isMasterAdmin && !adminAgencyScope) || !agencyId;

  const filteredProperties = useMemo(
    () => (!state ? [] : showAll ? state.properties : state.properties.filter((v) => mine(v.agencyId))),
    [state, showAll, agencyId],
  );
  /** Listing the agency can still act on: tenant-scoped, minus archived units.
   *
   *  Anything that lists, counts or offers a home to work with should read this
   *  rather than `filteredProperties`. Archived units were originally excluded in
   *  one list only, so they went on leaking into the photo-readiness tiles, the
   *  new-enquiry dropdown and the aged-listing counts. `filteredProperties` is still
   *  the right source where sold history matters — Listing Health's realised
   *  margin has to keep counting them. */
  const activeListings = useMemo(() => filteredProperties.filter((v) => !v.archivedAt), [filteredProperties]);
  const filteredLeads = useMemo(
    () => (!state ? [] : showAll ? state.enquiries : state.enquiries.filter((l) => mine(l.agencyId))),
    [state, showAll, agencyId],
  );
  const filteredTasks = useMemo(
    () => (!state ? [] : showAll ? state.tasks : state.tasks.filter((t) => mine(t.agencyId))),
    [state, showAll, agencyId],
  );
  const filteredInvoices = useMemo(
    () => (!state ? [] : showAll ? state.invoices : state.invoices.filter((i) => mine(i.agencyId))),
    [state, showAll, agencyId],
  );
  const filteredAgreements = useMemo(
    () => (!state ? [] : showAll ? state.agreements : state.agreements.filter((a) => mine(a.agencyId))),
    [state, showAll, agencyId],
  );
  const filteredDocuments = useMemo(
    () => (!state ? [] : showAll ? (state.documents || []) : (state.documents || []).filter((d) => mine(d.agencyId))),
    [state, showAll, agencyId],
  );
  const filteredCommunications = useMemo(
    () => (!state ? [] : showAll ? state.communications : state.communications.filter((c) => mine(c.agencyId))),
    [state, showAll, agencyId],
  );
  const filteredExpenses = useMemo(
    () => (!state ? [] : showAll ? state.expenses : state.expenses.filter((e) => mine(e.agencyId))),
    [state, showAll, agencyId],
  );
  const [selectedDetailProperty, setSelectedDetailProperty] = useState<Property | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leadDetailId, setLeadDetailId] = useState<string | null>(null);
  const [leadInitialTab, setLeadInitialTab] = useState<"overview" | "dochub" | undefined>(undefined);

  // The mobile drawer had no way out except picking a nav item: no scrim, no
  // Escape, and the page kept scrolling underneath it (2 800px of dashboard
  // sliding about behind a menu that looked modal). Escape closes it, and the
  // body is pinned while it is open so the drawer is the only thing that moves.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    // Preserve whatever overflow the body already had rather than assuming
    // it was the default — a modal opened over the drawer sets it too.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);
  // The view follows the logged-in account. This was a "simulated role
  // selector" pill that let anyone flip to Agency Owner regardless of their
  // real login — a permissions hole now that seats are live. principal/admin
  // see the owner view; managers and salespeople see their own.
  const account = sessionAccount;
  const accountRole: 'salesperson' | 'manager' | 'owner' =
    account?.role === 'admin' || account?.role === 'principal' ? 'owner'
    : account?.role === 'manager' ? 'manager' : 'salesperson';
  const selectedRole = accountRole;
  const [showEODReport, setShowEODReport] = useState(false);
  const [docFlowSettingsOpen, setDocFlowSettingsOpen] = useState(false);

  // Filters & Searches
  const [listingSearch, setInventorySearch] = useState("");
  const [listingStatusFilter, setInventoryStatusFilter] = useState("ALL");
  const [listingPhotoFilter, setInventoryPhotoFilter] = useState<"ALL" | "NEEDS" | "PARTIAL" | "READY">("ALL");
  const [listingAgeFilter, setInventoryAgeFilter] = useState<"ALL" | "30" | "60" | "90">("ALL");
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
                new Notification("PropInspect: Task Due Soon", {
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
        "Could not assign enquiries",
        err?.message || "Something went wrong sharing the enquiries out.",
        "warning"
      );
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Form Fields State
  const [newLeadForm, setNewLeadForm] = useState({ firstName: "", lastName: "", phone: "", email: "", propertyId: "", source: "Website", notes: "" });
  const [newInvoiceForm, setNewInvoiceForm] = useState({ leadId: "", propertyId: "", amount: 0, paymentMethod: "Bank Transfer", status: "Sent" as any, dueDate: new Date().toISOString().slice(0, 10) });
  const [newAgreementForm, setNewAgreementForm] = useState({ leadId: "", propertyId: "", purchasePrice: 0, depositAmount: 0, type: "Property Sale" as any, status: "Pending Signature" as any });
  const [newTaskForm, setNewTaskForm] = useState({ title: "", leadId: "", propertyId: "", assignedUserId: "", dueDate: new Date().toISOString().slice(0, 10), priority: "Normal" as any, status: "Pending" as any });
  const [newUserForm, setNewUserForm] = useState({ name: "", email: "", role: "salesperson" as any, phone: "" });
  // Staff logins ("seats") — the principal manages these, and activeSeats is
  // what the agency is billed on.
  const [seats, setSeats] = useState<Seat[]>([]);
  const [activeSeats, setActiveSeats] = useState(0);
  const [seatError, setSeatError] = useState("");
  /** A freshly issued code, shown once. Never fetched back from the server. */
  const [issuedCode, setIssuedCode] = useState<{ name: string; code: string } | null>(null);
  const [newPropertyForm, setNewPropertyForm] = useState<NewPropertyForm>({ yearBuilt: new Date().getFullYear(), propertyType: "House", suburb: "", finish: "", bedrooms: 0, bathrooms: 0, garages: 0, erfSize: "", askingPrice: 0, costPrice: 0, floorSize: "", listingRef: "", description: "", agencyId: getAccount()?.agencyId || "", category: "" });

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
        // 15s poll — every Enquiry's name, phone, email and notes, every invoice —
        // which put it in reach of anyone who opened DevTools on a yard machine.
        setState(data);
        if (data.properties.length > 0) {
          setNewLeadForm((prev) => ({ ...prev, propertyId: data.properties[0].id }));
          setNewInvoiceForm((prev) => ({ ...prev, propertyId: data.properties[0].id, amount: data.properties[0].askingPrice }));
          setNewAgreementForm((prev) => ({ ...prev, propertyId: data.properties[0].id, purchasePrice: data.properties[0].askingPrice }));
          setNewTaskForm((prev) => ({ ...prev, propertyId: data.properties[0].id }));
        }
        if (data.enquiries.length > 0) {
          setNewInvoiceForm((prev) => ({ ...prev, leadId: data.enquiries[0].id }));
          setNewAgreementForm((prev) => ({ ...prev, leadId: data.enquiries[0].id }));
          setNewTaskForm((prev) => ({ ...prev, leadId: data.enquiries[0].id }));
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

  // Derived metrics
  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  const activeListingsCount = useMemo(
    () => (state ? state.properties.filter((v) => v.status !== "SOLD" && !v.archivedAt).length : 0),
    [state],
  );
  const unresolvedLeadsCount = useMemo(
    () => (state ? state.enquiries.filter((l) => l.status !== "Closed Won" && l.status !== "Closed Lost").length : 0),
    [state],
  );
  /**
   * Listing that cannot sell yet, because it isn't online.
   *
   * This replaced a "Website analytics" card of hardcoded numbers (51 visits,
   * 94% bounce) that were never wired to anything. A home in listing with no
   * photos is dead capital — it is paying floorplan and cannot be shopped —
   * and nothing in the app put that number in front of the agency daily.
   * Listing health already owns the money view; this owns the "why isn't it
   * moving" view, and every figure comes from the same readiness helper the
   * Listing media page scores each property with.
   */
  const notOnline = useMemo(() => {
    const inListings = activeListings.filter((v) => v.status !== "SOLD");
    const graded = inListings.map((v) => ({ v, r: computeDmsGalleryReadiness(v as any) }));
    const noPhotos = graded.filter((g) => g.r.level === "capture");
    const incomplete = graded.filter((g) => g.r.level === "partial");
    const blocked = [...noPhotos, ...incomplete];
    // Worst offender by age, because "4 homes need photos" is a chore whereas
    // "one has been sitting 34 days" is a decision.
    const oldest = blocked.reduce<(typeof blocked)[number] | null>(
      (worst, g) => (!worst || (g.v.daysOnMarket || 0) > (worst.v.daysOnMarket || 0) ? g : worst),
      null,
    );
    return {
      inListings: inListings.length,
      blocked: blocked.length,
      noPhotos: noPhotos.length,
      incomplete: incomplete.length,
      ready: graded.filter((g) => g.r.webReady).length,
      oldest,
    };
  }, [activeListings]);

  const soldUnitsCount = useMemo(
    () => (state ? state.properties.filter((v) => v.status === "SOLD").length : 0),
    [state],
  );
  const totalRevenue = useMemo(
    () => (state ? state.invoices.filter((i) => i.status === "Paid").reduce((sum, i) => sum + i.amount, 0) : 0),
    [state],
  );

  /* Leads waiting on a first reply ------------------------------------------
     The number that actually decides whether a Enquiry converts is how long it
     sat before anyone answered it — pipeline value can't be acted on at 9am,
     but "3 people are waiting, one since yesterday" can. A Enquiry counts as
     waiting when it is still open and has never been contacted. */
  const openLeads = useMemo(
    () => (state ? state.enquiries.filter((l) => l.status !== "Closed Won" && l.status !== "Closed Lost") : []),
    [state],
  );
  const awaitingReply = useMemo(() => openLeads.filter((l) => !l.lastContactedAt), [openLeads]);
  const negotiatingCount = useMemo(() => openLeads.filter((l) => l.status === "Negotiating").length, [openLeads]);
  const oldestWaitMs = useMemo(() => {
    return awaitingReply.reduce((worst, l) => {
      const waited = Date.now() - new Date(l.createdAt).getTime();
      return Number.isFinite(waited) && waited > worst ? waited : worst;
    }, 0);
  }, [awaitingReply]);
  /** "4h" / "2d" / "18m" — the shape a agency reads at a glance. */
  const formatWait = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${Math.max(mins, 1)}m`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
  };
  // Anything unanswered for more than an hour is the one thing on this screen
  // allowed to draw the eye. Under an hour the agency is on top of it.
  const replyIsLate = useMemo(() => oldestWaitMs > 60 * 60 * 1000, [oldestWaitMs]);

  /** Whose floor this is. Matches the signed-in agency first, then
   *  falls back so the banner never renders a bare "· live". */
  const currentAgency = useMemo(
    () => (state?.agencies || []).find((d: any) => d.id === agencyId),
    [state, agencyId],
  );
  const agencyLabel = useMemo(
    () => currentAgency?.name
      || account?.label || "Your agency",
    [currentAgency, account],
  );
  // The embed snippet was reading from a localStorage default that ships as
  // "mkr-autosales", so every agency's Settings page showed MKR. Prefer the
  // signed-in agency's slug; fall through to the stored value only for the
  // master admin, who has no agency of their own.
  const currentAgencySlug = useMemo(
    () => currentAgency?.slug || (isMasterAdmin ? undefined : agencyId),
    [currentAgency, isMasterAdmin, agencyId],
  );
  const agencyProducts: string[] = useMemo(
    () => (currentAgency as any)?.products || [],
    [currentAgency],
  );
  const hasProduct = (p: string) => isMasterAdmin && !adminAgencyScope ? true : agencyProducts.includes(p);
  const todayLabel = new Date().toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  /* Card subtexts should answer "compared to what?" — "Ready for viewing" and
     "Cleared this cycle" are decoration. Aged listing and unpaid invoices are
     the two numbers a agency principal actually chases. */
  const AGED_DAYS = 60;
  /* Uses marketAge(), the same helper Listing Health measures with. This counted
     `daysOnMarket` directly — a value written once on create and never
     updated — while Listing Health preferred `dateAcquired`, so the Overview tile
     and the Listing Health tile reported different aged-listing counts for the same
     floor, at the same threshold. */
  const agedListingsCount = useMemo(
    () => (state ? state.properties.filter(
      (v) => v.status !== "SOLD" && !v.archivedAt && marketAge(v) > AGED_DAYS
    ).length : 0),
    [state],
  );
  /* The headline money figure is deal value less what was spent making the home
     ready — sale price minus recon, summed over sold units. It replaces the old
     invoice-derived "Banked" number, which assumed the DMS raised the invoice;
     agencies invoice from their own systems, so that number was never real. */
  /* End-of-day totals, computed once. The CSV export and the on-screen report
     each derived these four lines independently and identically, so changing
     one would have silently disagreed with the other. */
  const eodTotals = useMemo(() => {
    if (!state) return { sold: [], totalRevenue: 0, totalProfit: 0, reconTotal: 0, marginPct: "0.0" };
    const sold = state.properties.filter((v) => v.status === "SOLD");
    const totalRevenue = sold.reduce((s, v) => s + (v.askingPrice || 0), 0);
    const totalProfit = sold.reduce(
      (s, v) => s + ((v.askingPrice || 0) - (v.costPrice || 0)),
      0,
    );
    const reconTotal = state.properties
      .flatMap((v: any) => v.maintenanceTasks || [])
      .reduce((s: number, t: any) => s + (t.cost || 0), 0);
    const marginPct = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : "0.0";
    return { sold, totalRevenue, totalProfit, reconTotal, marginPct };
  }, [state]);

  const soldProperties = useMemo(
    () => (state ? state.properties.filter((v) => v.status === "SOLD") : []),
    [state],
  );
  const grossAfterRecon = useMemo(
    () => soldProperties.reduce((sum, v) => sum + ((v.askingPrice || 0) - reconSpend(v)), 0),
    [soldProperties],
  );
  const outstandingRevenue = useMemo(
    () => (state ? state.invoices
      .filter((i) => i.status !== "Paid")
      .reduce((sum, i) => sum + i.amount, 0) : 0),
    [state],
  );

  /* The morning strip -------------------------------------------------------
     What a agency needs to know before the doors open, in the order it costs
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
  // Anything promised for today — an open task, or a Enquiry's next action.
  const dueTodayCount = useMemo(
    () => state
      ? state.tasks.filter((t) => t.status !== "Completed" && isToday(t.dueDate)).length +
        openLeads.filter((l) => isToday(l.nextActionAt)).length
      : 0,
    [state, openLeads],
  );
  // Overdue is worse than due: it was promised and the day has passed.
  const overdueCount = useMemo(
    () => state
      ? state.tasks.filter(
        (t) => t.status !== "Completed" && t.dueDate && new Date(t.dueDate) < startOfToday
      ).length +
        openLeads.filter(
          (l) => l.nextActionAt && new Date(l.nextActionAt) < startOfToday
        ).length
      : 0,
    [state, openLeads],
  );
  /* The "Going out" tile and its top-bar chip are gone. It counted properties in
     PENDING — a status nothing had written since the listing kanban was removed —
     so it read zero forever. Rebuilding it on `Closed Won && !docFlowCompletedAt`
     was worse: no historical deal carries that stamp, so it counted every deal
     ever closed. Neither number was true, and Deal Readiness already answers
     "what is still outstanding" properly. */

  /* Nav "needs attention" signals — one shared rule per destination, so the
     bottom bar and the sidebar read from the same source. Each value is a
     genuine to-do count: enquiries waiting on a first reply, overdue tasks/actions,
     and listing that can't sell yet because it has no photos / an incomplete
     listing. Rendered as a dot on mobile (a number on a tab is noise) and as a
     count on desktop, and only when the value is > 0. */
  const navAttention: Record<string, number> = useMemo(
    () => ({
      enquiries: awaitingReply.length,
      tasks: overdueCount,
      portfolio: notOnline.blocked,
    }),
    [awaitingReply, overdueCount, notOnline],
  );

  if (!isLoggedIn) {
    return (
      // setIsLoggedIn inline, not handleLogin — this early return runs before
      // handleLogin is initialised further down the component body.
      <MobileDevice>
        <LoginSplash onLogin={() => setIsLoggedIn(true)} />
      </MobileDevice>
    );
  }

  if (loadError) {
    return (
      <MobileDevice>
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
      </MobileDevice>
    );
  }

  if (!state) {
    return (
      <MobileDevice>
        <div className="min-h-screen bg-[color:var(--ink)] flex flex-col items-center justify-center p-6 text-[color:var(--white)] font-sans gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-t-[color:var(--cyan)] border-[color:var(--cyan-faint)] animate-spin" />
          <div className="font-semibold text-[16px] tracking-wide">Starting PropInspect…</div>
          <div className="text-[13px] text-[rgba(232,234,230,0.72)] text-center max-w-xs">
            Loading portfolio data from <span className="font-mono text-[color:var(--cyan)]">localhost:3001</span>.
            If this hangs, restart the server (`npm run dev` in propinspect).
          </div>
          <button
          type="button"
          onClick={loadAllState}
          className="mt-2 px-4 py-2 rounded-lg bg-[color:var(--cyan)] on-fill text-[13px] font-semibold"
        >
          Retry load
        </button>
      </div>
      </MobileDevice>
    );
  }

  // Grouped menu sections for elegant layout
  const groupedNavigation = [
    {
      category: "Showroom Floor",
      items: [
        { id: "dashboard", label: "Overview", icon: Home },
        { id: "portfolio", label: "All Properties", icon: Home },
        { id: "upload", label: "Add property", icon: Upload },
      ]
    },
    {
      category: "Operations & CRM",
      items: [
        { id: "enquiries", label: "Enquiry CRM", icon: Users },
        { id: "tasks", label: "Tasks", icon: CheckSquare },
        { id: "listing_health", label: "Listing health", icon: TrendingUp },
        { id: "accounting_recon", label: "Finance & Recon", icon: Receipt },
      ]
    },
    {
      /* Built, backed by real server routes, and previously unreachable — no nav
         entry pointed at any of them. Invoices and agreements each have full
         GET/POST/PUT routes behind them (including pay and sign); the repayment
         calculator is self-contained arithmetic seeded from real listing. */
      category: "Deals & Finance",
      items: [
        { id: "deal_readiness", label: "Deal Readiness", icon: ClipboardCheck },
        { id: "payment", label: "Repayment calculator", icon: Calculator },
      ]
    },
    {
      category: "Media & Web",
      items: [
        { id: "media_web", label: "Listing media", icon: Image },
      ]
    },
    {
      category: "Agency Settings",
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
        ['dashboard', 'portfolio', 'upload', 'enquiries', 'tasks', 'accounting_recon', 'media_web',
         'deal_readiness', 'payment'].includes(item.id)
      );
    } else if (selectedRole === 'manager') {
      items = items.filter(item =>
        ['dashboard', 'portfolio', 'upload', 'enquiries', 'tasks', 'accounting_recon', 'manager', 'settings',
         'deal_readiness', 'payment'].includes(item.id)
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

  const handleUpdateProperty = async (id: string, updates: Partial<Property>) => {
    await updateProperty(id, updates);
    loadAllState();
  };

  /** Cancellation: a closed sale fell through. Put the home back in listing — which
   *  re-lists it on the website, since the public feed only publishes INVENTORY
   *  — and reopen the deals that closed on it, so the two never drift apart.
   *
   *  The reopen is the server's job now: this used to look up one Closed Won
   *  Enquiry here and force it to Negotiating, which both missed any second deal
   *  on the home and invented a stage the deal may never have been at. */
  const handleReturnToListing = async (v: Property) => {
    const label = propertyLabel(v);
    if (!confirm(`Return ${label} to the market?\n\nThis re-lists it on your website and reopens the linked deal.`)) return;
    try {
      const { coupledLeads } = await setPropertyStatus(v.id, "INVENTORY");
      loadAllState();
      addNotification(
        "Returned to market",
        `${label} is back on the market and live on your website again` +
          (coupledLeads.length
            ? `, and ${coupledLeads.length === 1 ? "its deal was" : `${coupledLeads.length} deals were`} reopened.`
            : "."),
        "info",
      );
    } catch (err: any) {
      addNotification("Could not return to market", err?.message || "Something went wrong.", "warning");
    }
  };

  /** Mark a home sold, resolving which deal closed on it when that is ambiguous.
   *
   *  A home can carry several open deals, and only the agency knows which
   *  customer actually bought it — so ask, rather than guess. A home with no
   *  open deals is sold outside the system entirely (cash off the floor,
   *  invoiced elsewhere), which must stay a single click: no prompt at all. */
  const handleMarkSold = async (v: Property) => {
    const label = propertyLabel(v);
    const openLeads = state.enquiries.filter(
      (l) => l.propertyId === v.id && l.status !== "Closed Won" && l.status !== "Closed Lost",
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
      if (choice === null) return; // cancelled — do not touch the home
      const n = parseInt(choice, 10);
      if (n >= 1 && n <= openLeads.length) {
        closeLeadId = openLeads[n - 1].id;
      } else if (n !== 0) {
        /* Anything that is neither a listed deal nor the explicit "0 — sold
           outside the system" is a typo, not an instruction. Selling the home
           anyway would leave the buyer's deal sitting open with the agency
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
      const { coupledLeads } = await setPropertyStatus(v.id, "SOLD", closeLeadId);
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

  /** Remove a unit from listing.
   *  Deleting a home that a deal, invoice or Enquiry points at leaves those records
   *  referencing something that no longer exists — the Enquiry's property shows as
   *  blank and the invoice loses what it was for. So say what is attached
   *  before asking, and archive rather than delete once the sale is recorded
   *  here: that is a record of a transaction, not listing to tidy away.
   *
   *  A home sold outside the DMS has no record here to protect, so it deletes
   *  cleanly. Refusing those outright — as this used to, pointing at an
   *  "archive" that did not exist — left them stuck on the floor forever. */
  const handleDeleteProperty = async (id: string) => {
    const v = state.properties.find((x) => x.id === id);
    if (!v) return;
    const label = `${propertyLabel(v)} (${v.listingRef})`;

    /* Already archived: the sale here is what stopped it being deleted in the
       first place, so running this again would only re-archive it. Say where
       the way back is instead of silently doing nothing useful. */
    if (v.archivedAt) {
      addNotification(
        "Already archived",
        `${label} is archived and still counted in your sold figures. Filter listings by "Archived" to restore it.`,
        "info",
      );
      return;
    }

    /* Is the sale actually recorded here? A closed deal, an invoice, an
       agreement or a signed document all mean deleting would destroy the record
       of a transaction — those get archived instead. A home sold outside the DMS
       has none of them, so deleting it destroys nothing and simply removes it.

       An open or lost enquiry is not a record of a sale: those are unlinked by
       the server rather than blocking removal. The same rule is enforced
       server-side, since Light never runs this code. */
    const closedDeals = state.enquiries.filter((l) => l.propertyId === id && l.status === "Closed Won");
    const linkedInvoices = state.invoices.filter((i) => i.propertyId === id);
    const linkedAgreements = state.agreements.filter((a) => a.propertyId === id);
    const signedDocs = state.documents.filter((d) => d.propertyId === id && d.status === "Signed");
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
            `active listings but stays in your sold figures.`,
        )
      )
        return;
      try {
        /* Status goes with it: archiving retires a unit whose sale is recorded,
           so leaving it INVENTORY kept it counting as live listing and publishing
           to the agency's website. The server enforces the same pairing, so a
           Light or raw-API archive cannot get this wrong either. */
        await updateProperty(id, { archivedAt: new Date().toISOString(), status: "SOLD" });
        setSelectedDetailProperty(null);
        loadAllState();
        addNotification("Archived", `${label} is off the floor and still counted in sold figures.`, "info");
      } catch (err: any) {
        addNotification("Could not archive property", err?.message || "Something went wrong.", "warning");
      }
      return;
    }

    const openEnquiries = state.enquiries.filter(
      (l) => l.propertyId === id && l.status !== "Closed Won",
    ).length;
    const warning = openEnquiries
      ? `\n\n${openEnquiries} enquir${openEnquiries === 1 ? "y" : "ies"} will be kept but unlinked from this home.`
      : "";
    if (!confirm(`Remove ${label} from the market?${warning}\n\nThis cannot be undone.`)) return;

    try {
      await deleteProperty(id);
      setSelectedDetailProperty(null);
      loadAllState();
      addNotification("Removed from listing", `${label} is no longer on the floor.`, "info");
    } catch (err: any) {
      addNotification("Could not remove property", err?.message || "Something went wrong.", "warning");
    }
  };

  /* Tasks accumulate — completed and stale ones clutter the list with no way to
     clear them. A direct per-row delete keeps it tidy. Guarded by a confirm
     because it removes the task for the whole agency and isn't reversible,
     matching the listing-removal flow. */
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

  const handleUploadDocument = async (doc: { fileName: string; mimeType: string; fileData: string; leadId?: string; propertyId?: string }) => {
    await uploadDocument({ ...doc, agencyId });
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
  const propertyLabel = (v: any) =>
    v?.address || `${v?.propertyType || "Property"} · ${v?.suburb || ""}`;

  const getPropertyLabel = (id: string) => {
    const v = state.properties.find((item) => item.id === id);
    return v ? propertyLabel(v) : "Generic Query Asset";
  };

  const getUserLabel = (id: string) => {
    const u = state.users.find((item) => item.id === id);
    return u ? u.name : "Unassigned Pool";
  };

  const getLeadLabel = (id: string) => {
    const l = state.enquiries.find((item) => item.id === id);
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
  /** Log that this Enquiry was actioned and schedule the next step.
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
    // Typed confirmation, not an OK button. This deletes every agency's
    // listing, enquiries, invoices and signed documents, permanently.
    const typed = prompt(
      "This permanently deletes ALL data for EVERY agency on this instance — " +
      "listing, enquiries, invoices and signed documents. There is no backup.\n\n" +
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

  /** Sign out → access-code splash. Does not wipe portfolio.
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

  // Submit functions
  const handleCreateLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLead({
      ...newLeadForm,
    });
    setIsLeadModalOpen(false);
    setNewLeadForm({ firstName: "", lastName: "", phone: "", email: "", propertyId: state.properties[0]?.id || "", source: "Website", notes: "" });
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
        propertyId: "", // unassigned initial
        source: "Website AI Bot",
        notes: "Captured via Live Receptionist AI bot."
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
    setNewTaskForm({ title: "", leadId: state.enquiries[0]?.id || "", propertyId: state.properties[0]?.id || "", assignedUserId: "u1", dueDate: new Date().toISOString().slice(0, 10), priority: "Normal", status: "Pending" });
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

  const handlePublishProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    // Metadata only — gallery comes from TruLens Export to DMS
    const { category, ...propertyFields } = newPropertyForm;
    await createProperty({
      ...propertyFields,
      // "" is the form's "Auto" choice, not a category. Sending it would put an
      // empty string on the record and leave the website matching against a
      // tier that doesn't exist; omitting the key lets it fall back to guessing
      // from price and property type, which is what "Auto" promises.
      ...(category ? { category } : {}),
      images: [] as string[],
      damagePhotos: [] as string[],
      vinPhotos: [] as string[],
      serviceBookPhotos: [] as string[],
      extrasPhotos: [] as string[],
    });
    const listing = newPropertyForm.listingRef;
    addNotification(
      "Property on the market",
      `${newPropertyForm.propertyType} · ${newPropertyForm.suburb} (${listing}) — open TruLens to shoot, then Export to DMS`,
      "info"
    );
    setActiveSection("portfolio");
    setNewPropertyForm({
      yearBuilt: new Date().getFullYear(),
      propertyType: "House",
      suburb: "",
      finish: "",
      bedrooms: 0,
      bathrooms: 0,
      garages: 0,
      erfSize: "",
      askingPrice: 0,
      costPrice: 0,
      floorSize: "",
      listingRef: "",
      description: "",
      agencyId: agencyId || "",
      category: "",
    });
    loadAllState();
    if (hasProduct("lens") && confirm("Listing created. Open TruLens now to shoot this unit?")) {
      openTruLens(listing);
    }
  };

  const handleExportCSV = () => {
    const { sold, totalRevenue, totalProfit, reconTotal } = eodTotals;
    const rows: (string | number)[][] = [
      ["PropInspect - End of Day Operations Summary"],
      ["Date", new Date().toISOString().split('T')[0]],
      [],
      ["Key Performance Indicators", "Value"],
      ["Leads Engaged / Worked", `${state.enquiries.length} Leads`],
      ["Properties Moved (Sold)", `${sold.length} Units`],
      ["Total Prep & Maintenance Outlay", `R ${reconTotal.toLocaleString()}`],
      ["Gross Sales Revenue", `R ${totalRevenue.toLocaleString()}`],
      ["Total Profit Realized", `R ${totalProfit.toLocaleString()}`],
      [],
      ["Finalized Sales Transactions"],
      ["Listing Ref", "Property", "Sale Amount", "Calculated Gross Margin"],
      ...sold.map(v => [v.listingRef || "", propertyLabel(v), `R ${(v.askingPrice || 0).toLocaleString()}`, `R ${((v.askingPrice || 0) - (v.costPrice || 0)).toLocaleString()}`]),
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PropInspect_EOD_Summary_${new Date().toISOString().split('T')[0]}.csv`);
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
    <MobileDevice>
    {!isLoggedIn ? (
      <LoginSplash onLogin={handleLogin} />
    ) : (<>
      <div className="min-h-full flex-1 bg-[color:var(--ink)] text-[color:var(--white)] relative select-none perspective-scene">
        {/* Scroll indicator */}
        <div className="scroll-progress transition-transform" />

      {/* Grid Pattern overlays */}
      <div className="bg-grid" />

      {/* Scrim. The drawer is a fixed panel over the page, so without something
          behind it the dashboard stayed lit, tappable and scrolling — and the
          only way to dismiss the menu was to navigate somewhere. Tapping off it
          is the gesture everyone tries first. md:hidden because from 768px the
          sidebar is permanent and has nothing to dismiss. */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[170] bg-black/60 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile More sheet. Three fixed buckets instead of the sidebar's five
          nav categories: what a salesperson can do standing next to a home, what
          only works on a desktop (shown greyed and inert, not hidden, so the
          product reads the same on both), and account. Role filtering carries
          over — a bucket only shows the items the current role can reach. */}
      {(() => {
        const byId = new Map(
          filteredNavigation.flatMap((g) => g.items).map((i) => [i.id, i] as const)
        );
        const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter(Boolean) as { id: string; label: string; icon: typeof Home }[];
        const floorItems = pick(["upload", "media_web", "listing_health", "payment"]);
        const desktopItems = pick(["deal_readiness", "accounting_recon"]);
        const accountItems = pick(["manager", "settings"]);
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-hidden={!sidebarOpen}
            /* Clear the fixed bottom tab bar (≈74px + safe-area, z-190) that
               renders on top of this sheet — otherwise the last item in the
               scroll area, Log out, sits behind it and can't be tapped. */
            style={{ paddingBottom: "calc(88px + var(--safe-b))" }}
            className={`md:hidden fixed left-0 right-0 bottom-0 max-h-[80vh] z-[180] rounded-t-3xl bg-[color:var(--ink-2)] border-t border-[color:var(--glass-line)] shadow-[0_-18px_40px_-12px_rgba(0,0,0,0.6)] transition-transform duration-300 ${
              sidebarOpen ? "translate-y-0" : "translate-y-full"
            } flex flex-col`}
          >
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <span className="block h-1 w-10 rounded-full bg-[color:var(--glass-line)]" aria-hidden="true" />
            </div>
            <div className="flex items-center gap-3 px-5 pb-2 shrink-0">
              <img src={logo} alt="PropInspect" className="h-9 w-auto max-w-[130px] object-contain shrink-0" />
              <span className="text-[length:var(--t-Enquiry)] font-semibold text-[color:var(--white)] flex-1">More</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
                className="h-9 w-9 grid place-items-center rounded-lg text-[color:var(--white-dim)] hover:bg-white/5 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-4">
              {/* On the floor */}
              {floorItems.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[length:var(--t-micro)] text-[color:var(--muted)] tracking-wide font-semibold px-1">
                    On the floor
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {floorItems.map((n) => {
                      const Icon = n.icon;
                      const active = activeSection === n.id;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => navigateTo(n.id)}
                          className={`flex items-center gap-2 px-3 py-3 min-h-11 text-[13px] font-semibold rounded-xl text-left border cursor-pointer ${
                            active
                              ? "bg-[color:var(--cyan-faint)] text-[color:var(--white)] border-[color:var(--cyan-soft)]"
                              : "bg-[color:var(--glass)] text-[color:var(--white-dim)] border-[color:var(--glass-line)]"
                          }`}
                        >
                          <Icon size={15} className={active ? "text-[color:var(--cyan)]" : "text-[color:var(--blue)]"} />
                          <span className="truncate">{n.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Needs a desktop — visible but greyed and inert. Tapping does
                  nothing on purpose: the one line under the group explains why,
                  and a toast that only ever says "not here" is noise. */}
              {desktopItems.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[length:var(--t-micro)] text-[color:var(--muted)] tracking-wide font-semibold px-1 flex items-center gap-1.5">
                    Needs a desktop
                    <Monitor size={13} className="text-[color:var(--faint)]" />
                  </span>
                  <div className="grid grid-cols-2 gap-2 opacity-[0.35] select-none pointer-events-none">
                    {desktopItems.map((n) => {
                      const Icon = n.icon;
                      return (
                        <div
                          key={n.id}
                          aria-disabled="true"
                          className="flex items-center gap-2 px-3 py-3 min-h-11 text-[13px] font-semibold rounded-xl text-left border bg-[color:var(--glass)] text-[color:var(--white-dim)] border-[color:var(--glass-line)]"
                        >
                          <Icon size={15} className="text-[color:var(--muted)]" />
                          <span className="truncate">{n.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-[12px] text-[color:var(--faint)] px-1">
                    Sign in on a computer to work these.
                  </span>
                </div>
              )}

              {/* Account */}
              {accountItems.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[length:var(--t-micro)] text-[color:var(--muted)] tracking-wide font-semibold px-1">
                    Account
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {accountItems.map((n) => {
                      const Icon = n.icon;
                      const active = activeSection === n.id;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => navigateTo(n.id)}
                          className={`flex items-center gap-2 px-3 py-3 min-h-11 text-[13px] font-semibold rounded-xl text-left border cursor-pointer ${
                            active
                              ? "bg-[color:var(--cyan-faint)] text-[color:var(--white)] border-[color:var(--cyan-soft)]"
                              : "bg-[color:var(--glass)] text-[color:var(--white-dim)] border-[color:var(--glass-line)]"
                          }`}
                        >
                          <Icon size={15} className={active ? "text-[color:var(--cyan)]" : "text-[color:var(--blue)]"} />
                          <span className="truncate">{n.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Support is the wide target; Log out shrinks to an icon square. */}
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openSupportWhatsApp(
                      `PropInspect ${PRODUCT_TIER} support · ${agencyLabel}\nSection: ${activeSection}\n\n`
                    )
                  }
                  className="flex-1 min-h-[48px] flex items-center justify-center gap-2 px-3 rounded-xl text-[13px] font-semibold text-[color:var(--white)] bg-[rgba(37,211,102,0.10)] border border-[rgba(37,211,102,0.28)] cursor-pointer"
                >
                  <MessageCircle size={16} className="text-[#25D366]" />
                  Support
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Log out"
                  title="Log out"
                  className="h-[56px] w-[56px] shrink-0 grid place-items-center rounded-xl text-[color:var(--white-dim)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] cursor-pointer"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Sidebar - Desktop only. Below md the drawer becomes a bottom sheet
          rendered separately below, so a phone never carries an off-canvas
          navigation model. */}
      <aside
        style={{
          paddingTop: "calc(1.25rem + var(--safe-t))",
          paddingBottom: "calc(1.25rem + var(--safe-b))",
          paddingLeft: "calc(1.25rem + var(--safe-l))",
        }}
        className="glass-sidebar hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] pr-5 flex-col z-[180]"
      >
        <div className="mb-6 flex flex-col items-center">
          <div className="w-full flex items-center justify-center px-1">
            <img src={logo} alt="PropInspect" className="h-12 w-auto max-w-full object-contain logo-float" />
          </div>
          {/* Admin agency context switcher — pick a agency to see their world. */}
          {isMasterAdmin && state?.agencies && state.agencies.length > 0 && (
            <div className="mt-2 w-full px-1">
              <select
                value={adminAgencyScope || ""}
                onChange={(e) => setAdminAgencyScope(e.target.value || null)}
                className="w-full bg-[color:var(--ink-2)] border border-white/15 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] cursor-pointer"
              >
                <option value="">All agencies</option>
                {state.agencies.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          {/* The agency's OWN showroom. This was hardcoded to true-homes.co.za,
              so every agency's sidebar linked to our consumer site instead
              of to their website. */}
          {(() => {
            const mine = agencyId
              ? (state?.agencies || []).find((d: any) => d.id === agencyId)
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
                    <a href={TRUFLOW_LITE_URL} target="_blank" rel="noopener noreferrer"
                       className="text-[13px] px-3 py-1 rounded-full bg-[rgba(0,136,255,0.08)] text-[#38BDF8] border border-[rgba(0,136,255,0.2)] hover:bg-[rgba(0,136,255,0.12)] transition-colors">
                      PropInspect
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
                        className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[11px] font-semibold grid place-items-center leading-none tabular-nums"
                      >
                        {navAttention[n.id] > 99 ? "99+" : navAttention[n.id]}
                      </span>
                    ) : (n.id === "deal_readiness" || n.id === "accounting_recon") ? (
                      /* Desktop-only surface. A hint, not a disable — it exists so
                         the sidebar and the phone's More sheet describe the same
                         product. Dropped when a count badge takes the ml-auto slot. */
                      <Monitor size={13} className="ml-auto text-[color:var(--faint)]" aria-label="Desktop only" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Support + sign out. WhatsApp green is the only non-brand colour used
            here — it is the platform's own mark, and already appears on Enquiry
            cards in LeadDetailModal. The deep-link pre-fills who is asking and
            where they were, so support opens with context. */}
        <div className="pt-2.5 mt-1.5 border-t border-white/10 shrink-0 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() =>
              openSupportWhatsApp(
                `PropInspect ${PRODUCT_TIER} support · ${agencyLabel}\nSection: ${activeSection}\n\n`
              )
            }
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold text-[color:var(--white)] bg-[rgba(37,211,102,0.10)] border border-[rgba(37,211,102,0.28)] hover:bg-[rgba(37,211,102,0.16)] transition-colors cursor-pointer"
            title="Message TruSaaS support on WhatsApp"
          >
            <MessageCircle size={15} className="text-[#25D366] shrink-0" />
            Support
            <span className="ml-auto text-[12px] font-normal text-[color:var(--muted)]">WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-[13px] font-semibold tracking-normal text-[color:var(--white-dim)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] hover:bg-[color:var(--glass)] hover:text-[color:var(--white-dim)] transition-all cursor-pointer"
            title="Sign out of PropInspect"
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
        <div className="hidden md:flex justify-between items-center gap-4 sticky top-3 z-[60] rounded-xl px-4 py-2.5 bg-[color:var(--ink-2)]/92 backdrop-blur-md border border-[color:var(--glass-line)] shadow-[0_1px_0_rgba(232,234,230,0.06)_inset,0_18px_40px_-28px_rgba(0,0,0,0.8)]">
           {/* Morning strip — the floor at a glance, on every screen. Only the
               unanswered-Enquiry figure is allowed to go red; if everything shouts,
               nothing does. */}
           <div className="flex items-center gap-2 flex-wrap">
             <button
               type="button"
               onClick={() => navigateTo("enquiries")}
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

           </div>

           <div className="flex items-center gap-2 shrink-0">
             <button
               type="button"
               onClick={() => setAssistOpen(true)}
               className="flex items-center gap-2 h-9 px-3 rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)] hover:text-[color:var(--ink)] transition-colors cursor-pointer text-[13px] font-semibold"
               title="Ask Agency Assist"
             >
               <Sparkles size={14} />
               Agency Assist
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

        {/* Mobile Header — the section a agency is on, plus one number worth
            reading, plus Assist. Navigation itself moved to the bottom tab bar
            and the More sheet; the hamburger, logo and counter strip are gone.
            top offset clears the notch on an installed PWA. */}
        {(() => {
          const navMatch = groupedNavigation
            .flatMap((g) => g.items)
            .find((n) => n.id === activeSection);
          const metaMap: Record<string, { title: string; sub: string }> = {
            dashboard: {
              title: "Today",
              sub: `${agencyLabel} · ${todayLabel}`,
            },
            enquiries: {
              title: "Leads",
              sub: `${awaitingReply.length} waiting · ${negotiatingCount} negotiating`,
            },
            portfolio: {
              title: "Listings",
              sub: `${state.properties.length} properties`,
            },
            tasks: {
              title: "Tasks",
              sub: `${dueTodayCount} due today${overdueCount > 0 ? ` · ${overdueCount} late` : ""}`,
            },
          };
          const meta = metaMap[activeSection] || {
            title: navMatch?.label || "PropInspect",
            sub: agencyLabel,
          };
          return (
            <div
              style={{ top: "calc(0.5rem + var(--safe-t))" }}
              className="flex items-center gap-3 md:hidden sticky z-[60] rounded-xl px-3 py-2 bg-[color:var(--ink-2)]/92 backdrop-blur-md border border-[color:var(--glass-line)] shadow-[0_1px_0_rgba(232,234,230,0.06)_inset,0_18px_40px_-28px_rgba(0,0,0,0.8)]"
            >
              <img src="/favicon.svg" alt="PropInspect" className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[length:var(--t-Enquiry)] font-semibold text-[color:var(--white)] leading-tight truncate">
                  {meta.title}
                </span>
                <span className="text-[length:var(--t-micro)] text-[color:var(--muted)] truncate">
                  {meta.sub}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAssistOpen(true)}
                aria-label="Ask Agency Assist"
                title="Ask Agency Assist"
                className="h-11 w-11 shrink-0 grid place-items-center rounded-full bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] cursor-pointer"
              >
                <Sparkles size={16} />
              </button>
            </div>
          );
        })()}

        {/* OVERVIEW SECTION */}
        {activeSection === "dashboard" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
            {/* Framed header. The plain heading read like a page title on a
                form; a agency opening this at 8am should see whose floor it is,
                that it is live, and have the assistant one click away. */}
            {/* Framed header — desktop only. On a phone the sticky mobile header
                already names the agency and date, so this card is redundant
                there (hidden md:flex). The date folds into the live pill; the
                page-title heading and the strapline prose are gone. */}
            <div className="card py-5 px-6 hidden md:flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[length:var(--t-micro)] bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--cyan)] animate-pulse" />
                    {agencyLabel} · live · {new Date().toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                </div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">
                  Agency overview
                </h1>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigateTo("upload")} className="btn btn-primary">
                  New listing
                </button>
              </div>
            </div>

            {/* Stats — mobile. Re-cut for a salesperson on the floor: the one
                number that is actionable the moment the app opens enquiries
                full-width with a chevron into enquiries; the rest fold down into a
                pair and a strip. The 5-tile desktop grid is below (hidden md). */}
            <div className="md:hidden flex flex-col gap-3">
              <button
                onClick={() => navigateTo("enquiries")}
                className="stat-card p-4 flex items-center justify-between gap-3 text-left cursor-pointer border-[color:var(--cyan-soft)]"
              >
                <div className="min-w-0">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Needs a reply</div>
                  <div className={`text-[38px] leading-none font-semibold tracking-[-0.022em] mt-1 ${replyIsLate ? "text-[color:var(--white)]" : "text-[color:var(--muted)]"}`}>
                    <Counter value={awaitingReply.length} />
                  </div>
                  <div className={`text-[13px] font-normal mt-1 ${replyIsLate ? "text-[color:var(--white-dim)]" : "text-[color:var(--muted)]"}`}>
                    {awaitingReply.length === 0
                      ? `All ${unresolvedLeadsCount} open enquiries answered`
                      : `Oldest waiting ${formatWait(oldestWaitMs)} · ${unresolvedLeadsCount} open`}
                  </div>
                </div>
                <ChevronRight size={20} className="text-[color:var(--muted)] shrink-0" />
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigateTo("tasks")} className="stat-card p-4 text-left cursor-pointer border-[color:var(--glass-line)]">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Due today</div>
                  <div className="text-[28px] leading-none font-semibold tracking-[-0.015em] text-[color:var(--white)] mt-1"><Counter value={dueTodayCount} /></div>
                  <div className="text-[13px] font-normal mt-1 text-[rgba(232,234,230,0.55)]">
                    {overdueCount > 0 ? `${overdueCount} already late` : "Nothing overdue"}
                  </div>
                </button>
                <button onClick={() => navigateTo("portfolio")} className="stat-card p-4 text-left cursor-pointer border-[color:var(--glass-line)]">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Homes on market</div>
                  <div className="text-[28px] leading-none font-semibold tracking-[-0.015em] text-[color:var(--white)] mt-1"><Counter value={activeListingsCount} /></div>
                  <div className="text-[13px] font-normal mt-1 text-[rgba(232,234,230,0.55)]">
                    {agedListingsCount > 0 ? `${agedListingsCount} over ${AGED_DAYS} days` : `None over ${AGED_DAYS} days`}
                  </div>
                </button>
              </div>
              <div className="stat-card flex items-center justify-between px-4 py-3.5 border-[color:var(--glass-line)]">
                <div>
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Units sold</div>
                  <div className="text-[20px] leading-none font-semibold text-[color:var(--white)] mt-1"><Counter value={soldUnitsCount} /></div>
                </div>
                <span className="w-px h-8 bg-[color:var(--glass-line)] shrink-0" />
                <div className="text-right">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Gross after prep</div>
                  <div className="text-[20px] leading-none font-semibold text-[color:var(--cyan-bright)] mt-1"><Counter value={grossAfterRecon} prefix="R " /></div>
                </div>
              </div>
            </div>

            {/* Stats — desktop grid. Only the unanswered-Enquiry card carries the
                cyan hairline; the other four sit on var(--glass-line). */}
            <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => navigateTo("enquiries")}
                className="stat-card p-4 text-left cursor-pointer border-[color:var(--cyan-soft)] transition-colors"
              >
                <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Needs a reply</div>
                <div
                  className={`text-[length:var(--t-h2)] font-semibold tracking-[-0.015em] mt-1 ${
                    replyIsLate ? "text-[color:var(--white)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  <Counter value={awaitingReply.length} />
                </div>
                <div
                  className={`text-[13px] font-normal mt-1 ${
                    replyIsLate ? "text-[color:var(--white-dim)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {awaitingReply.length === 0
                    ? `All ${unresolvedLeadsCount} open enquiries answered`
                    : `Oldest waiting ${formatWait(oldestWaitMs)} · ${unresolvedLeadsCount} open`}
                </div>
              </button>
              <button
                onClick={() => navigateTo("tasks")}
                className="stat-card p-4 text-left cursor-pointer border-[color:var(--glass-line)] transition-colors"
              >
                <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Due today</div>
                <div className="text-[length:var(--t-h2)] font-semibold tracking-[-0.015em] text-[color:var(--white)] mt-1"><Counter value={dueTodayCount} /></div>
                <div className="text-[13px] font-normal mt-1 text-[rgba(232,234,230,0.55)]">
                  {overdueCount > 0
                    ? `${overdueCount} already late`
                    : "Nothing overdue"}
                </div>
              </button>
              <button
                onClick={() => navigateTo("portfolio")}
                className="stat-card p-4 text-left cursor-pointer border-[color:var(--glass-line)] transition-colors"
              >
                <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Homes in listing</div>
                <div className="text-[length:var(--t-h2)] font-semibold tracking-[-0.015em] text-[color:var(--white)] mt-1"><Counter value={activeListingsCount} /></div>
                <div className="text-[13px] font-normal mt-1 text-[rgba(232,234,230,0.55)]">
                  {agedListingsCount > 0
                    ? `${agedListingsCount} over ${AGED_DAYS} days`
                    : `None over ${AGED_DAYS} days`}
                </div>
              </button>
              <div className="stat-card p-4 border-[color:var(--glass-line)]">
                <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Units sold</div>
                <div className="text-[length:var(--t-h2)] font-semibold tracking-[-0.015em] text-[color:var(--white)] mt-1"><Counter value={soldUnitsCount} /></div>
                <div className="text-[13px] text-[rgba(232,234,230,0.55)] font-semibold mt-1">
                  {activeListingsCount + soldUnitsCount > 0
                    ? `${Math.round((soldUnitsCount / (activeListingsCount + soldUnitsCount)) * 100)}% of the floor moved`
                    : "No listings loaded yet"}
                </div>
              </div>
              <div className="stat-card p-4 border-[color:var(--glass-line)]">
                <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Gross after recon</div>
                <div className="text-[length:var(--t-h2)] font-semibold tracking-[-0.015em] text-[color:var(--cyan-bright)] mt-1"><Counter value={grossAfterRecon} prefix="R " /></div>
                <div className="text-[13px] font-normal mt-1 text-[rgba(232,234,230,0.55)]">
                  {soldProperties.length > 0
                    ? `${soldProperties.length} sold · deal value less prep`
                    : "No homes sold yet"}
                </div>
              </div>
            </div>

            {/* End of day summary — a manager's desk job, so desktop only
                (hidden on mobile) and reduced to a single convenience row: not
                the loudest control on the page, so the cyan fill and cyan
                primary button are dropped for a neutral surface + secondary. */}
            {(selectedRole === 'manager' || selectedRole === 'owner') && (
              <div className="card hidden md:flex items-center justify-between gap-4 px-5 py-3.5 bg-[color:var(--ink-2)] border border-[color:var(--glass-line)] rounded-[var(--r-card)]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TrendingUp size={16} className="text-[color:var(--cyan)] shrink-0" />
                  <span className="text-[15px] font-semibold text-[color:var(--white)]">End of day summary</span>
                  <span className="text-[13px] text-[color:var(--muted)]">last 24 hours</span>
                </div>
                <button
                  onClick={() => setShowEODReport(true)}
                  className="tru-btn-secondary inline-flex items-center gap-2 px-3 min-h-[32px] rounded-[8px] text-[13px] font-semibold cursor-pointer shrink-0"
                >
                  <Sparkles size={14} />
                  Compile
                </button>
              </div>
            )}

            {/* Listing that can't sell yet — see the notOnline note above. */}
            <div className="card p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">
                  Not online yet
                </div>
                <button
                  type="button"
                  onClick={() => navigateTo("media_web")}
                  className="btn btn-secondary btn-sm shrink-0"
                >
                  Listing media
                </button>
              </div>

              {notOnline.blocked === 0 ? (
                /* An all-clear is worth stating plainly — a card that vanishes
                   when there is nothing wrong just reads as broken. */
                <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
                  {notOnline.inListings > 0 ? (
                    <>
                      All <span className="text-[color:var(--cyan)] font-semibold">{notOnline.inListings}</span>{" "}
                      {notOnline.inListings === 1 ? "home" : "homes"} on the market {notOnline.inListings === 1 ? "has" : "have"} a
                      web-ready gallery.
                    </>
                  ) : (
                    "No homes listed yet."
                  )}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
                    <span className="text-[38px] leading-none font-semibold tracking-[-0.022em] text-[color:var(--white)]">
                      {notOnline.blocked}
                    </span>
                    <span className="text-[13px] text-[rgba(232,234,230,0.72)]">
                      of {notOnline.inListings} on the market can&apos;t be sold yet
                    </span>
                  </div>

                  {/* One inline row, not two stacked cards — the counts read
                      left-to-right with hairline dividers, and the web-ready
                      figure moves in here (it no longer trails the sentence). */}
                  <div className="flex items-center gap-5 mb-3 bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-[10px] px-3.5 py-2.5 flex-wrap">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[18px] font-semibold text-[color:var(--white)]">{notOnline.noPhotos}</span>
                      <span className="text-[13px] text-[color:var(--white-dim)]">no photos</span>
                    </div>
                    <span className="w-px h-[18px] bg-[color:var(--glass-line)]" />
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[18px] font-semibold text-[color:var(--white)]">{notOnline.incomplete}</span>
                      <span className="text-[13px] text-[color:var(--white-dim)]">gallery short</span>
                    </div>
                    <span className="w-px h-[18px] bg-[color:var(--glass-line)]" />
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[18px] font-semibold text-[color:var(--cyan-bright)]">{notOnline.ready}</span>
                      <span className="text-[13px] text-[color:var(--white-dim)]">web-ready</span>
                    </div>
                  </div>

                  {notOnline.oldest && (
                    <p className="text-[13px] text-[color:var(--muted)]">
                      Longest waiting:{" "}
                      <span className="text-[color:var(--white-dim)]">
                        {propertyLabel(notOnline.oldest.v)}
                      </span>
                      {typeof notOnline.oldest.v.daysOnMarket === "number" && (
                        <> — {notOnline.oldest.v.daysOnMarket} days on market</>
                      )}
                    </p>
                  )}
                </>
              )}

              {/* Shooting listing is the one desk-adjacent task that belongs on the
                  floor, so this card keeps its primary action on the phone.
                  Mobile only — TruLens captures with the phone camera, so a
                  "shoot" button on a desktop would point at a dead end. Desktop
                  keeps the "Listing media" link in the header instead. */}
              {hasProduct("lens") && (
                <button
                  type="button"
                  onClick={() => openTruLens()}
                  className="btn btn-primary mt-4 w-full md:hidden inline-flex items-center justify-center gap-2"
                >
                  <Camera size={15} />
                  Shoot in TruLens
                </button>
              )}
            </div>

            {/* Featured Catalog list */}
            <div className="card">
              <div className="card-header flex justify-between items-center border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Recent Showroom Portfolio</h3>
                <button
                  onClick={() => navigateTo("portfolio")}
                  className="btn btn-secondary btn-sm"
                >
                  View Database
                </button>
              </div>
              <div className="card-body p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {state.properties.filter((v) => v.status === "INVENTORY").slice(0, 4).map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedDetailProperty(v)}
                    className="v-card p-3 cursor-pointer group hover:-translate-y-0.5 transition-transform duration-200"
                  >
                    <div className="aspect-[4/3] rounded-lg bg-[color:var(--ink-2)] flex items-center justify-center overflow-hidden mb-3 shadow-md shadow-black/40">
                      {v.images && v.images.length > 0 ? (
                        <img src={v.images[0]} alt={`${v.propertyType}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-[color:var(--ink-2)] border border-white/5 flex items-center justify-center text-[rgba(232,234,230,0.45)] font-semibold text-lg">
                          {(v.propertyType || "Pr").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h4 className="font-semibold text-[13px] text-[color:var(--white)] truncate">{v.propertyType} · {v.suburb}</h4>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] truncate mt-0.5">{v.bedrooms} bed · {v.bathrooms} bath · {v.erfSize || "—"} erf</p>
                    <div className="text-[16px] font-semibold text-[color:var(--cyan-bright)] mt-2">{formatZAR(v.askingPrice)}</div>
                    <div className="text-[13px] text-[rgba(232,234,230,0.72)] mt-2 font-mono">Listing Ref: {v.listingRef}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Leads list */}
            <div className="card">
              <div className="card-header flex justify-between items-center border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-[16px]">Leads</h3>
                <button
                  onClick={() => navigateTo("enquiries")}
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
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Home</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Channel</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Stage</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Agent</th>
                      <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.enquiries.slice(0, 5).map((l) => (
                      <tr key={l.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                        <td className="py-3 px-4 font-semibold text-[color:var(--white)]">
                          {l.firstName} {l.lastName}
                          <span className="block text-[13px] font-normal text-[rgba(232,234,230,0.72)] mt-0.5">{l.phone}</span>
                        </td>
                        <td data-label="Model" className="py-3 px-4 font-semibold">{getPropertyLabel(l.propertyId)}</td>
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
          </div>
        )}

        {/* ALL PROPERTIES SECTION */}
        {activeSection === "portfolio" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Listings</h1>
                <p className="text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)] mt-0.5">
                  Manage your live portfolio and pricing
                  {state.properties.some((v: any) => (v.images?.length || 0) > 0) && (
                    <span className="text-[color:var(--cyan)] ml-2">
                      · {state.properties.filter((v: any) => (v.images?.length || 0) > 0).length} with TruLens photos
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
                        addNotification("DMS refreshed", "Loaded latest properties & TruLens photos from server", "info");
                      })
                      .catch((err) => alert(err.message || "Refresh failed"));
                  }}
                  className="btn btn-secondary text-[13px] font-semibold px-3 py-2 flex items-center gap-2"
                  title="Reload portfolio from server (shows photos exported from TruLens)"
                >
                  <RefreshCw size={12} /> Refresh photos
                </button>
                <div className="relative flex-1 md:flex-none">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,234,230,0.72)]" />
                  <input
                    type="text"
                    value={listingSearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search suburb, type, listing ref..."
                    className="w-full md:w-56 bg-[color:var(--glass)] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-[13px] md:text-[15px] text-[color:var(--white)] placeholder-[rgba(232,234,230,0.45)] outline-none focus:border-[color:var(--cyan)]"
                  />
                </div>
                <Segmented
                  value={listingStatusFilter}
                  onChange={setInventoryStatusFilter}
                  options={[
                    { value: "ALL", label: "All" },
                    { value: "INVENTORY", label: "On market" },
                    { value: "SOLD", label: "Sold" },
                    { value: "ARCHIVED", label: "Archived" },
                  ]}
                />
                <Segmented
                  value={listingPhotoFilter}
                  onChange={setInventoryPhotoFilter}
                  options={[
                    { value: "ALL", label: "All photos" },
                    { value: "NEEDS", label: "Needs shoot" },
                    { value: "PARTIAL", label: "Partial" },
                    { value: "READY", label: "Web-ready" },
                  ]}
                />
                <Segmented
                  value={listingAgeFilter}
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
              {state.properties
                .filter((v) => {
                  /* Archived units are off the floor: retired sold listing kept
                     only so the sale still counts in the money figures. Hidden
                     from every other view, but reachable through their own
                     filter — archiving must not be a one-way door. */
                  if (listingStatusFilter === "ARCHIVED") {
                    if (!v.archivedAt) return false;
                  } else if (v.archivedAt) {
                    return false;
                  }
                  const mSearch =
                    (v.suburb || "").toLowerCase().includes(listingSearch.toLowerCase()) ||
                    (v.propertyType || "").toLowerCase().includes(listingSearch.toLowerCase()) ||
                    (v.address || "").toLowerCase().includes(listingSearch.toLowerCase()) ||
                    (v.listingRef || "").toLowerCase().includes(listingSearch.toLowerCase());
                  const mStatus =
                    listingStatusFilter === "ALL" ||
                    listingStatusFilter === "ARCHIVED" ||
                    v.status === listingStatusFilter;
                  const r = computeDmsGalleryReadiness(v as any);
                  const mPhoto =
                    listingPhotoFilter === "ALL" ||
                    (listingPhotoFilter === "NEEDS" && r.level === "capture") ||
                    (listingPhotoFilter === "PARTIAL" && r.level === "partial") ||
                    (listingPhotoFilter === "READY" && r.webReady);
                  const days = Number(v.daysOnMarket) || 0;
                  const mAge = listingAgeFilter === "ALL" || days >= Number(listingAgeFilter);
                  return mSearch && mStatus && mPhoto && mAge;
                })
                .map((v) => {
                  const readiness = computeDmsGalleryReadiness(v as any);
                  const days = Number(v.daysOnMarket) || 0;
                  const ageTone =
                    days >= 90 ? "text-[color:var(--muted)]" : days >= 60 ? "text-[color:var(--warning)]" : days >= 30 ? "text-[color:var(--cyan-bright)]" : "text-[color:var(--white)]";
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedDetailProperty(v)}
                      className="v-card flex flex-col h-full group hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                    >
                      {/* Card Image area */}
                      <div className="aspect-[16/10] bg-[color:var(--ink-2)] flex items-center justify-center relative border-b border-white/5 overflow-hidden select-none">
                        {v.images && v.images.length > 0 ? (
                          <img src={v.images[0]} alt={`${v.propertyType}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-14 h-14 bg-[color:var(--cyan)] rounded-xl flex items-center justify-center text-[color:var(--ink)] font-semibold text-xl shadow-lg">
                            {(v.propertyType || "Pr").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[13px] font-semibold font-mono tracking-wider  ${
                          v.archivedAt ? "bg-[color:var(--glass)] text-[color:var(--muted)]" : v.status === "INVENTORY" ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)]" : "bg-[color:var(--glass)] text-[color:var(--muted)]"
                        }`}>
                          {v.archivedAt ? "Archived" : v.status === "INVENTORY" ? "Showroom Floor" : "Transferred"}
                        </span>
                        <span
                          className="absolute top-3 left-3 px-2 py-0.5 rounded text-[13px] font-semibold border max-w-[70%] truncate"
                          style={{ color: readiness.color, borderColor: readiness.color + "55", background: readiness.color + "22" }}
                          title={(readiness.reasons || []).join(" · ")}
                        >
                          {readiness.label}
                        </span>
                      </div>

                      {/* Info Area */}
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <h4 className="font-semibold text-[16px] text-[color:var(--white)] truncate">{v.propertyType} · {v.suburb}</h4>
                          <p className="text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)] mt-0.5">
                            {v.yearBuilt || "—"} · <span className="font-mono">{v.listingRef}</span>
                            {v.category === "select" && <span className="ml-2 px-1.5 py-0.5 rounded text-[length:var(--t-micro)] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">Select</span>}
                            {v.category === "performance" && <span className="ml-2 px-1.5 py-0.5 rounded text-[length:var(--t-micro)] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">Performance</span>}
                          </p>
                          <div className="text-[13px] md:text-[15px] text-[rgba(232,234,230,0.72)] flex flex-wrap gap-x-2 gap-y-1 mt-2">
                            <span>{v.bedrooms || 0} bed</span>
                            <span>•</span>
                            <span>{v.bathrooms || 0} bath</span>
                            <span>•</span>
                            <span>{v.erfSize || "—"} erf</span>
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
                            <div className="text-base font-semibold text-[color:var(--cyan-bright)] font-mono mt-0.5">{formatZAR(Number(v.askingPrice) || 0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[13px] text-[rgba(232,234,230,0.72)]  font-mono tracking-wider">Days on market</div>
                            <div className={`text-[13px] font-semibold mt-0.5 ${ageTone}`}>{days} Days{days >= 60 ? " · age" : ""}</div>
                          </div>
                        </div>

                        {/* Web + sold at a glance — Light-style, one tap each.
                            Kept out of the modal so a agency can publish or mark
                            sold from the list without clicking through. */}
                        <div
                          className="flex items-center justify-between gap-2 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label
                            className="flex items-center gap-2 text-[13px] text-[rgba(232,234,230,0.72)] cursor-pointer select-none"
                            title={v.showOnWebsite !== false ? "On website — tap to unpublish" : "Publish this property to the agency website"}
                          >
                            <span
                              className={
                                "relative inline-flex h-[20px] w-[36px] items-center rounded-full transition-colors " +
                                (v.showOnWebsite !== false ? "bg-[color:var(--cyan)]" : "bg-white/15")
                              }
                            >
                              <span
                                className={
                                  "inline-block h-[16px] w-[16px] rounded-full bg-white transition-transform " +
                                  (v.showOnWebsite !== false ? "translate-x-[18px]" : "translate-x-[2px]")
                                }
                              />
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={v.showOnWebsite !== false}
                              onChange={() =>
                                handleUpdateProperty(v.id, { showOnWebsite: v.showOnWebsite === false } as Partial<Property>)
                              }
                            />
                            <span>Web</span>
                          </label>
                          {/* Both go through the coupling helpers, not a bare
                              status write. "Unsell" used to flip the home and
                              leave its deal sitting at Closed Won — the same
                              action as "Return to listing" in the detail modal,
                              but only that one reopened the deal. */}
                          {v.archivedAt ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await updateProperty(v.id, { archivedAt: null });
                                  loadAllState();
                                  addNotification("Restored", `${propertyLabel(v)} is back on the floor.`, "info");
                                } catch (err: any) {
                                  addNotification("Could not restore property", err?.message || "Something went wrong.", "warning");
                                }
                              }}
                              title="Bring this unit back onto the floor"
                              className="px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-white/5 text-[rgba(232,234,230,0.72)] border border-white/10 hover:text-[color:var(--white)]"
                            >
                              Restore
                            </button>
                          ) : v.status !== "SOLD" ? (
                            <button
                              type="button"
                              onClick={() => handleMarkSold(v)}
                              title="Mark this home sold — closes its deal and unpublishes from the website"
                              className="px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-white/5 text-[rgba(232,234,230,0.72)] border border-white/10 hover:text-[color:var(--white)]"
                            >
                              Mark sold
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReturnToListing(v)}
                              title="Return this home to the market and reopen its deal"
                              className="px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-white/5 text-[rgba(232,234,230,0.72)] border border-white/10 hover:text-[color:var(--white)]"
                            >
                              Relist
                            </button>
                          )}
                        </div>

                        {/* Actions — stopPropagation so card click still opens detail */}
                        <div
                          className="flex gap-2 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {hasProduct("lens") && (
                            <button
                              type="button"
                              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[13px] font-semibold tracking-normal bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)]"
                              onClick={() => openTruLens(v.listingRef)}
                              title="Guided shoot in TruLens"
                            >
                              <Camera size={11} /> Shoot
                            </button>
                          )}
                          <button
                            type="button"
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[13px] font-semibold tracking-normal bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/25"
                            onClick={() => openListingWhatsApp(v as any)}
                            title="WhatsApp listing blurb"
                          >
                            <MessageCircle size={11} /> WhatsApp
                          </button>
                          <button
                            type="button"
                            className="px-2 py-2 rounded-lg text-[13px] font-semibold bg-white/5 text-[rgba(232,234,230,0.72)] border border-white/10 hover:text-[color:var(--white)]"
                            onClick={async () => {
                              try {
                                await copyListingBlurb(v as any);
                                addNotification("Copied", `Share text for ${v.listingRef}`, "info");
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

        {/* UPLOAD PROPERTY SECTION */}
        {activeSection === "upload" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Add property</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">
                  Create listing metadata here.{hasProduct("lens") && <> <b className="text-[color:var(--white)]">Photos only in TruLens</b> (guided shoot → Export to DMS).</>}
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
                <form onSubmit={handlePublishProperty} className="flex flex-col gap-4">
                  {/* Portfolio tier — which category page this home lands on */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Portfolio Category</label>
                    <select
                      value={newPropertyForm.category}
                      onChange={(e) => setNewPropertyForm((p) => ({ ...p, category: e.target.value as NewPropertyForm["category"] }))}
                      className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                    >
                      <option value="">Auto — decide from price &amp; property type</option>
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="luxury">Luxury</option>
                      <option value="used">Established Resale</option>
                    </select>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Leave on Auto and the website guesses from price and property type. Pick a tier to override that guess.</p>
                  </div>

                  {/* Specification grid panel */}
                  <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] rounded-xl p-4 flex flex-col gap-3">
                    <span className="text-[13px] font-semibold font-mono tracking-wider  text-[color:var(--cyan)]">Property Specifications</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Built</label>
                        <input
                          type="number"
                          value={newPropertyForm.yearBuilt}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, yearBuilt: parseInt(e.target.value) || new Date().getFullYear() }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Type</label>
                        <input
                          type="text"
                          value={newPropertyForm.propertyType}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, propertyType: e.target.value as NewPropertyForm["propertyType"] }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Estate</label>
                        <input
                          type="text"
                          value={newPropertyForm.suburb}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, suburb: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Finish</label>
                        <input
                          type="text"
                          value={newPropertyForm.finish}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, finish: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Bedrooms</label>
                        <input
                          type="number"
                          value={newPropertyForm.bedrooms}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, bedrooms: parseInt(e.target.value) || 0 }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Bathrooms</label>
                        <input
                          type="number"
                          value={newPropertyForm.bathrooms}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, bathrooms: parseInt(e.target.value) || 0 }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Parking</label>
                        <input
                          type="number"
                          value={newPropertyForm.garages}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, garages: parseInt(e.target.value) || 0 }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Erf size</label>
                        <input
                          type="text"
                          value={newPropertyForm.erfSize}
                          onChange={(e) => setNewPropertyForm((p) => ({ ...p, erfSize: e.target.value }))}
                          className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Retail specs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Asking Price (ZAR)</label>
                      <input
                        type="number"
                        value={newPropertyForm.askingPrice}
                        onChange={(e) => setNewPropertyForm((p) => ({ ...p, askingPrice: parseFloat(e.target.value) || 0 }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Cost Price (ZAR)</label>
                      <input
                        type="number"
                        value={newPropertyForm.costPrice}
                        onChange={(e) => setNewPropertyForm((p) => ({ ...p, costPrice: parseFloat(e.target.value) || 0 }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Floor size (m²)</label>
                      <input
                        type="text"
                        value={newPropertyForm.floorSize}
                        onChange={(e) => setNewPropertyForm((p) => ({ ...p, floorSize: e.target.value }))}
                        className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Listing Ref</label>
                      <input
                        type="text"
                        value={newPropertyForm.listingRef}
                        onChange={(e) => setNewPropertyForm((p) => ({ ...p, listingRef: e.target.value }))}
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
                        After you save this unit, open <b className="text-[color:var(--white)]">TruLens</b>, shoot the guided slots for listing{" "}
                        <span className="font-mono text-[color:var(--cyan)]">{newPropertyForm.listingRef}</span>, then tap{" "}
                        <b className="text-[color:var(--white)]">Export to DMS</b>. Gallery appears here automatically.
                      </p>
                      <button
                        type="button"
                        onClick={() => openTruLens(newPropertyForm.listingRef)}
                        className="self-start mt-1 text-[13px] font-semibold tracking-normal px-3 py-2 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)]"
                      >
                        Open TruLens for this listing #
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)]  font-semibold">Description</label>
                    <textarea
                      rows={3}
                      value={newPropertyForm.description}
                      onChange={(e) => setNewPropertyForm((p) => ({ ...p, description: e.target.value }))}
                      className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors outline-none font-sans"
                    ></textarea>
                  </div>

                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection("portfolio")}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      Publish to Active Listings
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Enquiry CRM SECTION */}
        {/* LISTING HEALTH — ageing and margin, the two numbers that decide whether
            a yard makes money. Everything shown was already in the data. */}
        {activeSection === "listing_health" && (() => {
          /* `live` excludes archived units explicitly. Archiving now forces
             SOLD, so the status test would catch them anyway — but this once
             relied on that invariant while nothing maintained it, and an
             archived home sat in Capital in listing. Say it outright.

             `sold` deliberately keeps them: archiving retires a home from the
             floor without retracting the sale, so realised margin must still
             count it. Filtering them here would shrink the money figures every
             time a agency tidied up. */
          const live = filteredProperties.filter((v) => v.status === "INVENTORY" && !v.archivedAt);
          const sold = filteredProperties.filter((v) => v.status === "SOLD");

          const capitalTiedUp = live.reduce((sum, v) => sum + costBasis(v), 0);
          const reconTotal    = live.reduce((sum, v) => sum + reconSpend(v), 0);
          const projected     = live.reduce((sum, v) => sum + grossMargin(v).rand, 0);
          const realised      = sold.reduce((sum, v) => sum + grossMargin(v).rand, 0);
          const aged          = live.filter((v) => marketAge(v) > 60);
          const agedCapital   = aged.reduce((sum, v) => sum + costBasis(v), 0);

          const byAge = [...live].sort((a, b) => marketAge(b) - marketAge(a));

          return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Listing health</h1>
                <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                  What your listings are costing you, and what they stand to make
                </p>
              </div>

              {/* The four numbers worth knowing before opening the yard */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Capital in listings", value: formatZAR(capitalTiedUp), sub: `${live.length} homes, incl. ${formatZAR(reconTotal)} prep` },
                  { label: "Projected margin", value: formatZAR(projected), sub: "if everything sells at asking" },
                  { label: "Realised margin", value: formatZAR(realised), sub: `${sold.length} sold` },
                  { label: "Tied up over 60 days", value: formatZAR(agedCapital), sub: `${aged.length} ${aged.length === 1 ? "home" : "homes"}`, warn: aged.length > 0 },
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
                  const inBand = live.filter((v) => { const d = marketAge(v); return d >= b.min && d <= b.max; });
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
                  <span className="text-[13px] font-semibold text-[color:var(--white)]">Oldest listing first</span>
                </div>
                {byAge.length === 0 ? (
                  <p className="px-4 py-6 text-[13px] text-[rgba(232,234,230,0.55)]">No listings yet.</p>
                ) : (
                  <table className="w-full text-[13px] stack-mobile">
                    <thead>
                      <tr className="text-[13px] text-[rgba(232,234,230,0.55)]">
                        <th className="text-left font-medium px-4 py-2">Property</th>
                        <th className="text-right font-medium px-3 py-2">Age</th>
                        <th className="text-right font-medium px-3 py-2">Cost</th>
                        <th className="text-right font-medium px-3 py-2">Prep</th>
                        <th className="text-right font-medium px-3 py-2">Asking</th>
                        <th className="text-right font-medium px-4 py-2">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byAge.map((v) => {
                        const days = marketAge(v);
                        const band = ageBand(days);
                        const m = grossMargin(v);
                        return (
                          <tr key={v.id} onClick={() => setSelectedDetailProperty(v)}
                              className="border-t border-white/5 cursor-pointer hover:bg-white/[0.03]">
                            <td data-label="Property" className="px-4 py-3 text-[13px] md:text-[15px]">
                              <span className="text-[color:var(--white)]">{propertyLabel(v)}</span>
                              <span className="text-[13px] text-[rgba(232,234,230,0.55)] ml-2">{v.listingRef}</span>
                            </td>
                            <td data-label="Age" className="px-3 py-3 text-[13px] md:text-[15px] text-right" style={{ color: band.tone }}>{days}d</td>
                            <td data-label="Cost" className="px-3 py-3 text-[13px] md:text-[15px] text-right text-[rgba(232,234,230,0.72)]">{formatZAR(v.costPrice || 0)}</td>
                            <td data-label="Prep" className="px-3 py-3 text-[13px] md:text-[15px] text-right text-[rgba(232,234,230,0.72)]">{reconSpend(v) ? formatZAR(reconSpend(v)) : "—"}</td>
                            <td data-label="Asking" className="px-3 py-3 text-[13px] md:text-[15px] text-right text-[rgba(232,234,230,0.72)]">{formatZAR(v.askingPrice || 0)}</td>
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

        {activeSection === "enquiries" && (
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
                {/* De-glowed: a convenience action, not the loudest control in
                    the section. Ghost, no cyan fill, no pulse; the count is the
                    reason you'd tap it. */}
                <button
                  onClick={handleAutoAssign}
                  disabled={isAutoAssigning || (state?.enquiries.filter(l => l.status === "New").length === 0)}
                  className="tru-btn-ghost px-3 min-h-[36px] text-[13px] flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles size={14} className={isAutoAssigning ? "animate-spin" : ""} />
                  {isAutoAssigning ? "Assigning…" : `Auto-assign ${state?.enquiries.filter(l => l.status === "New").length ?? 0} new`}
                </button>
                <button onClick={() => setIsLeadModalOpen(true)} className="btn btn-primary">
                  New Enquiry
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
                {["New", "Contacted", "Viewing Scheduled", "Negotiating", "Closed Won", "Closed Lost"].map((stage) => {
                  // Off the scoped list, not state.enquiries — the board was the
                  // one view ignoring tenant scoping, which is why its counts
                  // disagreed with the header above it.
                  const stageLeads = filteredLeads.filter((l) => {
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
                            <div className="text-[13px] md:text-[15px] text-[color:var(--white-dim)] truncate">{getPropertyLabel(l.propertyId)}</div>
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
                                    className="text-[13px] font-semibold px-2 py-0.5 rounded bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30"
                                    title="WhatsApp this Enquiry"
                                    onClick={() => {
                                      const digits = String(l.phone).replace(/\D/g, "").replace(/^0/, "27");
                                      const interest = getPropertyLabel(l.propertyId);
                                      const text = `Hi ${l.firstName}, following up from the agency re ${interest}. When works for a chat?`;
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
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Home</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Origin</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Status</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)]">Agent</th>
                        <th className="py-3 px-4 font-medium text-[length:var(--t-micro)] text-[color:var(--muted)] text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.enquiries
                        .filter((l) => !filterOverdueOnly || (l.status === "New" || !l.lastContactedAt))
                        .map((l) => (
                          <tr key={l.id} className="border-b border-white/3 hover:bg-[color:var(--glass)]">
                            <td className="py-3 px-4 text-[13px] md:text-[15px] font-semibold text-[color:var(--white)]">
                              {l.firstName} {l.lastName}
                              <span className="block text-[13px] font-normal text-[rgba(232,234,230,0.72)] mt-0.5">{l.phone} / {l.email}</span>
                            </td>
                            <td data-label="Asset" className="py-3 px-4 text-[13px] md:text-[15px] font-semibold">{getPropertyLabel(l.propertyId)}</td>
                            <td data-label="Origin" className="py-3 px-4">
                              <span className="text-[13px] text-[rgba(232,234,230,0.72)]">{l.source}</span>
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
                                    const interest = getPropertyLabel(l.propertyId);
                                    const text = `Hi ${l.firstName}, following up from the agency re ${interest}. When works for a chat?`;
                                    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
                                  }}
                                  className="px-3 py-2 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 rounded-lg text-[13px] font-semibold"
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
            generators. Agencies issue invoices and contracts from their own
            systems; here we track only the status of each step to close and
            hand a deal over, so no customer documents live on the server. */}
        {activeSection === "deal_readiness" && (() => {
          const CHECK_ITEMS = [
            { key: "electricalCoc", label: "Electrical COC" },
            { key: "beetleClearance", label: "Beetle clearance" },
            { key: "invoiced", label: "Invoiced" },
            { key: "depositReceived", label: "Deposit" },
            { key: "transferRegistered", label: "Transfer registered" },
          ] as const;
          const FINANCE_OPTS = ["N/A", "Submitted", "Approved", "Declined"] as const;
          /* Labels only — the ORDER comes from DOC_STAGES so this cannot drift
             from the server's idea of the sequence. It previously repeated the
             order by hand, under a comment warning not to. */
          const DOCHUB_LABELS: Record<DocStage, string> = {
            offer: "offer",
            transfer: "Offer to Purchase",
            compliance: "Compliance",
            invoice: "Invoice",
            occupation: "occupation",
          };
          /* Completed deals drop off: this page is what is still outstanding.
             They stay reachable through Enquiry CRM, and the property keeps its
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
          const patchChecklist = async (Enquiry: any, patch: any) => {
            await updateLead(Enquiry.id, { dealChecklist: { ...(Enquiry.dealChecklist || {}), ...patch } });
            loadAllState();
          };
          const openDocHub = (leadId: string) => {
            setLeadInitialTab("dochub");
            setLeadDetailId(leadId);
          };
          /* DocHub flow settings target(s). Configured once, not read every
             visit, so it now lives behind a header button + dialog rather than a
             full-width card at the top of the page. Desktop-only, same as before;
             the components behind it stay lazy-loaded. */
          const docFlowTarget = state?.agencies
            ? (agencyId ? state.agencies.filter((d) => d.id === agencyId) : state.agencies)
            : [];
          const docFlowDemo =
            agencyId && docFlowTarget.length === 0
              ? [{ id: agencyId, name: sessionAccount?.label || "Demo Agency", location: "" }]
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
                    DocHub flow settings
                  </button>
                )}
              </div>

              {/* DocHub flow settings dialog. Same isDesktop gate and Suspense
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
                      <h3 className="font-semibold text-[16px] text-[color:var(--white)]">DocHub flow settings</h3>
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
                          Preview only — this account has no persisted agency record, so Save will not work.
                          Sign in with a agency code to persist changes.
                        </div>
                      )}
                      {docFlowList.map((d) => (
                        <Suspense key={d.id} fallback={<div className="text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
                          <DocFlowSettings agency={d as Agency} isAdmin={isMasterAdmin} onSaved={loadAllState} />
                        </Suspense>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {deals.length === 0 ? (
                <div className="card p-8 text-center text-[13px] text-[rgba(232,234,230,0.72)]">
                  No active deals yet. A deal appears here once a Enquiry reaches <span className="text-[color:var(--white)] font-semibold">Negotiating</span>.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {deals.map((Enquiry) => {
                    const cl: any = Enquiry.dealChecklist || {};
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
                      const pastCompliance = Enquiry.docFlowCompletedAt
                        ? true
                        : Enquiry.docStage
                        ? DOC_STAGES.indexOf(Enquiry.docStage) > DOC_STAGES.indexOf("compliance")
                        : false;
                      const invoiceFinalised = filteredDocuments.some(
                        (d) => d.leadId === Enquiry.id && d.stage === "invoice" && d.status === "Signed",
                      );
                      const enteredDocHub = !!Enquiry.docStage || !!Enquiry.docFlowCompletedAt;
                      if (pastCompliance && !cl.electricalCoc)
                        conflictByKey.electricalCoc = "Compliance is signed off, but Electrical COC is un-ticked.";
                      if (pastCompliance && !cl.beetleClearance)
                        conflictByKey.beetleClearance = "Compliance is signed off, but Beetle clearance is un-ticked.";
                      if (enteredDocHub && !!cl.invoiced !== invoiceFinalised)
                        conflictByKey.invoiced = cl.invoiced
                          ? "Checklist says invoiced, but the DocHub invoice stage is not finalised."
                          : "The DocHub invoice is finalised, but the Invoiced box is un-ticked.";
                    }
                    return (
                      <div key={Enquiry.id} className="card p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <span className="font-semibold text-[15px] text-[color:var(--white)] block truncate">
                              {Enquiry.firstName} {Enquiry.lastName}
                            </span>
                            <span className="block text-[13px] text-[rgba(232,234,230,0.72)] truncate">
                              {getPropertyLabel(Enquiry.propertyId)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[13px] font-medium text-[rgba(232,234,230,0.72)]">{Enquiry.status}</span>
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
                            Enquiry modal (no double-click via Overview). Desktop only:
                            the modal DocHub tab itself is gated the same way. */}
                        {isDesktop && (() => {
                          /* A completed deal has every stage behind it. Reading
                             docStage alone cannot see that — it is null on both
                             completion and on a Enquiry that never started — so a
                             finished deal showed five grey dots. */
                          const currentIdx = Enquiry.docFlowCompletedAt
                            ? DOC_STAGES.length
                            : Enquiry.docStage
                            ? DOC_STAGES.indexOf(Enquiry.docStage)
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
                                      <span className={`text-[11px] truncate ${current ? "text-[color:var(--white)] font-semibold" : "text-[color:var(--muted)]"}`}>
                                        {DOCHUB_LABELS[stage]}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                onClick={() => openDocHub(Enquiry.id)}
                                className="shrink-0 px-3 min-h-[32px] rounded-[8px] bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] border border-[color:var(--cyan-soft)] text-[12px] font-semibold hover:bg-[color:var(--cyan)] hover:text-black transition-colors"
                              >
                                Open DocHub
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
                                onClick={() => patchChecklist(Enquiry, { [item.key]: !on })}
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
                                  onClick={() => patchChecklist(Enquiry, { financeStatus: o })}
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
        {/* ACCOUNTING & RECON SECTION */}
        {activeSection === "accounting_recon" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <Suspense fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
              <AccountingRecon
              state={state}
              onAddExpense={handleCreateExpense}
              onReconcileExpense={handleReconcileExpense}
              onUpdateProperty={handleUpdateProperty}
            />
            </Suspense>
          </div>
        )}


        {/* CUSTOMER FORM SECTION */}
        {activeSection === "customer_form" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Add a customer</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">Use this form for remote customer registration.</p>
            </div>
            <div className="max-w-lg">
              <CustomerLeadForm agencyId={agencyId || "d1"} properties={activeListings as any} onSuccess={() => alert("Enquiry Captured!")} />
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
                            Focus: {getPropertyLabel(t.propertyId || "")} / Enquiry: {getLeadLabel(t.leadId || "")}
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
                const leadsAssigned = state.enquiries.filter((l) => l.assignedUserId === u.id).length;
                const dealsCompleted = state.enquiries.filter((l) => l.assignedUserId === u.id && l.status === "Closed Won").length;
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
                enquiries={state.enquiries} 
                properties={state.properties} 
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
            <AmortizationCalc initialPrice={state.properties[0]?.askingPrice || 485000} />
          </div>
        )}

        {/* LISTING MEDIA HUB — gallery only; capture lives in TruLens */}
        {activeSection === "media_web" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)] flex items-center gap-2">
                  <Image size={24} className="text-[color:var(--cyan)]" /> Listing media & web readiness
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
                  {activeListings.filter(v => (v.images?.length || 0) > 0).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-semibold">Need shoot</div>
                <div className="text-2xl font-semibold text-[color:var(--warning)] mt-1">
                  {activeListings.filter(v => computeDmsGalleryReadiness(v).level === "capture").length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-semibold">Web-ready gallery</div>
                <div className="text-2xl font-semibold text-[color:var(--cyan-bright)] mt-1">
                  {activeListings.filter(v => computeDmsGalleryReadiness(v).webReady).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)] font-semibold">Public listing feed</div>
                <a
                  className="text-[13px] text-[color:var(--cyan-bright)] font-mono mt-2 block break-all hover:underline"
                  href={`/api/public/listings?agency=${encodeURIComponent(currentAgencySlug || getAgencySlug())}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  /api/public/listings?agency={currentAgencySlug || getAgencySlug()}
                </a>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeListings.map(v => {
                const r = computeDmsGalleryReadiness(v as any);
                return (
                  <div key={v.id} className="card overflow-hidden flex flex-col">
                    <div className="aspect-[16/10] bg-[color:var(--ink-2)] relative">
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
                        title={r.reasons.join(" · ")}
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
                        <div className="text-[16px] font-semibold text-[color:var(--white)]">{propertyLabel(v)}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)] font-mono">{v.listingRef}</div>
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
                          onClick={() => setSelectedDetailProperty(v)}
                        >
                          Open listing card
                        </button>
                        <button
                          type="button"
                          onClick={() => openTruLens(v.listingRef)}
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
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8 max-w-7xl mx-auto w-full">
            <div>
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-[color:var(--white)]">Settings</h1>
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 font-medium">
                {PRODUCT_NAME} — listing, CRM, media hub, full finance & website embeds
              </p>
            </div>

            {/* Backup. Admin only, and the server enforces that independently.
                The mounted disk holds the only copy of every agency's photos,
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
                    Downloads the entire DMS — every agency, property, photo, Enquiry and
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
                             agency used to come back as that agency's slice with
                             nothing to say it was partial, and a partial backup that
                             looks complete is worse than none. */
                          const mb = blob.size / 1024 / 1024;
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `propinspect-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
                            const properties = Array.isArray(parsed?.properties) ? parsed.properties.length : null;
                            const agencies = Array.isArray(parsed?.agencies) ? parsed.agencies.length : null;
                            if (properties === null || agencies === null) {
                              addNotification("Not a PropInspect backup", "No properties/agencies arrays in that file.", "warning");
                              return;
                            }
                            if (!confirm(
                              `Replace EVERYTHING on this instance with this file?\n\n` +
                              `${file.name}\n${agencies} agencies, ${properties} properties\n\n` +
                              `The current state is snapshotted on the server first, but every ` +
                              `agency on this instance is overwritten.`
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
                              `${body.restored?.agencies ?? 0} agencies, ${body.restored?.properties ?? 0} properties. ` +
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

            {/* Onboarding a agency. Admin only — the server enforces it too,
                so this gate only avoids rendering a form that would 403. */}
            {getAccount()?.role === "admin" && (
              <Suspense fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
                <AgencyAdmin onNotify={addNotification} />
              </Suspense>
            )}

            {/* TruSocial — connect and auto-publish to social channels.
                For a agency login, show their own panel. For master admin,
                show one panel per agency that has the "social" product. */}
            {(() => {
              const socialAgencies = agencyId
                ? hasProduct("social") ? [currentAgency] : []
                : (state?.agencies || []).filter((d: any) => (d.products || []).includes("social"));
              return socialAgencies.map((d: any) => (
                <Suspense key={d.id} fallback={<div className="p-6 text-[13px] text-[rgba(232,234,230,0.55)]">Loading…</div>}>
                  <TruSocialSettings
                    agencyId={d.id}
                    dealerName={agencyId ? undefined : d.name}
                    truSocialEnabled={!!d.truSocialEnabled}
                    onNotify={addNotification}
                  />
                </Suspense>
              ));
            })()}

            {/* Agency details — self-service editor for the identity fields
                quoted on invoices, agreements and public listings. Admins
                targeting another agency pass isAdmin so the server
                accepts the agencyId. Loops for admins per the standing
                per-agency settings rule. Demo (no real agency row in shared
                state) still gets a stub so the form is testable — Save 404s
                and the amber banner explains why. */}
            {state?.agencies && (() => {
              const target = agencyId
                ? state.agencies.filter((d) => d.id === agencyId)
                : state.agencies;
              const synthesizedDemo =
                agencyId && target.length === 0
                  ? [{
                      id: agencyId,
                      name: sessionAccount?.label || "Demo Agency",
                      location: "",
                    } as Agency]
                  : [];
              const list = target.length > 0 ? target : synthesizedDemo;
              return (
                <>
                  {target.length === 0 && synthesizedDemo.length > 0 && (
                    <div className="text-[12px] text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-md px-3 py-2">
                      Preview only — this account has no persisted agency record, so Save will not work.
                      Sign in with a agency code to persist changes.
                    </div>
                  )}
                  {list.map((d) => (
                    <React.Fragment key={d.id}>
                      <AgencyDetailsSettings agency={d} isAdmin={isMasterAdmin} onSaved={loadAllState} />
                      <DocSettingsPanel agency={d} isAdmin={isMasterAdmin} onSaved={loadAllState} />
                    </React.Fragment>
                  ))}
                </>
              );
            })()}

            {/* Install as an app. The banner is dismissible and only appears
                when the browser volunteers the prompt, so without this there
                was no way back to installing once it had been closed. */}
            <div className="card border-[color:var(--cyan-soft)]">
              <div className="card-header border-b border-white/5 px-5 py-3">
                <h3 className="font-semibold text-[16px] text-[color:var(--white)] flex items-center gap-2">
                  <Download size={14} className="text-[color:var(--cyan-bright)]" /> Install PropInspect as an app
                </h3>
              </div>
              <div className="card-body p-5">
                <InstallAppButton appName="PropInspect" />
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
                      Deletes all listing, enquiries, invoices and signed documents for
                      <b className="text-[color:var(--white)]"> every agency</b> on this instance and
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

        {/* Mobile bottom tab bar. Five destinations: the four things a agency
            touches hourly, plus a More opener for everything else. Above md the
            permanent sidebar is the navigation and this stays hidden. */}
        {(() => {
          const AVAILABLE = new Set(
            filteredNavigation.flatMap((g) => g.items.map((i) => i.id))
          );
          const tabs: Array<{
            id: string;
            label: string;
            icon: typeof Home;
            action: () => void;
            active: boolean;
            dot?: boolean;
          }> = [];
          if (AVAILABLE.has("dashboard")) {
            tabs.push({
              id: "dashboard",
              label: "Today",
              icon: Home,
              action: () => navigateTo("dashboard"),
              active: activeSection === "dashboard",
            });
          }
          if (AVAILABLE.has("enquiries")) {
            tabs.push({
              id: "enquiries",
              label: "Leads",
              icon: Users,
              action: () => navigateTo("enquiries"),
              active: activeSection === "enquiries",
              dot: navAttention.enquiries > 0,
            });
          }
          if (AVAILABLE.has("portfolio")) {
            tabs.push({
              id: "portfolio",
              label: "Listings",
              icon: Home,
              action: () => navigateTo("portfolio"),
              active: activeSection === "portfolio",
              dot: navAttention.portfolio > 0,
            });
          }
          if (AVAILABLE.has("tasks")) {
            tabs.push({
              id: "tasks",
              label: "Tasks",
              icon: CheckSquare,
              action: () => navigateTo("tasks"),
              active: activeSection === "tasks",
              dot: navAttention.tasks > 0,
            });
          }
          tabs.push({
            id: "more",
            label: "More",
            icon: MoreHorizontal,
            action: () => setSidebarOpen(true),
            active: sidebarOpen,
          });
          return (
            <nav
              aria-label="Primary"
              style={{ paddingBottom: "calc(14px + var(--safe-b))" }}
              className="md:hidden fixed left-0 right-0 bottom-0 z-[190] bg-[color:var(--ink-2)]/95 backdrop-blur-md border-t border-[color:var(--glass-line)] pt-2 px-1"
            >
              <ul className="flex items-stretch justify-around">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <li key={t.id} className="flex-1">
                      <button
                        type="button"
                        onClick={t.action}
                        aria-current={t.active ? "page" : undefined}
                        aria-label={t.label}
                        className={`w-full min-h-[52px] flex flex-col items-center justify-center gap-0.5 rounded-lg cursor-pointer relative ${
                          t.active ? "text-[color:var(--cyan)]" : "text-[color:var(--muted)]"
                        }`}
                      >
                        <span className="relative">
                          <Icon size={20} />
                          {t.dot ? (
                            <span
                              aria-label="Needs attention"
                              className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-[color:var(--cyan)] ring-2 ring-[color:var(--ink-2)]"
                            />
                          ) : null}
                        </span>
                        <span className="text-[11px] font-medium">{t.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          );
        })()}
      </main>

      {/* Agency Assist. Opens from the top bar — no floating launcher. */}
      <PwaInstallBanner appName="PropInspect" accent="var(--blue)" dismissKey="truflow_premium_pwa_dismissed" />
      <ChatWidget open={assistOpen} onOpenChange={setAssistOpen} />

      {/* The public-facing website chatbot simulation used to float bottom-left
          of the agency's own workstation, which put two different assistants on
          one screen — one for the agency, one pretending to be the customer's.
          It belongs on the agency's website, not in the DMS. Component kept;
          only the render is removed. */}

      {/* --- FORM MODALS --- */}

      {/* Log Enquiry Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[color:var(--ink-2)] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-4 md:p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-semibold tracking-tight text-[color:var(--white)]">Add Enquiry</h3>
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
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Select property</label>
                <select value={newLeadForm.propertyId} onChange={(e) => setNewLeadForm((p) => ({ ...p, propertyId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  {state.properties.map((v) => (
                    <option key={v.id} className="bg-[color:var(--ink-2)]" value={v.id}>{propertyLabel(v)}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Ad Source</label>
                <select value={newLeadForm.source} onChange={(e) => setNewLeadForm((p) => ({ ...p, source: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                  <option className="bg-[color:var(--ink-2)]" value="Website">Website Form</option>
                  <option className="bg-[color:var(--ink-2)]" value="Walk-in">Walk-in Showroom</option>
                  <option className="bg-[color:var(--ink-2)]" value="Facebook">Facebook Enquiry Gen</option>
                  <option className="bg-[color:var(--ink-2)]" value="Property24">Property24</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Initial Requirement notes</label>
                <textarea rows={2} value={newLeadForm.notes} onChange={(e) => setNewLeadForm((p) => ({ ...p, notes: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors font-sans"></textarea>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsLeadModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Commit Enquiry File</button>
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
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Associate Enquiry</label>
                  <select value={newTaskForm.leadId} onChange={(e) => setNewTaskForm((p) => ({ ...p, leadId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    <option className="bg-[color:var(--ink-2)]" value="">None</option>
                    {state.enquiries.map((l) => (
                      <option key={l.id} className="bg-[color:var(--ink-2)]" value={l.id}>{l.firstName} {l.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Associate Listing</label>
                  <select value={newTaskForm.propertyId} onChange={(e) => setNewTaskForm((p) => ({ ...p, propertyId: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-lg px-2 py-2 text-[13px] text-[color:var(--white)] font-sans">
                    <option className="bg-[color:var(--ink-2)]" value="">None</option>
                    {state.properties.map((v) => (
                      <option key={v.id} className="bg-[color:var(--ink-2)]" value={v.id}>{propertyLabel(v)}</option>
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
                <input type="email" required placeholder="name@agency.co.za" value={newUserForm.email} onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-4 py-3 text-[16px] text-[color:var(--white)] focus:outline-none focus:border-[color:var(--cyan)]/60 transition-colors" />
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
                They'll get their own access code and see only this agency's listing and enquiries.
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
          Without one, clicking a Enquiry or a property threw on render and the
          error boundary swallowed it — the row simply did nothing. */}
      {leadDetailId && (
        <Suspense fallback={<div className="fixed inset-0 z-[400] grid place-items-center bg-black/60 text-[13px] text-[rgba(232,234,230,0.72)]">Opening…</div>}>
        <EnquiryDetailModal
          leadId={leadDetailId}
          properties={state.properties}
          users={state.users}
          allCommunications={state.communications}
          allTasks={state.tasks}
          onClose={() => { setLeadDetailId(null); setLeadInitialTab(undefined); }}
          onRefresh={loadAllState}
          initialTab={leadInitialTab}
          documentsPanel={
            <DocumentsHub
              embedded
              leadId={leadDetailId}
              documents={filteredDocuments.filter((d) => d.leadId === leadDetailId)}
              getLeadLabel={getLeadLabel}
              getPropertyLabel={getPropertyLabel}
              onUpload={handleUploadDocument}
              onSign={handleSignDocument}
              onDelete={handleDeleteDocument}
            />
          }
          docHubPanel={(() => {
            if (!isDesktop) return undefined;
            const leadForPanel = state.enquiries.find((l) => l.id === leadDetailId);
            if (!leadForPanel) return undefined;
            const dealerForPanel = state.agencies.find(
              (d) => d.id === (leadForPanel.agencyId || agencyId),
            );
            return (
              <DocHubPanel
                Enquiry={leadForPanel}
                agency={dealerForPanel}
                onLeadRefresh={loadAllState}
              />
            );
          })()}
        />
        </Suspense>
      )}

      {selectedDetailProperty && (
        <Suspense fallback={<div className="fixed inset-0 z-[400] grid place-items-center bg-black/60 text-[13px] text-[rgba(232,234,230,0.72)]">Opening…</div>}>
        <PropertyDetailModal
          property={state.properties.find((v) => v.id === selectedDetailProperty.id) || selectedDetailProperty}
          isOpen={true}
          onClose={() => setSelectedDetailProperty(null)}
          onUpdateProperty={handleUpdateProperty}
          onDeleteProperty={handleDeleteProperty}
          onReturnToListing={handleReturnToListing}
          settings={state.settings}
          agencyId={agencyId || selectedDetailProperty?.agencyId}
          hasLens={hasProduct("lens")}
          truSocialEnabled={(() => {
            // Publish tab shows only for a agency that both carries the "social"
            // product and has TruSocial switched on — the publish targets are
            // OAuth connections, so anything less would only ever fail.
            const d: any = (state?.agencies || []).find(
              (x: any) => x.id === (agencyId || selectedDetailProperty?.agencyId)
            );
            return !!d?.truSocialEnabled && hasProduct("social");
          })()}
          documentsPanel={
            <DocumentsHub
              embedded
              propertyId={selectedDetailProperty.id}
              documents={filteredDocuments.filter((d) => d.propertyId === selectedDetailProperty.id)}
              getLeadLabel={getLeadLabel}
              getPropertyLabel={getPropertyLabel}
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
                <span className="text-lg font-semibold text-[color:var(--white)]">{state.enquiries.length} Leads</span>
                <span className="text-[13px] text-[color:var(--cyan)]">Active response</span>
              </div>
              <div className="bg-[color:var(--glass)] border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)]  font-mono">Homes Sold</span>
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
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Prep & Maintenance Outlay</span>
                <span className="font-mono font-semibold text-[color:var(--muted)]">- R {reconTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[13px] border-b border-white/3 pb-3">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Gross Agency Revenue</span>
                <span className="font-mono font-semibold text-[color:var(--white)]">R {totalRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-[rgba(232,234,230,0.72)] font-medium">Unpaid invoices</span>
                <span className="font-mono font-semibold text-[color:var(--warning)]">R {state.invoices.filter(i => i.status === 'Sent').reduce((sum, i) => sum + i.amount, 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold tracking-normal text-[rgba(232,234,230,0.72)] font-mono px-1">Sold properties</span>
              <div className="flex flex-col gap-2">
                {sold.length === 0 && <span className="text-[13px] text-[rgba(232,234,230,0.72)] px-1">No sold properties on record.</span>}
                {sold.map(v => (
                  <div key={v.id} className="bg-[color:var(--glass)] border border-white/5 rounded-xl px-3 py-3 flex justify-between items-center text-[13px]">
                    <div>
                      <span className="font-semibold text-[color:var(--white)] block">{propertyLabel(v)}</span>
                      <span className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5 block font-mono">Listing Ref: {v.listingRef}</span>
                    </div>
                    <span className="font-mono font-semibold text-[color:var(--cyan)]">R {((v.askingPrice || 0) - (v.costPrice || 0)).toLocaleString()} profit</span>
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
      <Assistant />
    </>
    )}
    </MobileDevice>
  );
}
