import logo from "./assets/truflow-logo.png";
import React, { useState, useEffect } from "react";
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
import AmortizationCalc from "./components/AmortizationCalc";
import LeadDetailModal from "./components/LeadDetailModal";
import AccountingRecon from "./components/AccountingRecon";
import VehicleDetailModal from "./components/VehicleDetailModal";
import CustomerLeadForm from "./components/CustomerLeadForm";
import { CommissionEstimator } from "./components/CommissionEstimator";
import WordPressIntegration from "./components/WordPressIntegration";
import LoginSplash from "./components/LoginSplash";
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

export default function App() {
  const [state, setState] = useState<DMSState | null>(null);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const [currentUserId, setCurrentUserId] = useState("u1");
  const AUTH_SESSION_KEY = "truflow_premium_session";
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => typeof sessionStorage !== "undefined" && sessionStorage.getItem(AUTH_SESSION_KEY) === "1"
  );

  useEffect(() => {
    console.log("isLoggedIn changed:", isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    return initGlassMotion();
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
  const [selectedRole, setSelectedRole] = useState<'salesperson' | 'manager' | 'owner'>('owner');
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
  const [newVehicleForm, setNewVehicleForm] = useState({ year: 2026, make: "Volkswagen", model: "Amarok", trim: "Double Cab Style V6", engine: "3.0L V6 Turbo Diesel", fuelType: "Diesel" as any, transmission: "Automatic" as any, bodyType: "Bakkie Utility", retailPrice: 745000, costPrice: 640000, mileage: 15300, stockNumber: "JHB-" + Math.floor(Math.random() * 8999 + 1000), description: "Immaculate condition. Full service history. Active info display cockpit.", dealershipId: "d1" });

  const [vinInput, setVinInput] = useState("");
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinDecodeStatus, setVinDecodeStatus] = useState("");

  // Currently Focused Documents for View Previews
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [activeAgreementId, setActiveAgreementId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAllState = () => {
    console.log("Loading DMS state from server...");
    setLoadError(null);
    fetchState()
      .then((data) => {
        console.log("State loaded successfully:", data);
        console.log(
          "Vehicles with photos:",
          data.vehicles
            .filter((v: any) => (v.images?.length || 0) > 0)
            .map((v: any) => `${v.stockNumber}:${v.images.length}`)
        );
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
  }, []);

  if (!isLoggedIn) {
    return (
      <LoginSplash
        onLogin={() => {
          try {
            sessionStorage.setItem(AUTH_SESSION_KEY, "1");
          } catch { /* ignore */ }
          setIsLoggedIn(true);
        }}
      />
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-[#E8EEF6] font-sans">
        <div className="text-red-500 mb-4 font-mono text-sm border border-red-500/20 bg-red-500/10 p-4 rounded-lg">
          Connection Error: {loadError}
        </div>
        <button 
          onClick={loadAllState}
          className="px-4 py-2 bg-[#1466E0] text-white rounded text-xs font-bold hover:bg-opacity-80"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-[#070d15] flex flex-col items-center justify-center p-6 text-[#E8EEF6] font-sans gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#1466E0] border-[#15C7C0]/10 animate-spin" />
        <div className="font-bold text-sm tracking-wide">Starting TruFlow Premium…</div>
        <div className="text-xs text-[#9DB0C6] text-center max-w-xs">
          Loading floor data from <span className="font-mono text-[#15C7C0]">localhost:3001</span>.
          If this hangs, restart the server (`npm run dev` in truflow-premium).
        </div>
        <button
          type="button"
          onClick={loadAllState}
          className="mt-2 px-4 py-2 rounded-lg bg-[#1466E0] text-white text-xs font-bold"
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
        { id: "documents", label: "Documents", icon: FileText },
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

  const handleUploadDocument = async (doc: { fileName: string; mimeType: string; fileData: string }) => {
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
  const handleResetState = () => {
    if (confirm("Reset current simulation data cache to baseline system defaults?")) {
      resetState().then((newState) => {
        setState(state);
        alert("Showroom cache cleared & baseline data re-seeded.");
        window.location.reload();
      });
    }
  };

  /** Sign out → password splash. Does not wipe inventory. */
  const handleLogout = () => {
    try {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch { /* ignore */ }
    setSidebarOpen(false);
    setActiveSection("dashboard");
    setIsLoggedIn(false);
  };

  const handleLogin = () => {
    try {
      sessionStorage.setItem(AUTH_SESSION_KEY, "1");
    } catch { /* ignore */ }
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
    await createUser(newUserForm);
    setIsUserModalOpen(false);
    setNewUserForm({ name: "", email: "", role: "salesperson", phone: "" });
    loadAllState();
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
      <div className="min-h-screen bg-[#070d15] text-[#E8EEF6] flex relative select-none perspective-scene">
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
          <a href="https://true-cars.co.za" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] text-[#67E8F9] hover:underline tracking-widest mt-2 uppercase">true-cars.co.za</a>
          <a href="https://true-cars.co.za/truesaas.html" target="_blank" rel="noopener noreferrer" className="font-mono text-[9px] text-[#67e8f9]/90 hover:underline tracking-widest mt-1 uppercase">TruSaas platform</a>
          <div className="flex gap-2 mt-2">
            <a href="https://true-cars.co.za" target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono uppercase px-2 py-1 rounded-lg bg-[#15C7C0]/12 text-[#15C7C0] border border-[#15C7C0]/25 hover:bg-[#15C7C0]/2">Showroom</a>
            <a href="https://true-cars.co.za/truesaas.html" target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono uppercase px-2 py-1 rounded-lg bg-[#22D3EE]/15 text-[#67E8F9] border border-[#22D3EE]/30 hover:bg-[#22D3EE]/25">TruSaas</a>
          </div>
        </div>

         <div className="flex-1 overflow-y-auto flex flex-col gap-5 pr-1 scrollbar-thin">
          {filteredNavigation.map((group) => (
            <div key={group.category} className="flex flex-col gap-1">
              <span className="font-mono text-[9px] text-[#9DB0C6] tracking-widest uppercase font-extrabold pl-2.5 mb-1 block">
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
                    className={`glass-nav-item flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl text-left relative cursor-pointer border ${
                      active
                        ? "is-active bg-gradient-to-r from-[#22D3EE]/20 to-[#1466E0]/15 text-white border-[#22D3EE]/35"
                        : "text-[#9DB0C6] hover:text-[#E8EEF6] hover:bg-white/[0.04] border-transparent"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r bg-[#67E8F9]" />
                    )}
                    <Icon size={14} className={active ? "text-[#67E8F9]" : "text-[#9DB0C6]"} />
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-red-300 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 hover:text-red-200 transition-all cursor-pointer"
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
           {/* Elegant Simulated Role Selector Pill */}
           <div className="flex bg-[#070d15]/80 border border-white/5 p-1 rounded-full text-[9px] font-bold">
             <button
               onClick={() => { setSelectedRole('salesperson'); if (['manager', 'settings', 'integration', 'accounting_recon'].includes(activeSection)) setActiveSection('dashboard'); }}
               className={`px-3.5 py-1 rounded-full transition-all cursor-pointer uppercase ${selectedRole === 'salesperson' ? "bg-[#1466E0] text-white shadow-md font-extrabold" : "text-[#9DB0C6] hover:text-[#E8EEF6]"}`}
             >
               Salesperson View
             </button>
             <button
               onClick={() => { setSelectedRole('manager'); if (['settings', 'integration', 'accounting_recon'].includes(activeSection)) setActiveSection('dashboard'); }}
               className={`px-3.5 py-1 rounded-full transition-all cursor-pointer uppercase ${selectedRole === 'manager' ? "bg-[#1466E0] text-white shadow-md font-extrabold" : "text-[#9DB0C6] hover:text-[#E8EEF6]"}`}
             >
               Manager View
             </button>
             <button
               onClick={() => setSelectedRole('owner')}
               className={`px-3.5 py-1 rounded-full transition-all cursor-pointer uppercase ${selectedRole === 'owner' ? "bg-[#1466E0] text-white shadow-md font-extrabold" : "text-[#9DB0C6] hover:text-[#E8EEF6]"}`}
             >
               Dealer Owner
             </button>
           </div>

           <div className="flex items-center gap-2">
             <div className="flex items-center gap-3 bg-[#0f1826] border border-white/5 rounded-full pl-3 pr-3 py-1.5">
               <div className="flex flex-col items-end">
                 <span className="text-[10px] font-bold text-[#E8EEF6]">Marc van der Merwe</span>
                 <span className="text-[8px] text-[#15C7C0] font-black uppercase font-mono tracking-wider">{selectedRole}</span>
               </div>
             </div>
             <button
               type="button"
               onClick={handleLogout}
               className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all cursor-pointer border border-red-500/20 text-[10px] font-bold uppercase tracking-wider"
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
              className="text-[#E8EEF6] p-2 hover:bg-white/5 rounded-lg cursor-pointer"
            >
              <Menu size={20} />
            </button>
            <img src={logo} alt="TruFlow Premium" className="h-9 w-auto max-w-[180px] object-contain logo-float" />
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1 h-8 px-2.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 cursor-pointer text-[9px] font-bold uppercase"
              title="Log out"
            >
              <LogOut size={14} />
              Out
            </button>
          </div>
          
          {/* Mobile role pill bar */}
          <div className="flex bg-[#070d15]/80 border border-white/5 p-0.5 rounded-full text-[8px] font-bold justify-between">
            <button
              onClick={() => { setSelectedRole('salesperson'); if (['manager', 'settings', 'integration', 'accounting_recon'].includes(activeSection)) setActiveSection('dashboard'); }}
              className={`flex-1 text-center py-1 rounded-full transition-all uppercase ${selectedRole === 'salesperson' ? "bg-[#1466E0] text-white shadow-sm" : "text-[#9DB0C6]"}`}
            >
              Salesperson
            </button>
            <button
              onClick={() => { setSelectedRole('manager'); if (['settings', 'integration', 'accounting_recon'].includes(activeSection)) setActiveSection('dashboard'); }}
              className={`flex-1 text-center py-1 rounded-full transition-all uppercase ${selectedRole === 'manager' ? "bg-[#1466E0] text-white shadow-sm" : "text-[#9DB0C6]"}`}
            >
              Manager
            </button>
            <button
              onClick={() => setSelectedRole('owner')}
              className={`flex-1 text-center py-1 rounded-full transition-all uppercase ${selectedRole === 'owner' ? "bg-[#1466E0] text-white shadow-sm" : "text-[#9DB0C6]"}`}
            >
              Owner
            </button>
          </div>
        </div>

        {/* OVERVIEW SECTION */}
        {activeSection === "dashboard" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Dashboard Overview</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5">Real-time dealer catalog and prospect tracking</p>
              </div>
              <button onClick={() => navigateTo("upload")} className="btn btn-primary">
                + New Inventory
              </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Active Floor Stock</div>
                <div className="text-2xl font-serif font-black text-[#E8EEF6] mt-1"><Counter value={activeVehiclesCount} /></div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">Ready for viewing</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Unresolved CRM Leads</div>
                <div className="text-2xl font-serif font-black text-[#E8EEF6] mt-1"><Counter value={unresolvedLeadsCount} /></div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">High conversion rating</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Units Sold</div>
                <div className="text-2xl font-serif font-black text-[#E8EEF6] mt-1"><Counter value={soldUnitsCount} /></div>
                <div className="text-[10px] text-[#9DB0C6] font-semibold mt-1">Cleared this cycle</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Total Realized Revenue</div>
                <div className="text-2xl font-serif font-black text-[#4D9BFF] mt-1"><Counter value={totalRevenue} prefix="R " /></div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">Cleared payments</div>
              </div>
            </div>

            {/* End of Day (EOD) Summary Card */}
            {(selectedRole === 'manager' || selectedRole === 'owner') && (
              <div className="card p-5 bg-gradient-to-r from-[#1466E0]/10 via-[#0a1420] to-[#15C7C0]/5 border border-[#1466E0]/25 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg shadow-[#1466E0]/5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-gradient-to-tr from-[#15C7C0]/10 to-[#1466E0]/15 border border-[#15C7C0]/25 text-[#15C7C0]">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h3 className="font-sans text-base font-black tracking-tight text-[#E8EEF6]">One-Tap End of Day (EOD) Operations Summary</h3>
                    <p className="text-xs text-[#9DB0C6] mt-0.5 max-w-xl leading-relaxed">
                      Generate a detailed operational report including customer leads worked, vehicles sold, reconditioning layout, and gross yield margins for the past 24 hours.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEODReport(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#15C7C0]/85 to-[#1466E0] hover:from-[#15C7C0] hover:to-[#1466E0] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#15C7C0]/10 hover:shadow-[#15C7C0]/25 cursor-pointer active:scale-95 transition-all flex items-center gap-2 self-stretch md:self-auto justify-center"
                >
                  <Sparkles size={14} className="animate-pulse" />
                  Compile EOD Summary
                </button>
              </div>
            )}

            {/* Daily Analytics — sample until live site analytics connected */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Website analytics</div>
                <span className="text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  Sample / demo data
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-[#0f1826]/5 rounded-lg p-3">
                   <div className="text-[10px] text-[#9DB0C6]">Visits</div>
                   <div className="text-lg font-bold text-white">{mockDailySummary.visits}</div>
                 </div>
                 <div className="bg-[#0f1826]/5 rounded-lg p-3">
                   <div className="text-[10px] text-[#9DB0C6]">Unique Visitors</div>
                   <div className="text-lg font-bold text-white">{mockDailySummary.uniqueVisitors}</div>
                 </div>
                 <div className="bg-[#0f1826]/5 rounded-lg p-3">
                   <div className="text-[10px] text-[#9DB0C6]">Avg Duration</div>
                   <div className="text-lg font-bold text-white">{mockDailySummary.avgVisitDuration}</div>
                 </div>
                 <div className="bg-[#0f1826]/5 rounded-lg p-3">
                   <div className="text-[10px] text-[#9DB0C6]">Bounce Rate</div>
                   <div className="text-lg font-bold text-white">{mockDailySummary.bounceRate}</div>
                 </div>
              </div>
            </div>

            {/* Featured Catalog list */}
            <div className="card">
              <div className="card-header flex justify-between items-center border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-sm">Recent Showroom Inventory</h3>
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
                    <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-[#1a2c3d] to-[#0f1b29] flex items-center justify-center overflow-hidden mb-3 shadow-md shadow-black/40">
                      {v.images && v.images.length > 0 ? (
                        <img src={v.images[0]} alt={`${v.make}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-[#1466E0] to-[#15C7C0] flex items-center justify-center text-white font-black text-lg">
                          {v.make.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-xs text-[#E8EEF6] truncate">{v.year} {v.make} {v.model}</h4>
                    <p className="text-[10px] text-[#9DB0C6] truncate mt-0.5">{v.transmission} / {v.fuelType}</p>
                    <div className="text-sm font-bold text-[#4D9BFF] mt-1.5">{formatZAR(v.retailPrice)}</div>
                    <div className="text-[9px] text-[#9DB0C6] mt-2 font-mono">Stock Ref: {v.stockNumber}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Leads list */}
            <div className="card">
              <div className="card-header flex justify-between items-center border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-sm">Active CRM Prospect Leads</h3>
                <button
                  onClick={() => navigateTo("leads")}
                  className="btn btn-secondary btn-sm"
                >
                  Open Pipelines
                </button>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10 text-[#9DB0C6] uppercase tracking-wider text-[10px] bg-[#0f1826]/5">
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
                      <tr key={l.id} className="border-b border-white/3 hover:bg-[#0f1826]/1">
                        <td className="py-3 px-4 font-black text-[#E8EEF6]">
                          {l.firstName} {l.lastName}
                          <span className="block text-[10px] font-normal text-[#9DB0C6] mt-0.5">{l.phone}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold">{getVehicleLabel(l.vehicleId)}</td>
                        <td className="py-3 px-4">
                          <span className="px-1.5 py-0.5 bg-[#1466E0]/15 text-[#4D9BFF] rounded text-[9px] font-bold uppercase tracking-wider">
                            {l.source}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-1.5 py-0.5 bg-[#35C46B]/10 text-[#35C46B] rounded text-[9px] font-bold uppercase tracking-wider">
                            {l.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#9DB0C6]">{getUserLabel(l.assignedUserId)}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setLeadDetailId(l.id)}
                            className="px-4 py-1.5 bg-[#1466E0] hover:bg-[#1466E0]/90 text-white transition-all font-bold rounded-lg text-[10px] cursor-pointer shadow-lg shadow-[#1466E0]/20 active:scale-95"
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
              <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Traffic Analytics</h1>
              <p className="text-xs text-[#9DB0C6] mt-0.5">Showroom visitors & conversion metrics</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Monthly Page Views</div>
                <div className="text-2xl font-serif font-black text-[#E8EEF6] mt-1">12,847</div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">+24% traffic growth</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Catalog Filter Clicks</div>
                <div className="text-2xl font-serif font-black text-[#E8EEF6] mt-1">8,432</div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">+18% high-intent actions</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Lead Conversion Rate</div>
                <div className="text-2xl font-serif font-black text-[#E8EEF6] mt-1">
                  {Math.round((state.leads.length / 8432) * 1000) / 10}%
                </div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">Standard industry index</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Average View Time</div>
                <div className="text-2xl font-serif font-black text-[#E8EEF6] mt-1">2m 14s</div>
                <div className="text-[10px] text-[#9DB0C6] font-semibold mt-1">Normal retention</div>
              </div>
            </div>

            {/* Weekly chart mock */}
            <div className="card">
              <div className="card-header px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold text-sm">Weekly Traffic Activity Overview</h3>
              </div>
              <div className="card-body p-4 flex flex-col gap-2">
                <div className="flex items-end justify-around h-44 bg-[#0f1826]/1 border border-white/5 rounded-xl p-4 gap-2">
                  {[1240, 1940, 1590, 2470, 2120, 3010, 2650].map((val, idx) => {
                    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
                    const percent = (val / 3010) * 100;
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                        <span className="text-[8px] text-[#15C7C0] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          {val}
                        </span>
                        <div
                          style={{ height: `${percent * 0.8}px` }}
                          className="w-full bg-gradient-to-t from-[#1466E0] to-[#15C7C0] rounded-t-sm opacity-70 group-hover:opacity-100 transition-all duration-200"
                        />
                        <span className="text-[9px] text-[#9DB0C6] mt-1">{days[idx]}</span>
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
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Inventory Database</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5">
                  Manage live pre-owned floor assets and pricing
                  {state.vehicles.some((v: any) => (v.images?.length || 0) > 0) && (
                    <span className="text-[#15C7C0] ml-2">
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
                  className="btn btn-secondary text-[10px] font-bold px-3 py-2 flex items-center gap-1.5"
                  title="Reload inventory from server (shows photos exported from TruLens)"
                >
                  <RefreshCw size={12} /> Refresh photos
                </button>
                <div className="relative flex-1 md:flex-none">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9DB0C6]" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Search model, make, VIN..."
                    className="w-full md:w-56 bg-[#0f1826]/4 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs text-[#E8EEF6] placeholder-[#5F7590] outline-none focus:border-[#1466E0]"
                  />
                </div>
                <select
                  value={inventoryStatusFilter}
                  onChange={(e) => setInventoryStatusFilter(e.target.value)}
                  className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                >
                  <option className="bg-[#0f1826]" value="ALL">All Statuses</option>
                  <option className="bg-[#0f1826]" value="INVENTORY">Active Stock</option>
                  <option className="bg-[#0f1826]" value="PENDING">Pending Deal</option>
                  <option className="bg-[#0f1826]" value="SOLD">Sold</option>
                </select>
                <select
                  value={inventoryPhotoFilter}
                  onChange={(e) => setInventoryPhotoFilter(e.target.value as any)}
                  className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                  title="Filter by TruLens gallery readiness"
                >
                  <option className="bg-[#0f1826]" value="ALL">All photos</option>
                  <option className="bg-[#0f1826]" value="NEEDS">Needs shoot</option>
                  <option className="bg-[#0f1826]" value="PARTIAL">Partial gallery</option>
                  <option className="bg-[#0f1826]" value="READY">Web-ready</option>
                </select>
                <select
                  value={inventoryAgeFilter}
                  onChange={(e) => setInventoryAgeFilter(e.target.value as any)}
                  className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                  title="Aging stock filter"
                >
                  <option className="bg-[#0f1826]" value="ALL">Any age</option>
                  <option className="bg-[#0f1826]" value="30">30+ days</option>
                  <option className="bg-[#0f1826]" value="60">60+ days</option>
                  <option className="bg-[#0f1826]" value="90">90+ days</option>
                </select>
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
                    days >= 90 ? "text-[#F0555A]" : days >= 60 ? "text-[#E7B24B]" : days >= 30 ? "text-[#4D9BFF]" : "text-[#E8EEF6]";
                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedDetailVehicle(v)}
                      className="v-card flex flex-col h-full group hover:-translate-y-1 transition-all duration-200 cursor-pointer"
                    >
                      {/* Card Image area */}
                      <div className="aspect-[16/10] bg-gradient-to-br from-[#1a2c3d] to-[#0f1b29] flex items-center justify-center relative border-b border-white/5 overflow-hidden select-none">
                        {v.images && v.images.length > 0 ? (
                          <img src={v.images[0]} alt={`${v.make}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-tr from-[#1466E0] to-[#15C7C0] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                            {(v.make || "??").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[8px] font-bold font-mono tracking-wider uppercase ${
                          v.status === "INVENTORY" ? "bg-[#35C46B]/15 text-[#35C46B]" : v.status === "PENDING" ? "bg-[#E7B24B]/15 text-[#E7B24B]" : "bg-[#F0555A]/15 text-[#F0555A]"
                        }`}>
                          {v.status === "INVENTORY" ? "Showroom Floor" : v.status === "PENDING" ? "Sale Pending" : "Delivered"}
                        </span>
                        <span
                          className="absolute top-3 left-3 px-2 py-0.5 rounded text-[8px] font-bold border max-w-[70%] truncate"
                          style={{ color: readiness.color, borderColor: readiness.color + "55", background: readiness.color + "22" }}
                          title={(readiness.reasons || []).join(" · ")}
                        >
                          {readiness.label}
                        </span>
                      </div>

                      {/* Info Area */}
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <h4 className="font-black text-sm text-[#E8EEF6] truncate">{v.year || ""} {v.make || "Vehicle"} {v.model || ""}</h4>
                          <p className="text-[10px] text-[#9DB0C6] mt-0.5">
                            {v.trim || "Standard Specs"} · <span className="font-mono">{v.stockNumber}</span>
                          </p>
                          <div className="text-[10px] text-[#9DB0C6] flex flex-wrap gap-x-2 gap-y-1 mt-2">
                            <span>{Number(v.mileage || 0).toLocaleString()} km</span>
                            <span>•</span>
                            <span>{v.transmission || "—"}</span>
                            <span>•</span>
                            <span>{v.fuelType || "—"}</span>
                            {readiness.photoCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-[#15C7C0]">{readiness.photoCount} photos</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="border-t border-white/5 pt-3 mt-1 flex justify-between items-center">
                          <div>
                            <div className="text-[9px] text-[#9DB0C6] uppercase font-mono tracking-wider">Retail Valuation</div>
                            <div className="text-base font-black text-[#4D9BFF] font-mono mt-0.5">{formatZAR(Number(v.retailPrice) || 0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] text-[#9DB0C6] uppercase font-mono tracking-wider">Days in stock</div>
                            <div className={`text-xs font-bold mt-0.5 ${ageTone}`}>{days} Days{days >= 60 ? " · age" : ""}</div>
                          </div>
                        </div>

                        {/* Actions — stopPropagation so card click still opens detail */}
                        <div
                          className="flex gap-1.5 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#1466E0]/20 text-[#4D9BFF] border border-[#1466E0]/30 hover:bg-[#1466E0]/30"
                            onClick={() => openTruLens(v.stockNumber)}
                            title="Guided shoot in TruLens"
                          >
                            <Camera size={11} /> Shoot
                          </button>
                          <button
                            type="button"
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/25"
                            onClick={() => openStockWhatsApp(v)}
                            title="WhatsApp stock blurb"
                          >
                            <MessageCircle size={11} /> WhatsApp
                          </button>
                          <button
                            type="button"
                            className="px-2 py-1.5 rounded-lg text-[9px] font-bold bg-white/5 text-[#9DB0C6] border border-white/10 hover:text-white"
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
              <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Reconditioning & Delivery Pipeline</h1>
              <p className="text-xs text-[#9DB0C6] mt-0.5">Control prep workflows for pre-owned stock</p>
            </div>

            {/* Stages Grid columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {["INVENTORY", "PENDING", "SOLD"].map((stage) => {
                const filtered = state.vehicles.filter((v) => v.status === stage);
                return (
                  <div key={stage} className="card bg-[#0f1826]/2 flex flex-col h-full min-h-[500px]">
                    <div className="card-header border-b border-white/5 px-4 py-3 flex justify-between items-center bg-[#0f1826]/1">
                      <span className="font-bold text-xs uppercase text-[#E8EEF6]">
                        {stage === "INVENTORY" ? "Floor Inventory" : stage === "PENDING" ? "Processing Sale" : "Delivered"}
                      </span>
                      <span className="px-2 py-0.5 bg-[#0f1826]/5 rounded-full text-[#9DB0C6] text-[10px] font-bold">
                        {filtered.length}
                      </span>
                    </div>

                    <div className="p-3 flex-1 flex flex-col gap-3 min-h-[300px]">
                      {filtered.map((v) => (
                        <div key={v.id} className="pipeline-card p-3 flex flex-col justify-between gap-3 shadow-md">
                          <div>
                            <div className="font-bold text-xs text-[#E8EEF6] truncate">{v.year} {v.make} {v.model}</div>
                            <p className="text-[10px] text-[#9DB0C6] mt-0.5">Ref: {v.stockNumber} / {v.mileage.toLocaleString()} km</p>
                            <p className="text-xs font-bold text-[#4D9BFF] mt-1.5">{formatZAR(v.retailPrice)}</p>
                          </div>

                          <div className="flex justify-between items-center border-t border-white/3 pt-2.5">
                            <span className="text-[9px] text-[#9DB0C6]">Age: {v.daysInInventory}d</span>
                            
                            <div className="flex gap-1">
                              {stage !== "INVENTORY" && (
                                <button
                                  onClick={() => moveVehicle(v.id, v.status, "PREV")}
                                  className="px-2 py-1 bg-[#0f1826]/5 border border-white/5 rounded text-[9px] font-bold hover:bg-white/10 transition-all cursor-pointer"
                                >
                                  &larr; Prev
                                </button>
                              )}
                              {stage !== "SOLD" && (
                                <button
                                  onClick={() => moveVehicle(v.id, v.status, "NEXT")}
                                  className="px-2 py-1 bg-[#1466E0]/15 border border-[#1466E0]/20 text-[#4D9BFF] rounded text-[9px] font-bold hover:bg-[#1466E0]/25 transition-all cursor-pointer"
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
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Add vehicle</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5">
                  Create stock metadata here. <b className="text-[#E8EEF6]">Photos only in TruLens</b> (guided shoot → Export to DMS).
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openTruLens()}
                  className="btn btn-primary flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
                >
                  <Camera size={12} /> Open TruLens
                </button>
                <button 
                  type="button" 
                  onClick={loadAllState} 
                  className="btn btn-secondary flex items-center gap-2 border border-white/10 hover:bg-white/5 px-3 py-1.5 rounded-lg text-xs"
                >
                  <RefreshCw size={12} className="text-[#15C7C0]" />
                  Pull gallery
                </button>
              </div>
            </div>

            <div className="card max-w-[700px] mx-auto w-full">
              <div className="card-body p-6 flex flex-col gap-4">
                <form onSubmit={handlePublishVehicle} className="flex flex-col gap-4">
                  {/* Dealership — which dealer site this stock belongs to */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Dealership</label>
                    <select
                      value={newVehicleForm.dealershipId}
                      onChange={(e) => setNewVehicleForm((p) => ({ ...p, dealershipId: e.target.value }))}
                      className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none"
                    >
                      {DEALERSHIPS.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-[#9DB0C6] mt-0.5">This stock will only appear on this dealer's own website and inventory.</p>
                  </div>

                  {/* Specification grid panel */}
                  <div className="bg-[#15C7C0]/5 border border-[#15C7C0]/15 rounded-xl p-4 flex flex-col gap-3">
                    <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-[#15C7C0]">Showroom Vehicle Specifications</span>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Year</label>
                        <input
                          type="number"
                          value={newVehicleForm.year}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, year: parseInt(e.target.value) || 2026 }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Make</label>
                        <input
                          type="text"
                          value={newVehicleForm.make}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, make: e.target.value }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Model</label>
                        <input
                          type="text"
                          value={newVehicleForm.model}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, model: e.target.value }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Trim Level</label>
                        <input
                          type="text"
                          value={newVehicleForm.trim}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, trim: e.target.value }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Engine</label>
                        <input
                          type="text"
                          value={newVehicleForm.engine}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, engine: e.target.value }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Transmission</label>
                        <select
                          value={newVehicleForm.transmission}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, transmission: e.target.value as any }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                        >
                          <option className="bg-[#0f1826]" value="Automatic">Automatic</option>
                          <option className="bg-[#0f1826]" value="Manual">Manual</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Fuel Type</label>
                        <select
                          value={newVehicleForm.fuelType}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, fuelType: e.target.value as any }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                        >
                          <option className="bg-[#0f1826]" value="Diesel">Diesel</option>
                          <option className="bg-[#0f1826]" value="Petrol">Petrol</option>
                          <option className="bg-[#0f1826]" value="Hybrid">Hybrid</option>
                          <option className="bg-[#0f1826]" value="Electric">Electric</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Body Type</label>
                        <input
                          type="text"
                          value={newVehicleForm.bodyType}
                          onChange={(e) => setNewVehicleForm((p) => ({ ...p, bodyType: e.target.value }))}
                          className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Retail specs */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#9DB0C6] uppercase font-semibold">Retail Price (ZAR)</label>
                      <input
                        type="number"
                        value={newVehicleForm.retailPrice}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, retailPrice: parseFloat(e.target.value) || 0 }))}
                        className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#9DB0C6] uppercase font-semibold">Cost Price (ZAR)</label>
                      <input
                        type="number"
                        value={newVehicleForm.costPrice}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, costPrice: parseFloat(e.target.value) || 0 }))}
                        className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#9DB0C6] uppercase font-semibold">Mileage (km)</label>
                      <input
                        type="number"
                        value={newVehicleForm.mileage}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, mileage: parseInt(e.target.value) || 0 }))}
                        className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#9DB0C6] uppercase font-semibold">Stock Number</label>
                      <input
                        type="text"
                        value={newVehicleForm.stockNumber}
                        onChange={(e) => setNewVehicleForm((p) => ({ ...p, stockNumber: e.target.value }))}
                        className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="bg-[#15C7C0]/8 border border-[#15C7C0]/25 rounded-xl p-4 flex flex-col gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-[#15C7C0] flex items-center gap-1.5">
                      <Camera size={12} /> Photos live in TruLens only
                    </span>
                    <p className="text-[11px] text-[#9DB0C6] leading-relaxed">
                      After you save this unit, open <b className="text-[#E8EEF6]">TruLens</b>, shoot the guided slots for stock{" "}
                      <span className="font-mono text-[#15C7C0]">{newVehicleForm.stockNumber}</span>, then tap{" "}
                      <b className="text-[#E8EEF6]">Export to DMS</b>. Gallery appears here automatically.
                    </p>
                    <button
                      type="button"
                      onClick={() => openTruLens(newVehicleForm.stockNumber)}
                      className="self-start mt-1 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[#15C7C0]/15 text-[#15C7C0] border border-[#15C7C0]/30 hover:bg-[#15C7C0]/25"
                    >
                      Open TruLens for this stock #
                    </button>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#9DB0C6] uppercase font-semibold">Description</label>
                    <textarea
                      rows={3}
                      value={newVehicleForm.description}
                      onChange={(e) => setNewVehicleForm((p) => ({ ...p, description: e.target.value }))}
                      className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none font-sans"
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
        {activeSection === "leads" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Lead CRM Pipeline</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Evaluate web-leads and showroom walk-in traffic</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterOverdueOnly(!filterOverdueOnly)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
                    filterOverdueOnly
                      ? "bg-[#F0555A]/15 border-[#F0555A]/30 text-[#F0555A]"
                      : "bg-[#0f1826]/3 border-white/5 text-[#9DB0C6] hover:text-[#E8EEF6]"
                  }`}
                >
                  {filterOverdueOnly ? "Show All Leads" : "Flag Overdue Leads"}
                </button>
                <button 
                  onClick={handleAutoAssign} 
                  disabled={isAutoAssigning || (state?.leads.filter(l => l.status === "New").length === 0)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-purple-500/10 ${
                    isAutoAssigning || (state?.leads.filter(l => l.status === "New").length === 0)
                      ? "bg-[#0f1826]/3 border-white/5 text-[#9DB0C6] cursor-not-allowed"
                      : "bg-[#22d3ee]/15 border-[#22d3ee]/30 text-[#67e8f9] hover:bg-[#22d3ee]/25 hover:border-[#22d3ee]/50"
                  }`}
                >
                  <Sparkles size={14} className={isAutoAssigning ? "animate-pulse" : ""} />
                  {isAutoAssigning ? "AI Agent Working..." : "AI Auto-Assign"}
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
                className={`text-xs font-bold transition-all border-b-2 pb-1.5 cursor-pointer ${
                  leadCrmTab === "kanban" ? "text-white border-[#15C7C0]" : "text-[#9DB0C6] border-transparent hover:text-[#E8EEF6]"
                }`}
              >
                Interactive Kanban Board
              </button>
              <button
                onClick={() => setLeadCRMTab("list")}
                className={`text-xs font-bold transition-all border-b-2 pb-1.5 cursor-pointer ${
                  leadCrmTab === "list" ? "text-white border-[#15C7C0]" : "text-[#9DB0C6] border-transparent hover:text-[#E8EEF6]"
                }`}
              >
                Detailed Grid View
              </button>
            </div>

            {leadCrmTab === "kanban" ? (
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
                {["New", "Contacted", "Test Drive Scheduled", "Negotiating", "Closed Won", "Closed Lost"].map((stage) => {
                  const filteredLeads = state.leads.filter((l) => {
                    const statusMatch = l.status === stage;
                    const overdueMatch = !filterOverdueOnly || (l.status === "New" || !l.lastContactedAt);
                    return statusMatch && overdueMatch;
                  });

                  return (
                    <div key={stage} className="flex-1 min-w-[220px] max-w-[280px] bg-[#0f1826]/2 rounded-xl p-3 flex flex-col gap-3 min-h-[460px] border border-white/5">
                      <div className="flex justify-between items-center border-b border-white/5 pb-1">
                        <span className="text-[10px] font-bold text-[#9DB0C6] uppercase font-mono tracking-wider">{stage}</span>
                        <span className="px-2 py-0.5 bg-[#0f1826]/5 rounded-full text-[9px] font-bold text-[#9DB0C6]">{filteredLeads.length}</span>
                      </div>
                      <div className="flex-1 flex flex-col gap-2.5">
                        {filteredLeads.map((l) => (
                          <div
                            key={l.id}
                            onClick={() => setLeadDetailId(l.id)}
                            className="pipeline-card p-3 flex flex-col gap-1 cursor-pointer transition-all hover:-translate-y-0.5 active:scale-98"
                          >
                            <div className="flex justify-between items-start">
                              <div className="font-bold text-xs text-[#E8EEF6]">{l.firstName} {l.lastName}</div>
                              {l.digitalScore >= 80 ? (
                                <span className="bg-[#F0555A]/15 text-[#F0555A] text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border border-[#F0555A]/20">Hot</span>
                              ) : l.digitalScore >= 50 ? (
                                <span className="bg-[#C9A24B]/15 text-[#C9A24B] text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border border-[#C9A24B]/20">Warm</span>
                              ) : (
                                <span className="bg-[#9DB0C6]/15 text-[#9DB0C6] text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider border border-[#9DB0C6]/20">Cold</span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#9DB0C6] truncate">{getVehicleLabel(l.vehicleId)}</div>
                            <div className="text-[9px] text-[#9DB0C6] mt-1 font-mono">Origin: {l.source}</div>
                            
                            <div className="flex justify-between items-center border-t border-white/3 pt-2 mt-2 gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[#15C7C0] font-bold">Intent: {l.digitalScore}%</span>
                              </div>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {l.phone && (
                                  <button
                                    type="button"
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30"
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
                                <span className={`w-1.5 h-1.5 rounded-full ${l.lastContactedAt ? "bg-[#35C46B] shadow-[0_0_6px_#35C46B]" : "bg-[#F0555A] shadow-[0_0_6px_#F0555A]"}`}></span>
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
                  <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-white/5 text-[#9DB0C6] uppercase tracking-wider text-[9px] bg-[#0f1826]/1">
                        <th className="py-2.5 px-4 font-bold">Customer Name</th>
                        <th className="py-2.5 px-4 font-bold">Focus Asset</th>
                        <th className="py-2.5 px-4 font-bold">Origin</th>
                        <th className="py-2.5 px-4 font-bold">CRM Status</th>
                        <th className="py-2.5 px-4 font-bold">Agent assigned</th>
                        <th className="py-2.5 px-4 font-bold text-right">Operation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.leads
                        .filter((l) => !filterOverdueOnly || (l.status === "New" || !l.lastContactedAt))
                        .map((l) => (
                          <tr key={l.id} className="border-b border-white/3 hover:bg-[#0f1826]/1">
                            <td className="py-3 px-4 font-black text-[#E8EEF6]">
                              {l.firstName} {l.lastName}
                              <span className="block text-[10px] font-normal text-[#9DB0C6] mt-0.5">{l.phone} / {l.email}</span>
                            </td>
                            <td className="py-3 px-4 font-semibold">{getVehicleLabel(l.vehicleId)}</td>
                            <td className="py-3 px-4">
                              <span className="px-1.5 py-0.5 bg-[#1466E0]/15 text-[#4D9BFF] rounded text-[9px] font-bold uppercase tracking-wider">
                                {l.source}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-1.5 py-0.5 bg-[#35C46B]/10 text-[#35C46B] rounded text-[9px] font-bold uppercase tracking-wider">
                                {l.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-[#9DB0C6]">{getUserLabel(l.assignedUserId)}</td>
                            <td className="py-3 px-4 text-right flex justify-end gap-1.5">
                              {l.phone && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const digits = String(l.phone).replace(/\D/g, "").replace(/^0/, "27");
                                    const interest = getVehicleLabel(l.vehicleId);
                                    const text = `Hi ${l.firstName}, following up from the dealership re ${interest}. When works for a chat?`;
                                    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, "_blank");
                                  }}
                                  className="px-2.5 py-1.5 bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 rounded-lg text-[10px] font-bold"
                                >
                                  WhatsApp
                                </button>
                              )}
                              <button
                                onClick={() => setLeadDetailId(l.id)}
                                className="px-4 py-1.5 bg-[#1466E0] hover:bg-[#1466E0]/90 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all shadow-md active:scale-95"
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
              <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Advanced AI Lead Scoring</h1>
              <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Evaluate intent and prioritization indices</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Hot Targets</div>
                <div className="text-2xl font-serif font-black text-[#F0555A] mt-1">
                  {state.leads.filter((l) => l.digitalScore >= 75).length}
                </div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">High purchase velocity</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Warm prospects</div>
                <div className="text-2xl font-serif font-black text-[#E7B24B] mt-1">
                  {state.leads.filter((l) => l.digitalScore >= 50 && l.digitalScore < 75).length}
                </div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">Nurturing schedule</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Cold prospects</div>
                <div className="text-2xl font-serif font-black text-[#9DB0C6] mt-1">
                  {state.leads.filter((l) => l.digitalScore < 50).length}
                </div>
                <div className="text-[10px] text-[#9DB0C6] font-semibold mt-1">Inactive page views</div>
              </div>
              <div className="stat-card p-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Average Digital Index</div>
                <div className="text-2xl font-serif font-black text-[#15C7C0] mt-1">
                  {Math.round(state.leads.reduce((sum, l) => sum + l.digitalScore, 0) / state.leads.length)}%
                </div>
                <div className="text-[10px] text-[#35C46B] font-semibold mt-1">Strong digital engagement</div>
              </div>
            </div>

            {/* Matrix Card table */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-sm">Active Scoring Matrix</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[#9DB0C6] uppercase tracking-wider text-[9px] bg-[#0f1826]/1">
                      <th className="py-2.5 px-4 font-bold">Prospect</th>
                      <th className="py-2.5 px-4 font-bold">Intent Score</th>
                      <th className="py-2.5 px-4 font-bold">Rating Level</th>
                      <th className="py-2.5 px-4 font-bold">Source</th>
                      <th className="py-2.5 px-4 font-bold">Current Vehicle focus</th>
                      <th className="py-2.5 px-4 font-bold text-right">Prioritization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.leads.map((l) => {
                      const hot = l.digitalScore >= 75;
                      const warm = l.digitalScore >= 50 && l.digitalScore < 75;
                      return (
                        <tr key={l.id} className="border-b border-white/3 hover:bg-[#0f1826]/1">
                          <td className="py-3 px-4 font-black text-[#E8EEF6]">{l.firstName} {l.lastName}</td>
                          <td className="py-3 px-4 font-mono font-bold text-[#15C7C0] text-sm">{l.digitalScore}%</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              hot ? "bg-[#F0555A]/15 text-[#F0555A]" : warm ? "bg-[#E7B24B]/15 text-[#E7B24B]" : "bg-[#1466E0]/15 text-[#4D9BFF]"
                            }`}>
                              {hot ? "Hot Target" : warm ? "Warm Prospect" : "Cold Prospect"}
                            </span>
                          </td>
                          <td className="py-3 px-4">{l.source}</td>
                          <td className="py-3 px-4 font-semibold text-[#9DB0C6]">{getVehicleLabel(l.vehicleId)}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => setLeadDetailId(l.id)}
                              className="px-4 py-1.5 bg-[#1466E0] hover:bg-[#1466E0]/90 text-white transition-all font-bold rounded-lg text-[10px] cursor-pointer shadow-lg shadow-[#1466E0]/20 active:scale-95"
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
        {activeSection === "documents" && (
          <DocumentsHub
            documents={filteredDocuments}
            getLeadLabel={getLeadLabel}
            getVehicleLabel={getVehicleLabel}
            onUpload={handleUploadDocument}
            onSign={handleSignDocument}
            onDelete={handleDeleteDocument}
          />
        )}

        {activeSection === "invoices" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div className="flex justify-between items-center gap-4">
              <div>
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Invoices & Billings</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Track accounts receivable and sales transactions</p>
              </div>
              <button onClick={() => setIsInvoiceModalOpen(true)} className="btn btn-primary">
                + Draft Invoice
              </button>
            </div>

            {/* Invoices list */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-sm">Invoice Database Folder</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[#9DB0C6] uppercase tracking-wider text-[9px] bg-[#0f1826]/1">
                      <th className="py-2.5 px-4 font-bold">Reference No</th>
                      <th className="py-2.5 px-4 font-bold">Prospect Bill To</th>
                      <th className="py-2.5 px-4 font-bold">Associated stock</th>
                      <th className="py-2.5 px-4 font-bold">Total Amount</th>
                      <th className="py-2.5 px-4 font-bold">Status</th>
                      <th className="py-2.5 px-4 font-bold">Due Date</th>
                      <th className="py-2.5 px-4 font-bold text-right">Operation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-white/3 hover:bg-[#0f1826]/1">
                        <td className="py-3 px-4 font-mono font-bold text-[#E8EEF6]">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 font-semibold">{getLeadLabel(inv.leadId)}</td>
                        <td className="py-3 px-4">{getVehicleLabel(inv.vehicleId)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#4D9BFF]">
                          {formatZAR(inv.amount + (inv.additionalCharges || 0))}
                          {inv.additionalCharges ? <span className="text-[9px] text-[#9DB0C6] block">{inv.chargeDescription}</span> : null}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            inv.status === "Paid" ? "bg-[#35C46B]/15 text-[#35C46B]" : "bg-[#1466E0]/15 text-[#4D9BFF]"
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold">{inv.dueDate}</td>
                        <td className="py-3 px-4 text-right flex justify-end gap-1.5">
                          <button
                            onClick={() => setActiveInvoiceId(inv.id)}
                            className="px-4 py-1.5 bg-[#1466E0] hover:bg-[#1466E0]/90 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-md active:scale-95 transition-all"
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
                              className="px-4 py-1.5 bg-[#35C46B] hover:bg-[#35C46B]/90 text-white rounded-lg text-[10px] font-bold cursor-pointer shadow-md active:scale-95 transition-all"
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
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Executed Deal Agreements</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Digital sign-off deed folder for secure contracting</p>
              </div>
              <button onClick={() => setIsAgreementModalOpen(true)} className="btn btn-primary">
                + Start New Contract
              </button>
            </div>

            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-sm">Executed Sale Contracts</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[#9DB0C6] uppercase tracking-wider text-[9px] bg-[#0f1826]/1">
                      <th className="py-2.5 px-4 font-bold">Agreement ID</th>
                      <th className="py-2.5 px-4 font-bold">Contract classification</th>
                      <th className="py-2.5 px-4 font-bold">Customer account</th>
                      <th className="py-2.5 px-4 font-bold">Subject Stock</th>
                      <th className="py-2.5 px-4 font-bold">Value</th>
                      <th className="py-2.5 px-4 font-bold">Signature Status</th>
                      <th className="py-2.5 px-4 text-right font-bold">Operation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.agreements.map((agr) => (
                      <tr key={agr.id} className="border-b border-white/3 hover:bg-[#0f1826]/1">
                        <td className="py-3 px-4 font-mono font-bold text-[#E8EEF6]">{agr.agreementNumber}</td>
                        <td className="py-3 px-4 font-semibold">{agr.type}</td>
                        <td className="py-3 px-4">{getLeadLabel(agr.leadId)}</td>
                        <td className="py-3 px-4">{getVehicleLabel(agr.vehicleId)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#4D9BFF]">{formatZAR(agr.purchasePrice)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            agr.status === "Signed" || agr.status === "Completed" ? "bg-[#35C46B]/15 text-[#35C46B]" : "bg-[#E7B24B]/15 text-[#E7B24B]"
                          }`}>
                            {agr.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setActiveAgreementId(agr.id)}
                            className="px-3 py-1.5 bg-[#1466E0] hover:bg-[#1466E0]/90 text-white rounded text-[10px] font-bold cursor-pointer active:scale-95 transition-all shadow-md shadow-[#1466E0]/20"
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
            <AccountingRecon
              state={state}
              onAddExpense={handleCreateExpense}
              onReconcileExpense={handleReconcileExpense}
              onUpdateVehicle={handleUpdateVehicle}
            />
          </div>
        )}


        {/* CUSTOMER FORM SECTION */}
        {activeSection === "customer_form" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Customer Lead Capture</h1>
              <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Use this form for remote customer registration.</p>
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
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Showroom Tasks</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Configure daily operational checklists & reconditioning items</p>
              </div>
              <button onClick={() => setIsTaskModalOpen(true)} className="btn btn-primary">
                + Log Directive Task
              </button>
            </div>

            {/* Checklist records */}
            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-sm">Showroom Tasks</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[#9DB0C6] uppercase tracking-wider text-[9px] bg-[#0f1826]/1">
                      <th className="py-2.5 px-4 font-bold">Showroom Directive</th>
                      <th className="py-2.5 px-4 font-bold">Priority</th>
                      <th className="py-2.5 px-4 font-bold">Assigned Specialist</th>
                      <th className="py-2.5 px-4 font-bold">Due Date</th>
                      <th className="py-2.5 px-4 font-bold">Processing status</th>
                      <th className="py-2.5 px-4 text-right font-bold">Operation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.tasks.map((t) => (
                      <tr key={t.id} className="border-b border-white/3 hover:bg-[#0f1826]/1">
                        <td className="py-3 px-4">
                          <span className="font-black text-[#E8EEF6] block">{t.title}</span>
                          <span className="text-[10px] text-[#9DB0C6] block mt-0.5">
                            Focus: {getVehicleLabel(t.vehicleId || "")} / Lead: {getLeadLabel(t.leadId || "")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            t.priority === "Urgent" ? "bg-[#F0555A]/15 text-[#F0555A]" : t.priority === "High" ? "bg-[#E7B24B]/15 text-[#E7B24B]" : "bg-[#1466E0]/15 text-[#4D9BFF]"
                          }`}>
                            {t.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#9DB0C6]">{getUserLabel(t.assignedUserId)}</td>
                        <td className="py-3 px-4">{t.dueDate}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            t.status === "Completed" ? "bg-[#35C46B]/15 text-[#35C46B]" : "bg-[#1466E0]/15 text-[#4D9BFF]"
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
                              className="px-2.5 py-1.5 bg-[#35C46B]/10 hover:bg-[#35C46B]/20 text-[#35C46B] rounded text-[10px] font-bold cursor-pointer active:scale-95 transition-all"
                            >
                              Resolve
                            </button>
                          ) : (
                            <span className="text-[#35C46B] font-bold text-xs">Resolved</span>
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
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Team & Performance</h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Salesperson catalog metrics & access configurations</p>
              </div>
              <button onClick={() => setIsUserModalOpen(true)} className="btn btn-primary">
                + Register User
              </button>
            </div>

            {/* Sales reps card rosters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {state.users.map((u) => {
                const leadsAssigned = state.leads.filter((l) => l.assignedUserId === u.id).length;
                const dealsCompleted = state.leads.filter((l) => l.assignedUserId === u.id && l.status === "Closed Won").length;
                return (
                  <div key={u.id} className="card p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#1466E0] to-[#15C7C0] flex items-center justify-center font-bold text-xs text-white">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-[#E8EEF6]">{u.name}</div>
                        <div className="text-[10px] text-[#9DB0C6] uppercase font-mono tracking-wider">{u.role}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mt-1">
                      <div className="bg-[#0f1826]/2 border border-white/5 rounded p-1.5">
                        <div className="text-sm font-black text-white">{leadsAssigned}</div>
                        <div className="text-[8px] text-[#9DB0C6] uppercase font-bold tracking-wider mt-0.5">Leads</div>
                      </div>
                      <div className="bg-[#0f1826]/2 border border-white/5 rounded p-1.5">
                        <div className="text-sm font-black text-white">{dealsCompleted}</div>
                        <div className="text-[8px] text-[#9DB0C6] uppercase font-bold tracking-wider mt-0.5">Sales</div>
                      </div>
                      <div className="bg-[#0f1826]/2 border border-white/5 rounded p-1.5">
                        <div className="text-sm font-black text-white">{u.isActive ? "Online" : "Away"}</div>
                        <div className="text-[8px] text-[#9DB0C6] uppercase font-bold tracking-wider mt-0.5">Status</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Commission Estimation Engine */}
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
                <h3 className="font-semibold text-sm">System Access Roster</h3>
              </div>
              <div className="card-body p-0 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[#9DB0C6] uppercase tracking-wider text-[9px] bg-[#0f1826]/1">
                      <th className="py-2.5 px-4 font-bold">Assigned Specialist</th>
                      <th className="py-2.5 px-4 font-bold">Email Node</th>
                      <th className="py-2.5 px-4 font-bold">System Role</th>
                      <th className="py-2.5 px-4 font-bold">Contact Number</th>
                      <th className="py-2.5 px-4 font-bold">Access permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.users.map((u) => (
                      <tr key={u.id} className="border-b border-white/3 hover:bg-[#0f1826]/1">
                        <td className="py-3 px-4 font-black text-[#E8EEF6]">{u.name}</td>
                        <td className="py-3 px-4 font-semibold">{u.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            u.role === "admin" ? "bg-[#F0555A]/15 text-[#F0555A]" : "bg-[#1466E0]/15 text-[#4D9BFF]"
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#9DB0C6]">{u.phone}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 bg-[#35C46B]/15 text-[#35C46B] rounded text-[8px] font-bold uppercase tracking-wider">
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
              <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Dealer Installment Calculator</h1>
              <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">Model lease structures & monthly amortization schedules</p>
            </div>
            <AmortizationCalc initialPrice={state.vehicles[0]?.retailPrice || 485000} />
          </div>
        )}

        {/* WORDPRESS & WEB SYNC MODULE */}
        {activeSection === "integration" && (
          <WordPressIntegration onRefresh={loadAllState} />
        )}

        {/* STOCK MEDIA HUB — gallery only; capture lives in TruLens */}
        {activeSection === "media_web" && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200 pt-6 md:pt-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6] flex items-center gap-2">
                  <Image size={24} className="text-[#15C7C0]" /> Stock media & web readiness
                </h1>
                <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium max-w-xl">
                  Premium stores gallery + publish evidence. Capture is <b className="text-[#E8EEF6]">only in TruLens</b>.
                  Pipeline: Shoot → Export to DMS → refresh here → website feed.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openTruLens()}
                className="btn btn-primary text-xs font-bold flex items-center gap-2 px-4 py-2.5"
              >
                <Camera size={14} /> Open TruLens capture
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#9DB0C6] font-bold">With photos</div>
                <div className="text-2xl font-black text-[#15C7C0] mt-1">
                  {filteredVehicles.filter(v => (v.images?.length || 0) > 0).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#9DB0C6] font-bold">Need shoot</div>
                <div className="text-2xl font-black text-[#E7B24B] mt-1">
                  {filteredVehicles.filter(v => computeDmsGalleryReadiness(v).level === "capture").length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#9DB0C6] font-bold">Web-ready gallery</div>
                <div className="text-2xl font-black text-[#4D9BFF] mt-1">
                  {filteredVehicles.filter(v => computeDmsGalleryReadiness(v).webReady).length}
                </div>
              </div>
              <div className="card p-4">
                <div className="text-[10px] uppercase tracking-wider text-[#9DB0C6] font-bold">Public stock feed</div>
                <a
                  className="text-[11px] text-[#4D9BFF] font-mono mt-2 block break-all hover:underline"
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
                    <div className="aspect-[16/10] bg-[#0f1b29] relative">
                      {r.photoCount > 0 ? (
                        <img src={v.images![0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-[#5F7590] gap-2">
                          <Camera size={28} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">No gallery yet</span>
                        </div>
                      )}
                      <span
                        className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded border"
                        style={{ color: r.color, borderColor: r.color + "55", background: r.color + "22" }}
                        title={r.reasons.join(" · ")}
                      >
                        {r.label}
                      </span>
                      {r.photoCount > 0 && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold px-2 py-0.5 rounded bg-black/50 text-white">
                          {r.photoCount} photos
                        </span>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div>
                        <div className="text-sm font-bold text-[#E8EEF6]">{v.year} {v.make} {v.model}</div>
                        <div className="text-[10px] text-[#9DB0C6] font-mono">{v.stockNumber}</div>
                      </div>
                      <div className="text-[10px] text-[#9DB0C6]">
                        {(v as any).lastPhotoSync
                          ? `Last TruLens sync ${new Date((v as any).lastPhotoSync).toLocaleString()}`
                          : "Not synced from TruLens yet"}
                      </div>
                      {r.reasons[0] && (
                        <div className="text-[9px] text-[#E7B24B]/90">{r.reasons[0]}</div>
                      )}
                      <div className="mt-auto flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary text-[10px] flex-1"
                          onClick={() => setSelectedDetailVehicle(v)}
                        >
                          Open stock card
                        </button>
                        <button
                          type="button"
                          onClick={() => openTruLens(v.stockNumber)}
                          className="btn btn-primary text-[10px] flex items-center justify-center gap-1 px-3"
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
              <h1 className="font-sans text-2xl font-black tracking-tight text-[#E8EEF6]">Dealer settings & integrations</h1>
              <p className="text-xs text-[#9DB0C6] mt-0.5 font-medium">
                {PRODUCT_NAME} — stock, CRM, media hub, full finance & website embeds
              </p>
            </div>

            {/* Integration URLs + website kit */}
            <div className="card border-[#1466E0]/30">
              <div className="card-header border-b border-white/5 px-5 py-3">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Code size={14} className="text-[#4D9BFF]" /> TruLens & website wiring
                </h3>
              </div>
              <div className="card-body p-5 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#9DB0C6] tracking-wider">TruLens URL</span>
                    <input
                      value={trulensUrlInput}
                      onChange={(e) => setTrulensUrlInput(e.target.value)}
                      placeholder="http://localhost:3000 or https://… tunnel"
                      className="bg-[#0f1826] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] font-mono"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#9DB0C6] tracking-wider">Dealer slug (public stock)</span>
                    <input
                      value={dealerSlugInput}
                      onChange={(e) => setDealerSlugInput(e.target.value)}
                      placeholder="mkr-autosales"
                      className="bg-[#0f1826] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] font-mono"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[9px] uppercase font-bold text-[#9DB0C6] tracking-wider">Sales WhatsApp</span>
                    <input
                      value={waNumberInput}
                      onChange={(e) => setWaNumberInput(e.target.value)}
                      placeholder="2766… (country code, no +)"
                      className="bg-[#0f1826] border border-white/10 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] font-mono"
                    />
                  </label>
                </div>
                <p className="text-[10px] text-[#9DB0C6] leading-relaxed">
                  Phone demo: run TruLens behind <b className="text-[#E8EEF6]">HTTPS</b> (e.g. cloudflared tunnel), paste that URL here, then Install PWA on the phone.
                  Full checklist: <span className="font-mono text-[#4D9BFF]">PRODUCTION.md</span> in the TruSaaS folder.
                </p>
                <button
                  type="button"
                  className="btn btn-primary self-start text-xs font-bold"
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
                  <div className="text-[9px] uppercase font-bold text-[#9DB0C6] tracking-wider mb-1">Website stock widget (copy for web person)</div>
                  <pre className="text-[10px] bg-black/50 border border-white/10 rounded-xl p-3 overflow-x-auto text-[#9DB0C6] font-mono whitespace-pre-wrap">
                    {stockWidgetSnippet(window.location.origin)}
                  </pre>
                  <button
                    type="button"
                    className="mt-2 text-[10px] font-bold text-[#4D9BFF] hover:underline"
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
            
            <div className="card border-[#15C7C0]/30 bg-gradient-to-br from-[#0a1420] via-[#0d1c2e] to-[#070e18]">
              <div className="card-header border-b border-white/5 px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Sparkles size={16} className="text-[#15C7C0] animate-pulse" />
                    TruFlow Premium
                  </h3>
                  <p className="text-[10px] text-[#9DB0C6] mt-0.5">Full DMS · media hub · recon · website feed · TruLens export</p>
                </div>
                <span className="px-3 py-1 bg-[#15C7C0]/15 text-[#15C7C0] border border-[#15C7C0]/30 rounded-full text-[9px] font-black tracking-widest uppercase">
                  Premium
                </span>
              </div>
              <div className="card-body p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 bg-[#0f1826]/2 border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] border border-[#15C7C0]/20">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#E8EEF6] block">Dealer Website & Basic Portal</span>
                    <span className="text-[10px] text-[#9DB0C6] mt-0.5 block">Full inventory showcase on your custom front-end portal www.trusaas.co.za.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0f1826]/2 border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] border border-[#15C7C0]/20">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#E8EEF6] block">Full DMS & CRM Logic</span>
                    <span className="text-[10px] text-[#9DB0C6] mt-0.5 block">Integrated Lead CRM, Lead scoring pipelines, tasks and automated AI lead assignments.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0f1826]/2 border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] border border-[#15C7C0]/20">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#E8EEF6] block">TrueAI VIR & Image Studio</span>
                    <span className="text-[10px] text-[#9DB0C6] mt-0.5 block">Generates automated visual inspection reports (VIR) and optimizes vehicle images using neural nets.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0f1826]/2 border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] border border-[#15C7C0]/20">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#E8EEF6] block">Smart Ledger & Recon</span>
                    <span className="text-[10px] text-[#9DB0C6] mt-0.5 block">Automated expense matching and real-time reconciliation logs with dealer capital ledger.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0f1826]/2 border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] border border-[#15C7C0]/20">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#E8EEF6] block">AI Chatbot Co-Pilot</span>
                    <span className="text-[10px] text-[#9DB0C6] mt-0.5 block">Customer-facing conversational agent on the showroom floor to answer dealer or visitor queries.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0f1826]/2 border border-white/5 rounded-xl p-4">
                  <div className="p-2 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] border border-[#15C7C0]/20">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#E8EEF6] block">SEO / AEO Engine</span>
                    <span className="text-[10px] text-[#9DB0C6] mt-0.5 block">Optimizes raw metadata, vehicle specifications, and pricing for Search and Answer Engines.</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#0f1826]/2 border border-white/5 rounded-xl p-4 md:col-span-2">
                  <div className="p-2 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] border border-[#15C7C0]/20">
                    <Check size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#E8EEF6] block">Portal Syndication & Sync API</span>
                    <span className="text-[10px] text-[#9DB0C6] mt-0.5 block">Real-time syndication endpoints for synchronizing stock with AutoTrader, Cars.co.za and WordPress.</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header border-b border-white/5 px-4 py-3">
                <h3 className="font-semibold text-sm">System Actions</h3>
              </div>
              <div className="card-body p-4 flex flex-col gap-3">
                <p className="text-xs text-[#9DB0C6]">
                  Trigger total showroom memory wipes or re-seed baseline parameters for demonstration purposes.
                </p>
                <div>
                  <button onClick={handleResetState} className="btn btn-primary bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-900/50 cursor-pointer">
                    Clear database cache & Re-Seed Defaults
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Side floating Copilot assistant chat widget */}
      <ChatWidget />
      
      {/* Website Chat Widget Simulation */}
      {(state.settings?.chatbot || state.settings?.liveReceptionist) && (
        <WebsiteChatWidget onLeadCapture={handleWebsiteLeadCapture} />
      )}

      {/* --- FORM MODALS --- */}

      {/* Log Lead Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-[#0f1826] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-black tracking-tight text-[#E8EEF6]">Log New Lead Entry</h3>
              <button onClick={() => setIsLeadModalOpen(false)} className="text-[#9DB0C6] hover:text-[#E8EEF6] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateLeadSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">First Name</label>
                  <input type="text" required value={newLeadForm.firstName} onChange={(e) => setNewLeadForm((p) => ({ ...p, firstName: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Last Name</label>
                  <input type="text" required value={newLeadForm.lastName} onChange={(e) => setNewLeadForm((p) => ({ ...p, lastName: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Phone</label>
                  <input type="text" required value={newLeadForm.phone} onChange={(e) => setNewLeadForm((p) => ({ ...p, phone: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Email</label>
                  <input type="email" required value={newLeadForm.email} onChange={(e) => setNewLeadForm((p) => ({ ...p, email: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Select vehicle</label>
                <select value={newLeadForm.vehicleId} onChange={(e) => setNewLeadForm((p) => ({ ...p, vehicleId: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                  {state.vehicles.map((v) => (
                    <option key={v.id} className="bg-[#0f1826]" value={v.id}>{v.year} {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Ad Source</label>
                <select value={newLeadForm.source} onChange={(e) => setNewLeadForm((p) => ({ ...p, source: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                  <option className="bg-[#0f1826]" value="Website">Website Form</option>
                  <option className="bg-[#0f1826]" value="Walk-in">Walk-in Showroom</option>
                  <option className="bg-[#0f1826]" value="Facebook">Facebook Lead Gen</option>
                  <option className="bg-[#0f1826]" value="AutoTrader">AutoTrader Portal</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Initial Requirement notes</label>
                <textarea rows={2} value={newLeadForm.notes} onChange={(e) => setNewLeadForm((p) => ({ ...p, notes: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6] font-sans"></textarea>
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
          <div className="bg-[#0f1826] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-black tracking-tight text-[#E8EEF6]">Draft Outbound Invoice</h3>
              <button onClick={() => setIsInvoiceModalOpen(false)} className="text-[#9DB0C6] hover:text-[#E8EEF6] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateInvoiceSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Link to Lead Account</label>
                <select value={newInvoiceForm.leadId} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, leadId: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                  {state.leads.map((l) => (
                    <option key={l.id} className="bg-[#0f1826]" value={l.id}>{l.firstName} {l.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Acquired Inventory</label>
                <select
                  value={newInvoiceForm.vehicleId}
                  onChange={(e) => {
                    const matchedVeh = state.vehicles.find((v) => v.id === e.target.value);
                    setNewInvoiceForm((p) => ({ ...p, vehicleId: e.target.value, amount: matchedVeh?.retailPrice || 0 }));
                  }}
                  className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans"
                >
                  {state.vehicles.map((v) => (
                    <option key={v.id} className="bg-[#0f1826]" value={v.id}>{v.year} {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Amount (ZAR)</label>
                  <input type="number" required value={newInvoiceForm.amount} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Due Date</label>
                  <input type="date" required value={newInvoiceForm.dueDate} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, dueDate: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] font-sans" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Finance Category</label>
                <select value={newInvoiceForm.paymentMethod} onChange={(e) => setNewInvoiceForm((p) => ({ ...p, paymentMethod: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                  <option className="bg-[#0f1826]" value="Bank Transfer">Direct EFT / Bank Transfer</option>
                  <option className="bg-[#0f1826]" value="Dealer Finance">Dealer Arranged Finance</option>
                  <option className="bg-[#0f1826]" value="Cash">Cash Payment</option>
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
          <div className="bg-[#0f1826] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-black tracking-tight text-[#E8EEF6]">Draft Sale Contract</h3>
              <button onClick={() => setIsAgreementModalOpen(false)} className="text-[#9DB0C6] hover:text-[#E8EEF6] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateAgreementSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Party Purchaser</label>
                <select value={newAgreementForm.leadId} onChange={(e) => setNewAgreementForm((p) => ({ ...p, leadId: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                  {state.leads.map((l) => (
                    <option key={l.id} className="bg-[#0f1826]" value={l.id}>{l.firstName} {l.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Subject Vehicle</label>
                <select
                  value={newAgreementForm.vehicleId}
                  onChange={(e) => {
                    const matchedVeh = state.vehicles.find((v) => v.id === e.target.value);
                    setNewAgreementForm((p) => ({ ...p, vehicleId: e.target.value, purchasePrice: matchedVeh?.retailPrice || 0 }));
                  }}
                  className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans"
                >
                  {state.vehicles.map((v) => (
                    <option key={v.id} className="bg-[#0f1826]" value={v.id}>{v.year} {v.make} {v.model}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Negotiated Price</label>
                  <input type="number" required value={newAgreementForm.purchasePrice} onChange={(e) => setNewAgreementForm((p) => ({ ...p, purchasePrice: parseFloat(e.target.value) || 0 }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Deposit amount</label>
                  <input type="number" required value={newAgreementForm.depositAmount} onChange={(e) => setNewAgreementForm((p) => ({ ...p, depositAmount: parseFloat(e.target.value) || 0 }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Contract Class</label>
                <select value={newAgreementForm.type} onChange={(e) => setNewAgreementForm((p) => ({ ...p, type: e.target.value as any }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                  <option className="bg-[#0f1826]" value="Vehicle Sale">Vehicle Purchase Deed</option>
                  <option className="bg-[#0f1826]" value="Deposit Hold">Securing Holding Deposit</option>
                  <option className="bg-[#0f1826]" value="Trade-In Transfer">Trade-In Exchange Agreement</option>
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
          <div className="bg-[#0f1826] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-black tracking-tight text-[#E8EEF6]">Create Task Assignment</h3>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-[#9DB0C6] hover:text-[#E8EEF6] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateTaskSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Task description header</label>
                <input type="text" required placeholder="e.g. Call client back with rates" value={newTaskForm.title} onChange={(e) => setNewTaskForm((p) => ({ ...p, title: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Associate Lead</label>
                  <select value={newTaskForm.leadId} onChange={(e) => setNewTaskForm((p) => ({ ...p, leadId: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                    <option className="bg-[#0f1826]" value="">None</option>
                    {state.leads.map((l) => (
                      <option key={l.id} className="bg-[#0f1826]" value={l.id}>{l.firstName} {l.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Associate Stock</label>
                  <select value={newTaskForm.vehicleId} onChange={(e) => setNewTaskForm((p) => ({ ...p, vehicleId: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                    <option className="bg-[#0f1826]" value="">None</option>
                    {state.vehicles.map((v) => (
                      <option key={v.id} className="bg-[#0f1826]" value={v.id}>{v.year} {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Assign to Rep</label>
                  <select value={newTaskForm.assignedUserId} onChange={(e) => setNewTaskForm((p) => ({ ...p, assignedUserId: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                    {state.users.map((u) => (
                      <option key={u.id} className="bg-[#0f1826]" value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Due Date Target</label>
                  <input type="date" required value={newTaskForm.dueDate} onChange={(e) => setNewTaskForm((p) => ({ ...p, dueDate: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] font-sans" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Priority Rating</label>
                  <select value={newTaskForm.priority} onChange={(e) => setNewTaskForm((p) => ({ ...p, priority: e.target.value as any }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                    <option className="bg-[#0f1826]" value="Normal">Normal</option>
                    <option className="bg-[#0f1826]" value="High">High</option>
                    <option className="bg-[#0f1826]" value="Urgent">Urgent</option>
                    <option className="bg-[#0f1826]" value="Low">Low</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Current State</label>
                  <select value={newTaskForm.status} onChange={(e) => setNewTaskForm((p) => ({ ...p, status: e.target.value as any }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                    <option className="bg-[#0f1826]" value="Pending">Pending Assignment</option>
                    <option className="bg-[#0f1826]" value="In Progress">In Progress</option>
                    <option className="bg-[#0f1826]" value="Completed">Completed</option>
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
          <div className="bg-[#0f1826] border border-white/10 rounded-2xl w-full max-w-[500px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-100 p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-sans text-lg font-black tracking-tight text-[#E8EEF6]">Register User Account</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-[#9DB0C6] hover:text-[#E8EEF6] cursor-pointer"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateUserSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Full Name</label>
                <input type="text" required placeholder="Aiden Fourie" value={newUserForm.name} onChange={(e) => setNewUserForm((p) => ({ ...p, name: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">E-mail Address</label>
                <input type="email" required placeholder="aiden@true-cars.co.za" value={newUserForm.email} onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E8EEF6]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Account Role</label>
                  <select value={newUserForm.role} onChange={(e) => setNewUserForm((p) => ({ ...p, role: e.target.value as any }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-[#E8EEF6] font-sans">
                    <option className="bg-[#0f1826]" value="salesperson">Salesperson</option>
                    <option className="bg-[#0f1826]" value="manager">Manager</option>
                    <option className="bg-[#0f1826]" value="admin">System Administrator</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Contact Number</label>
                  <input type="text" required placeholder="082 111 2222" value={newUserForm.phone} onChange={(e) => setNewUserForm((p) => ({ ...p, phone: e.target.value }))} className="bg-[#0f1826]/4 border border-white/5 rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6]" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create User Profile</button>
              </div>
            </form>
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
        />
      )}

      {selectedDetailVehicle && (
        <VehicleDetailModal
          vehicle={state.vehicles.find((v) => v.id === selectedDetailVehicle.id) || selectedDetailVehicle}
          isOpen={true}
          onClose={() => setSelectedDetailVehicle(null)}
          onUpdateVehicle={handleUpdateVehicle}
          settings={state.settings}
        />
      )}

      {/* EOD REPORT MODAL */}
      {showEODReport && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[220] flex items-center justify-center p-4">
          <div className="bg-[#070d15] border border-[#1466E0]/30 rounded-2xl w-full max-w-[620px] shadow-2xl relative font-sans animate-in zoom-in-95 duration-150 p-6 flex flex-col gap-6">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#15C7C0] animate-ping" />
                  <span className="text-[10px] font-black tracking-widest uppercase text-[#15C7C0] font-mono">Operations Report</span>
                </div>
                <h3 className="font-sans text-xl font-black tracking-tight text-[#E8EEF6] mt-1">End of Day (EOD) Summary</h3>
                <p className="text-[10px] text-[#9DB0C6] mt-0.5">{new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <button 
                onClick={() => setShowEODReport(false)} 
                className="p-1.5 rounded-lg bg-[#0f1826]/2 border border-white/5 text-[#9DB0C6] hover:text-[#E8EEF6] cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Daily Summary Metrics Block */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0f1826]/2 border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-[#9DB0C6] uppercase font-mono">Leads Worked</span>
                <span className="text-lg font-black text-white">12 Leads</span>
                <span className="text-[9px] text-[#35C46B]">Active response</span>
              </div>
              <div className="bg-[#0f1826]/2 border border-white/5 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-[#9DB0C6] uppercase font-mono">Cars Moved Today</span>
                <span className="text-lg font-black text-white">3 Units</span>
                <span className="text-[9px] text-[#35C46B]">Closed Won status</span>
              </div>
              <div className="bg-[#1466E0]/10 border border-[#1466E0]/20 rounded-xl p-3 flex flex-col gap-0.5">
                <span className="text-[9px] font-bold text-[#4D9BFF] uppercase font-mono">EOD Net Profit</span>
                <span className="text-lg font-black text-[#15C7C0]">R 185,000</span>
                <span className="text-[9px] text-[#22d3ee]">11.4% avg margin</span>
              </div>
            </div>

            {/* Financial and Recon Outlay Details */}
            <div className="bg-[#070d15] rounded-xl border border-white/5 p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs border-b border-white/3 pb-2.5">
                <span className="text-[#9DB0C6] font-medium">Reconditioning Expenditures</span>
                <span className="font-mono font-bold text-[#F0555A]">- R 18,500</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-white/3 pb-2.5">
                <span className="text-[#9DB0C6] font-medium">Gross Dealership Revenue</span>
                <span className="font-mono font-bold text-[#E8EEF6]">R 1,515,000</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#9DB0C6] font-medium">Unresolved Pending Invoices</span>
                <span className="font-mono font-bold text-[#E7B24B]">R {state.invoices.filter(i => i.status === 'Sent').reduce((sum, i) => sum + i.amount, 0).toLocaleString()}</span>
              </div>
            </div>

            {/* Daily Sold Vehicles Details */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#9DB0C6] font-mono px-1">Dealership Units Dispatched Today</span>
              <div className="flex flex-col gap-2">
                <div className="bg-[#0f1826]/2 border border-white/5 rounded-xl px-3 py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-[#E8EEF6] block">Toyota Hilux 2.8 GD-6 Legend</span>
                    <span className="text-[9px] text-[#9DB0C6] mt-0.5 block font-mono">Stock ID: CT-5112 | Closed by Aiden Fourie</span>
                  </div>
                  <span className="font-mono font-black text-[#15C7C0]">R 115,000 profit</span>
                </div>
                <div className="bg-[#0f1826]/2 border border-white/5 rounded-xl px-3 py-2.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-[#E8EEF6] block">Volkswagen Golf 8 GTI</span>
                    <span className="text-[9px] text-[#9DB0C6] mt-0.5 block font-mono">Stock ID: JHB-8319 | Closed by Sipho Dlamini</span>
                  </div>
                  <span className="font-mono font-black text-[#15C7C0]">R 70,000 profit</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-end gap-2.5 border-t border-[#1466E0]/20 pt-4">
              <button 
                type="button" 
                onClick={() => setShowEODReport(false)} 
                className="px-4 py-2 bg-[#0f1826]/5 hover:bg-white/10 rounded-xl text-xs font-semibold text-[#9DB0C6] hover:text-[#E8EEF6] cursor-pointer active:scale-95 transition-all text-center"
              >
                Close Report
              </button>
              
              <button 
                type="button" 
                onClick={() => {
                  addNotification("EOD Summary Dispatched", "The compiled daily operations summary has been securely emailed to dealers@real-cars.co.za and all stakeholders.", "info");
                  setShowEODReport(false);
                }} 
                className="px-4 py-2 bg-gradient-to-r from-[#1466E0]/15 to-[#1466E0]/30 border border-[#1466E0]/45 text-[#4D9BFF] hover:bg-[#1466E0]/40 rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 text-center"
              >
                📧 Email to Stakeholders
              </button>

              <button 
                type="button" 
                onClick={handleExportCSV} 
                className="px-4 py-2 bg-[#15C7C0] text-[#070d15] font-extrabold rounded-xl text-xs shadow-lg hover:bg-[#15C7C0]/90 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 text-center"
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
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl border backdrop-blur-xl animate-in slide-in-from-right-10 duration-500 flex flex-col gap-1.5 transition-all ${
              notif.type === 'warning' 
                ? 'bg-[#F59E0B]/20 border-[#F59E0B]/30 text-[#FBBF24]' 
                : 'bg-[#1466E0]/20 border-[#1466E0]/30 text-[#60A5FA]'
            }`}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className={notif.type === 'warning' ? "animate-pulse" : ""} />
                <span className="text-[10px] font-black uppercase tracking-[0.15em]">{notif.title}</span>
              </div>
              <button 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-white/30 hover:text-[#E8EEF6] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="text-xs font-medium leading-relaxed text-white/90 pr-2">
              {notif.message}
            </div>
            <div className="h-0.5 bg-[#0f1826]/10 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-current animate-progress-shrink origin-left" />
            </div>
          </div>
        ))}
        </div>
      </div>
    )
  );
}
