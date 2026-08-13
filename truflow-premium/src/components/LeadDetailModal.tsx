import React, { useState, useEffect, Suspense } from "react";
import { Lead, Vehicle, User, Communication, Task, Agreement } from "../types";
import { getAccount } from "../lib/session";
import { fetchState, updateLead, updateLeadStatus, deleteLead, createCommunication, createTask, updateTask, createInvoice, createAgreement, updateAgreement } from "../api";
import { X, Calendar, Phone, Mail, Award, MessageSquare, Plus, Clock, FileText, Send, CheckCircle, Wand2, Eye, ShoppingCart, Sparkles, AlertTriangle, TrendingUp, Smartphone, FileSignature } from "lucide-react";
import AgreementPreview from "./AgreementPreview";

interface LeadDetailModalProps {
  leadId: string;
  vehicles: Vehicle[];
  users: User[];
  allCommunications: Communication[];
  allTasks: Task[];
  onClose: () => void;
  onRefresh: () => void;
  /** Documents filed against this lead — the buyer's side of the paperwork. */
  documentsPanel?: React.ReactNode;
  /** DocHub stage-progression panel. Desktop-only — App.tsx passes
   *  `undefined` on mobile so the chunk never downloads. When undefined the
   *  Documents tab is not rendered. */
  docHubPanel?: React.ReactNode;
  /** Tab to open on first mount. Lets Deal Readiness deep-link straight into
   *  DocHub instead of forcing a second click through Overview. */
  initialTab?: "overview" | "journey" | "comm" | "history" | "tasks" | "finance" | "dochub";
}

export default function LeadDetailModal({
  leadId,
  vehicles,
  users,
  allCommunications,
  allTasks,
  onClose,
  onRefresh,
  documentsPanel,
  docHubPanel,
  initialTab,
}: LeadDetailModalProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  // Who is logged in — communications used to be stamped "Marc van der Merwe"
  // regardless of who sent them.
  const currentUserName = getAccount()?.label || "";

  /** Starting points the salesperson edits before sending. These replaced
   *  "Auto-Draft with TrueAI" buttons that called a stub returning the literal
   *  string "This is a mock AI response in the Lite version." — which went
   *  straight into the message body, ready to send to a customer. */
  const templates = {
    email: () =>
      `Hi ${lead.firstName},

` +
      `Thanks for your interest in the ${vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : "vehicle"}. ` +
      `It's still available and I'd be glad to answer any questions or arrange a time for you to come and see it.

` +
      `When would suit you?

` +
      `${currentUserName || ""}`.trim(),
    sms: () =>
      `Hi ${lead.firstName}, it's ${currentUserName || "the dealership"} — the ` +
      `${vehicle?.model || "car"} you asked about is still available. Want to come take a look?`.slice(0, 160),
    whatsapp: () =>
      `Hi ${lead.firstName} 👋 The ${vehicle ? `${vehicle.make} ${vehicle.model}` : "vehicle"} ` +
      `you enquired about is still available. Happy to send more photos or book you a viewing — what works for you?`,
  };
  const [activeTab, setActiveTab] = useState<"overview" | "journey" | "comm" | "history" | "tasks" | "finance" | "dochub">(initialTab || "overview");
  const tasks = allTasks.filter((t) => t.leadId === leadId);

  // Communication Form State
  const [commChannel, setCommChannel] = useState<"email" | "sms" | "whatsapp" | "call">("email");
  const [commTemplate, setCommTemplate] = useState("custom");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [smsBody, setSmsBody] = useState("");
  const [whatsappBody, setWhatsappBody] = useState("");
  const [callDuration, setCallDuration] = useState(120);
  const [callOutcome, setCallOutcome] = useState("Reached");
  const [callNotes, setCallNotes] = useState("");

  // Edit State
  const [leadStatus, setLeadStatus] = useState<string>("");
  const [crmSetupFee, setCrmSetupFee] = useState(false);

  // Task Form State
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"High" | "Normal" | "Low">("Normal");

  // Custom F&I Docs & e-Sign Workspace States
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const [docTypeToGenerate, setDocTypeToGenerate] = useState<"Offer to Purchase" | "Finance Application" | "Vehicle Sale">("Offer to Purchase");
  const [generatingDoc, setGeneratingDoc] = useState(false);

  // Custom Live WhatsApp Simulation States
  const [whatsappHistory, setWhatsappHistory] = useState<{ sender: "agent" | "customer"; text: string; time: string }[]>([]);
  const [aiGeneratingReply, setAiGeneratingReply] = useState(false);

  // Contact action log
  type ContactEntry = { leadId: string; channel: "call" | "whatsapp" | "email"; outcome?: string; note?: string; timestamp: string };
  const [contactLog, setContactLog] = useState<ContactEntry[]>([]);
  const [pendingAction, setPendingAction] = useState<{ leadId: string; channel: "call" | "whatsapp"; startedAt: number } | null>(null);
  const [logToast, setLogToast] = useState<{ channel: "call" | "whatsapp" } | null>(null);
  const [logOutcome, setLogOutcome] = useState("Connected");
  const [logNote, setLogNote] = useState("");

  // Visibility API: detect return from call/WhatsApp
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible" || !pendingAction) return;
      if (Date.now() - pendingAction.startedAt >= 3000) {
        setLogToast({ channel: pendingAction.channel });
        setLogOutcome("Connected");
        setLogNote("");
      }
      setPendingAction(null);
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [pendingAction]);

  const startContactAction = (channel: "call" | "whatsapp" | "email") => {
    if (channel === "email") {
      const subj = vehicle ? `Re: ${vehicle.year} ${vehicle.make} ${vehicle.model}` : "";
      window.open(`mailto:${lead?.email}?subject=${encodeURIComponent(subj)}`, "_self");
      setContactLog(prev => [...prev, { leadId, channel, timestamp: new Date().toISOString() }]);
      return;
    }
    const digits = (lead?.phone || "").replace(/\D/g, "");
    if (channel === "call") {
      window.location.href = `tel:${digits}`;
    } else {
      window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    }
    setPendingAction({ leadId, channel, startedAt: Date.now() });
  };

  const saveLogEntry = () => {
    if (!logToast) return;
    setContactLog(prev => [...prev, {
      leadId, channel: logToast.channel,
      outcome: logOutcome, note: logNote || undefined,
      timestamp: new Date().toISOString(),
    }]);
    setLogToast(null);
  };

  const loadLocalLead = () => {
    // This called `fetch("/api/state")` directly, bypassing the api helpers and
    // so sending no session token. It 401'd every time, `lead` stayed null, and
    // the early return below rendered nothing — clicking a lead did nothing at
    // all. Go through fetchState so the token is attached like everywhere else.
    fetchState()
      .then((state: any) => {
        const found = (state?.leads || []).find((l: Lead) => l.id === leadId);
        if (found) {
          setLead(found);
          setLeadStatus(found.status);
          
          // Setup initial mock messages for live WhatsApp simulator matching this specific customer
          setWhatsappHistory([
            { sender: "customer", text: `Hi there, I saw your ad for the ${vehicles.find(v => v.id === found.vehicleId)?.make || 'vehicle'}. Is it still available?`, time: "Yesterday 14:15" },
            { sender: "agent", text: "Good day! Yes, it is currently in our Sandton showroom. Are you available for a test drive Saturday morning?", time: "Yesterday 14:22" },
            { sender: "customer", text: "Thanks. Saturday morning works. Do you offer finance options or is it cash only?", time: "Yesterday 15:40" },
          ]);
        }
        if (state.agreements) {
          const filtered = state.agreements.filter((a: any) => a.leadId === leadId);
          setAgreements(filtered);
          if (filtered.length > 0 && !selectedAgreementId) {
            setSelectedAgreementId(filtered[0].id);
          }
        }
      });
  };

  useEffect(() => {
    loadLocalLead();
  }, [leadId]);

  if (!lead) return null;

  const vehicle = vehicles.find((v) => v.id === lead.vehicleId);
  const assignedUser = users.find((u) => u.id === lead.assignedUserId);
  const communications = allCommunications.filter((c) => c.leadId === lead.id);

  // Apply templates to fields
  const handleTemplateChange = (val: string) => {
    setCommTemplate(val);
    if (!lead || !vehicle) return;

    const carName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

    if (val === "welcome") {
      setEmailSubject(`Showroom Enquiry Verified — ${carName}`);
      setEmailBody(
        `Hi ${lead.firstName},\n\nThank you for reaching out regarding the immaculate ${carName} (Stock: ${vehicle.stockNumber}) listed at R ${vehicle.retailPrice.toLocaleString()}.\n\nThis vehicle is detailed and currently available for static inspection on our Sandton showroom floor. Are you available for a structured viewing and test drive Saturday morning?\n\nKind regards,\nSandton Pre-Owned Showrooms`
      );
      setSmsBody(`Hi ${lead.firstName}, following up on your ${carName} inquiry. Let us know if you want to book a drive! JHB Pre-Owned Showrooms.`);
      setWhatsappBody(`Good day ${lead.firstName}. Hope you are well. Regarding the ${carName}, let me know when is best to touch base to schedule a test drive session!`);
    } else if (val === "followup") {
      setEmailSubject(`Financing Quote Options — ${carName}`);
      setEmailBody(
        `Hi ${lead.firstName},\n\nFollowing up on our brief pricing discussion. I have prepared several pre-approval finance options for the ${carName}.\n\nLet me know if we can compile your credit documentation for formal submission to our finance houses.\n\nWarm regards,\nSandton Pre-Owned Showrooms`
      );
      setSmsBody(`Hi ${lead.firstName}, finance quotes are prepared for the ${carName}. Check your email or Whatsapp details. Thanks!`);
      setWhatsappBody(`Good day ${lead.firstName}. Just a quick check-in. The monthly installment amortization metrics for the ${carName} are drafted. Let me know when you can chat.`);
    } else if (val === "finance") {
      setEmailSubject(`Dealer Purchase Order Contract Draft — ${lead.lastName}`);
      setEmailBody(
        `Hi ${lead.firstName},\n\nFantastic news! Your credit application terms are pre-approved. I have drafted the Purchase and Sale Contract folder inside our central dealership system portal.\n\nPlease review and let me know if you would like me to assist with digital signature sign-off.\n\nRegards,\nSandton Pre-Owned Showrooms`
      );
      setSmsBody(`Good news ${lead.firstName}! Your credit limits are approved. Review the sale contract at your convenience. JHB Pre-Owned.`);
      setWhatsappBody(`Hi ${lead.firstName}, your financing terms are approved! I've uploaded the Sale Contract onto your profile. Let me know if you have questions.`);
    } else {
      setEmailSubject("");
      setEmailBody("");
      setSmsBody("");
      setWhatsappBody("");
    }
  };

  /**
   * Hand the message off to the app that can actually send it, then log it.
   *
   * Every channel here used to claim "Dispatched successfully over server
   * gateways!" while sending nothing — and WhatsApp went further, inventing a
   * customer reply 1.5 seconds later. A salesperson would see a sent message
   * and a response, and stop chasing a lead who had never heard from them.
   *
   * There is no send integration, so we don't pretend there is: WhatsApp opens
   * wa.me, email opens the mail client, SMS opens the messaging app. Logging
   * happens either way, so the history reflects what was composed.
   */
  const handleDispatchComm = async (e: React.FormEvent) => {
    e.preventDefault();
    let subject = "";
    let content = "";

    if (commChannel === "email") {
      subject = emailSubject || "Dealer Update Notification";
      content = emailBody;
    } else if (commChannel === "sms") {
      subject = "Outbound SMS";
      content = smsBody;
    } else if (commChannel === "whatsapp") {
      subject = "WhatsApp message";
      content = whatsappBody;
    } else if (commChannel === "call") {
      subject = `Voice Call — [${callOutcome}]`;
      content = `Duration: ${callDuration} seconds. Notes: ${callNotes || "None logged."}`;
    }

    if (!content) {
      alert("Please write the message first.");
      return;
    }

    const digits = (lead.phone || "").replace(/[^0-9]/g, "").replace(/^0/, "27");

    try {
      // A call is logged after the fact — there's nothing to hand off.
      if (commChannel !== "call") {
        let handoff = "";
        if (commChannel === "whatsapp") {
          handoff = `https://wa.me/${digits}?text=${encodeURIComponent(content)}`;
        } else if (commChannel === "email") {
          handoff = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(content)}`;
        } else {
          handoff = `sms:${lead.phone}?body=${encodeURIComponent(content)}`;
        }
        window.open(handoff, "_blank");
      }

      if (commChannel === "whatsapp") {
        setWhatsappHistory((prev) => [...prev, { sender: "agent", text: content, time: "Just now" }]);
        setWhatsappBody("");
      }

      await createCommunication({
        leadId: lead.id,
        type: commChannel,
        subject,
        content,
        sentBy: currentUserName || "Dealer",
      });

      onRefresh();
      if (commChannel !== "whatsapp") onClose();
    } catch (err) {
      alert("Could not log that message. It may not have been recorded.");
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;

    try {
      await createTask({
        title: newTaskTitle,
        leadId: lead.id,
        vehicleId: vehicle?.id || "",
        dueDate: newTaskDate || new Date().toISOString().slice(0, 10),
        priority: newTaskPriority,
        status: "Pending",
        assignedUserId: lead.assignedUserId,
      });
      alert("Follow-up task scheduled.");
      setNewTaskTitle("");
      setNewTaskDate("");
      setNewTaskPriority("Normal");
      onRefresh();
    } catch (err) {
      alert("Task scheduling failed.");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await updateTask(taskId, { status: "Completed" });
      onRefresh();
    } catch (err) {
      alert("Failed to complete task.");
    }
  };

  const handleSaveStatus = async () => {
    try {
      /* The car moves with the deal, but the server owns that rule — it is the
         only place every caller passes through, and the Light console and sync
         endpoints never run this file. Doing it here as well would race two
         writes on one JSON file and still leave those surfaces uncoupled. */
      const { coupledVehicle } = await updateLeadStatus(lead.id, leadStatus as any);
      alert(
        coupledVehicle?.status === "SOLD"
          ? "Deal closed — lead marked Closed Won and the vehicle marked Sold."
          : coupledVehicle?.status === "INVENTORY"
          ? "Lead reopened — the vehicle has been returned to inventory."
          : "Lead stage updated.",
      );

      onRefresh();
      onClose();
    } catch (err) {
      alert("Error saving lead details.");
    }
  };

  const handleDelete = async () => {
    if (confirm("Permanently delete and archive this lead file folder? This action is irreversible.")) {
      try {
        await deleteLead(lead.id);
        alert("Lead deleted from database registry.");
        onRefresh();
        onClose();
      } catch (err) {
        alert("Error deleting lead.");
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-[color:var(--ink-2)] border border-[rgba(138,162,184,0.22)] rounded-2xl w-full max-w-[720px] max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl relative font-sans animate-in zoom-in-95 duration-150">
        
        {/* Border strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-[color:var(--cyan)]"></div>

        {/* Header */}
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-b border-[rgba(138,162,184,0.1)]">
          <div>
            <span className="text-[13px] font-semibold text-[color:var(--cyan)]  tracking-widest font-mono">CRM Pipeline Lead Folder</span>
            <h3 className="font-serif text-lg font-semibold text-[color:var(--white)] mt-0.5">
              Customer File — {lead.firstName} {lead.lastName}
            </h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[rgba(138,162,184,0.1)] pb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-2 min-h-[44px] text-[13px] font-semibold rounded-t-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "overview"
                  ? "text-[color:var(--white)] bg-[color:var(--cyan-faint)] border-b-2 border-[color:var(--cyan)]"
                  : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/5"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("journey")}
              className={`px-3 py-2 min-h-[44px] text-[13px] font-semibold rounded-t-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "journey"
                  ? "text-[color:var(--white)] bg-[color:var(--cyan-faint)] border-b-2 border-[color:var(--cyan)]"
                  : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/5"
              }`}
            >
              Digital Journey Tracker
            </button>
            <button
              onClick={() => setActiveTab("comm")}
              className={`px-3 py-2 min-h-[44px] text-[13px] font-semibold rounded-t-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "comm"
                  ? "text-[color:var(--white)] bg-[color:var(--cyan-faint)] border-b-2 border-[color:var(--cyan)]"
                  : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/5"
              }`}
            >
              Automated Dispatches
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-2 min-h-[44px] text-[13px] font-semibold rounded-t-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "history"
                  ? "text-[color:var(--white)] bg-[color:var(--cyan-faint)] border-b-2 border-[color:var(--cyan)]"
                  : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/5"
              }`}
            >
              System History logs
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-3 py-2 min-h-[44px] text-[13px] font-semibold rounded-t-lg transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === "tasks"
                  ? "text-[color:var(--white)] bg-[color:var(--cyan-faint)] border-b-2 border-[color:var(--cyan)]"
                  : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/5"
              }`}
            >
              Tasks & Follow-up
            </button>
             <button
              onClick={() => setActiveTab("finance")}
              className={`px-3 py-2 min-h-[44px] text-[13px] font-semibold rounded-t-lg transition-all cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1 ${
                activeTab === "finance"
                  ? "text-[color:var(--white)] bg-[color:var(--cyan-faint)] border-b-2 border-[color:var(--cyan)]"
                  : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/5"
              }`}
            >
              F&I, Docs & e-Sign Hub
            </button>
            {docHubPanel && (
              <button
                onClick={() => setActiveTab("dochub")}
                className={`px-3 py-2 min-h-[44px] text-[13px] font-semibold rounded-t-lg transition-all cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1 ${
                  activeTab === "dochub"
                    ? "text-[color:var(--white)] bg-[color:var(--cyan-faint)] border-b-2 border-[color:var(--cyan)]"
                    : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] hover:bg-white/5"
                }`}
              >
                DocHub
                {/* Completion is checked first: a finished deal has docStage
                    null, so testing docStage alone showed no badge at all on
                    the one deal that had gone furthest. */}
                {lead?.docFlowCompletedAt ? (
                  <span className="ml-1 text-[12px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-black font-mono">
                    done
                  </span>
                ) : lead?.docStage ? (
                  <span className="ml-1 text-[12px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[color:var(--cyan)] text-black font-mono">
                    {lead.docStage}
                  </span>
                ) : null}
              </button>
            )}
          </div>

          {/* Tab Contents */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Profile Card */}
                <div className="card !bg-[color:var(--glass)]">
                  <div className="card-body p-4 flex flex-col gap-2">
                    <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Contact Details</div>
                    <div className="text-base font-semibold text-[color:var(--white)]">{lead.firstName} {lead.lastName}</div>
                    <div className="text-[13px] text-[rgba(232,234,230,0.72)] flex flex-col gap-2 mt-1">
                      <span className="flex items-center gap-2"><Phone size={13} className="text-[color:var(--cyan)]" /> {lead.phone}</span>
                      <span className="flex items-center gap-2"><Mail size={13} className="text-[color:var(--cyan)]" /> {lead.email}</span>
                    </div>
                    {/* Contact action buttons — icon-only on mobile, label on desktop */}
                    <div className="flex gap-2 mt-3 border-t border-white/5 pt-3">
                      <button
                        type="button"
                        onClick={() => startContactAction("call")}
                        title="Call"
                        className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan)]/20 transition-colors cursor-pointer"
                      >
                        <Phone size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startContactAction("whatsapp")}
                        title="WhatsApp"
                        className="w-9 h-9 md:flex-1 flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 hover:bg-[#25D366]/25 transition-colors cursor-pointer"
                      >
                        <Smartphone size={15} /><span className="hidden md:inline">WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => startContactAction("email")}
                        title="Email"
                        className="w-9 h-9 md:flex-1 flex items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold bg-white/5 text-[rgba(232,234,230,0.72)] border border-white/10 hover:text-[color:var(--white)] hover:bg-white/10 transition-colors cursor-pointer"
                      >
                        <Mail size={15} /><span className="hidden md:inline">Email</span>
                      </button>
                    </div>
                    <div className="border-t border-white/5 mt-2 pt-2 text-[13px]">
                      <span className="font-semibold text-[color:var(--white)]">Notes:</span> <span className="text-[rgba(232,234,230,0.72)]">{lead.notes || "None logged"}</span>
                    </div>
                    <div className="border-t border-white/5 mt-3 pt-3">
                      <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono mb-2">Buyer Details (for documents)</div>
                      <div className="grid grid-cols-1 gap-2">
                        {([
                          { key: "idOrBrn",        label: "ID / BRN" },
                          { key: "address",        label: "Address" },
                          { key: "buyerVatNumber", label: "VAT number" },
                        ] as const).map((f) => (
                          <div key={f.key} className="flex flex-col">
                            <label className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">{f.label}</label>
                            <input
                              type="text"
                              defaultValue={(lead as any)[f.key] ?? ""}
                              onBlur={async (e) => {
                                const next = e.target.value;
                                if (next === ((lead as any)[f.key] ?? "")) return;
                                await updateLead(lead.id, { [f.key]: next });
                                onRefresh();
                              }}
                              className="w-full bg-[color:var(--ink)] border border-white/15 rounded-lg px-3 py-2 text-[14px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] mt-0.5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Session Card */}
                <div className="card !bg-[color:var(--glass)]">
                  <div className="card-body p-4 flex flex-col gap-2">
                    <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono">Session Attributes</div>
                    <div className="text-[13px] text-[rgba(232,234,230,0.72)] flex flex-col gap-2 leading-relaxed">
                      <div><span className="font-semibold text-[color:var(--white)]">Ad Source:</span> <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] rounded text-[13px] font-semibold tracking-normal">{lead.source}</span></div>
                      <div><span className="font-semibold text-[color:var(--white)]">Creation Stamp:</span> <span>{lead.createdAt}</span></div>
                      <div><span className="font-semibold text-[color:var(--white)]">Assigned Specialist:</span> <span>{assignedUser?.name || "Awaiting Pool Assign"}</span></div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-semibold text-[color:var(--white)]">Intent Score:</span>
                        <span className="font-mono text-[16px] font-semibold text-[color:var(--cyan)] bg-[color:var(--cyan-faint)] px-2 py-0.5 rounded">{lead.digitalScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Vehicle */}
              {vehicle && (
                <div className="card !bg-[color:var(--glass)]">
                  <div className="card-body p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono mb-1">Subject Vehicle Focus</div>
                      <div className="text-[16px] font-semibold text-[color:var(--white)]">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                      <div className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">Stock No: {vehicle.stockNumber} / Price: R {vehicle.retailPrice.toLocaleString()}</div>
                    </div>
                    <span className="px-2 py-1 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[13px] font-semibold tracking-normal rounded">
                      {vehicle.status === "INVENTORY" ? "Active Showroom" : "Delivered"}
                    </span>
                  </div>
                </div>
              )}

              {/* Dealer Assist qualification — surfaces only on brand-new
                  leads with no open tasks. Once anyone has started working
                  the lead (task assigned or status past New), the "next
                  task" summary below replaces this so the same slot is
                  either a "what should I do first?" prompt or a "what's
                  next?" reminder, never both. */}
              {lead.status === "New" && tasks.filter(t => t.status !== "Completed").length === 0 && (
              <div className="card !bg-[color:var(--cyan-faint)] border-[color:var(--cyan-faint)]">
                <div className="card-body p-5 flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-[color:var(--cyan-faint)] rounded-full blur-2xl"></div>

                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[color:var(--cyan)]" />
                      <div>
                        <span className="text-[13px] font-semibold text-[color:var(--cyan)] tracking-normal font-mono block">Dealer Assist qualification</span>
                        <span className="text-[13px] text-[rgba(232,234,230,0.72)]">What this customer did</span>
                      </div>
                    </div>
                    
                    {/* Dynamic Hot/Warm/Cold Rating Badge */}
                    {lead.digitalScore >= 75 ? (
                      <span className="px-3 py-1 bg-[color:var(--cyan)] text-[color:var(--ink)] text-[13px] font-medium rounded-lg">
                        Hot · {lead.digitalScore}%
                      </span>
                    ) : lead.digitalScore >= 50 ? (
                      <span className="px-3 py-1 bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] text-[13px] font-medium rounded-lg border border-[color:var(--cyan-soft)]">
                        Warm · {lead.digitalScore}%
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-[color:var(--glass)] text-[color:var(--muted)] text-[13px] font-medium rounded-lg border border-[color:var(--glass-line)]">
                        Cold · {lead.digitalScore}%
                      </span>
                    )}
                  </div>

                  {/* Behavioral Analysis Explanation */}
                  <div className="text-[13px] text-[color:var(--white)] leading-relaxed font-sans space-y-2">
                    <p className="font-semibold text-[color:var(--white)]">Analysis Summary:</p>
                    <p className="text-[rgba(232,234,230,0.72)]">
                      {lead.digitalScore >= 75 
                        ? `Incoming message demonstrates urgent buying intent for the ${vehicle ? vehicle.make + ' ' + vehicle.model : 'vehicle'}. Customer completed virtual financing calculations and viewed showroom photos 5+ times in past 2 hours.`
                        : lead.digitalScore >= 50
                        ? `Moderate interest. Customer is comparing spec alternatives for the ${vehicle ? vehicle.make : 'vehicle'}. Visited pricing and specifications directories and requested dynamic financing brochure updates.`
                        : `Early research phase. Customer is scanning multiple models. Subscribed to general newsletters but hasn't performed high-value commitment actions yet.`}
                    </p>
                  </div>

                  {/* Suggested Smart Actions Grid */}
                  <div className="space-y-2 mt-1">
                    <span className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono block">Dealer Assist suggestions:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      
                      {/* Suggestion 1: Book Test Drive / Call Now */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("tasks");
                          setNewTaskTitle(`Call now to book test drive for ${vehicle ? vehicle.make + ' ' + vehicle.model : 'vehicle'}`);
                          setNewTaskPriority("High");
                        }}
                        className="p-2 bg-[color:var(--glass)] border border-white/5 hover:border-[color:var(--cyan-soft)] hover:bg-white/5 transition-all text-left rounded-lg group cursor-pointer"
                      >
                        <span className="text-[13px] text-[color:var(--cyan)] font-semibold tracking-normal block font-mono">Action 01</span>
                        <span className="text-[13px] font-semibold text-[color:var(--white)] block mt-0.5 group-hover:text-[color:var(--cyan)]">Book Test Drive</span>
                        <span className="text-[13px] text-[rgba(232,234,230,0.72)] block mt-0.5">Call now & schedule date</span>
                      </button>

                      {/* Suggestion 2: Send pricing PDF / WhatsApp */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("comm");
                          setCommChannel("whatsapp");
                          handleTemplateChange("welcome");
                        }}
                        className="p-2 bg-[color:var(--glass)] border border-white/5 hover:border-[color:var(--cyan-soft)] hover:bg-white/5 transition-all text-left rounded-lg group cursor-pointer"
                      >
                        <span className="text-[13px] text-[color:var(--cyan)] font-semibold tracking-normal block font-mono">Action 02</span>
                        <span className="text-[13px] font-semibold text-[color:var(--white)] block mt-0.5 group-hover:text-[color:var(--cyan)]">Send pricing PDF</span>
                        <span className="text-[13px] text-[rgba(232,234,230,0.72)] block mt-0.5">Push pricing template over WhatsApp</span>
                      </button>

                      {/* Suggestion 3: Draft Offer to Purchase (OTP) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("finance");
                          setDocTypeToGenerate("Offer to Purchase");
                        }}
                        className="p-2 bg-[color:var(--glass)] border border-white/5 hover:border-[color:var(--cyan-soft)] hover:bg-white/5 transition-all text-left rounded-lg group cursor-pointer"
                      >
                        <span className="text-[13px] text-[color:var(--cyan)] font-semibold tracking-normal block font-mono">Action 03</span>
                        <span className="text-[13px] font-semibold text-[color:var(--white)] block mt-0.5 group-hover:text-[color:var(--cyan)]">Generate OTP Document</span>
                        <span className="text-[13px] text-[rgba(232,234,230,0.72)] block mt-0.5">Draft digital pre-agreement folder</span>
                      </button>

                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Next task summary — replaces the qualification card once the
                  lead is being worked. Shows the next open task with a jump
                  to the Tasks tab. Kept intentionally small so it does not
                  compete with the Overview's other blocks. */}
              {(() => {
                const openTasks = tasks.filter(t => t.status !== "Completed");
                if (openTasks.length === 0) return null;
                if (lead.status === "New" && openTasks.length === 0) return null;
                const next = [...openTasks].sort((a, b) => {
                  const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
                  const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
                  return ad - bd;
                })[0];
                const overdue = next.dueDate ? new Date(next.dueDate).getTime() < Date.now() : false;
                return (
                  <div className="card !bg-[color:var(--glass)] border-[color:var(--glass-line)]">
                    <div className="card-body p-4 flex items-center gap-3">
                      <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${overdue ? "bg-red-500/20" : "bg-[color:var(--cyan-faint)]"}`}>
                        <Clock size={16} className={overdue ? "text-red-300" : "text-[color:var(--cyan)]"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[color:var(--white)] truncate">{next.title}</div>
                        <div className="text-[13px] text-[rgba(232,234,230,0.72)]">
                          {next.dueDate ? (overdue ? `Overdue since ${next.dueDate}` : `Due ${next.dueDate}`) : "No due date"}
                          {openTasks.length > 1 && ` · +${openTasks.length - 1} more`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab("tasks")}
                        className="shrink-0 px-3 py-1.5 min-h-[32px] rounded-md bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] text-[12px] font-semibold hover:bg-[color:var(--cyan)] hover:text-black transition-colors"
                      >
                        Open tasks
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Alerts */}
              {!lead.lastContactedAt && (
                <div className="bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-xl p-4 text-[13px] text-[color:var(--muted)] font-medium leading-relaxed flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[color:var(--glass)] flex items-center justify-center font-semibold text-[16px]">!</span>
                  <span>Alert: This lead is currently uncontacted. Direct follow-up or automated introductory welcome email dispatch is highly advised.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "journey" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              {/* Contact activity log */}
              {contactLog.length > 0 && (
                <div className="card !bg-[color:var(--glass)]">
                  <div className="card-body p-4">
                    <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono mb-4">Contact Activity</div>
                    <div className="relative border-l border-white/10 pl-6 flex flex-col gap-6 ml-2">
                      {contactLog.filter(e => e.leadId === leadId).map((entry, idx) => {
                        const EntryIcon = entry.channel === "call" ? Phone : entry.channel === "whatsapp" ? Smartphone : Mail;
                        const label = entry.channel === "call" ? "Phone call" : entry.channel === "whatsapp" ? "WhatsApp" : "Email sent";
                        const color = entry.channel === "whatsapp" ? "text-[#25D366]" : "text-[color:var(--cyan)]";
                        return (
                          <div key={idx} className="relative">
                            <span className={`absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white/10 ${entry.channel === "whatsapp" ? "bg-[#25D366]" : "bg-[color:var(--cyan)]"}`}></span>
                            <div className="flex items-center gap-2">
                              <EntryIcon size={12} className={color} />
                              <div className="text-[13px] text-[rgba(232,234,230,0.72)] font-mono font-medium">{new Date(entry.timestamp).toLocaleString()}</div>
                            </div>
                            <div className="text-[13px] font-semibold text-[color:var(--white)] mt-0.5">{label}{entry.outcome ? ` — ${entry.outcome}` : ""}</div>
                            {entry.note && <div className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">{entry.note}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="card !bg-[color:var(--glass)]">
                <div className="card-body p-4">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono mb-4">Website Pre-Enquiry Analytics Activity Log</div>
                  <div className="relative border-l border-white/10 pl-6 flex flex-col gap-6 ml-2">
                    {(lead.journey || []).map((j, idx) => {
                      const Icon = j.action.includes('Viewed') ? Eye : j.action.includes('Requested') ? Sparkles : ShoppingCart;
                      return (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-[color:var(--cyan)] border-2 border-white/10"></span>
                          <div className="flex items-center gap-2">
                             <Icon size={12} className="text-[color:var(--cyan)]" />
                             <div className="text-[13px] text-[rgba(232,234,230,0.72)] font-mono font-medium">{j.time}</div>
                          </div>
                          <div className="text-[13px] font-semibold text-[color:var(--white)] mt-0.5">{j.action}</div>
                          <div className="text-[13px] text-[rgba(232,234,230,0.72)] mt-0.5">{j.detail}</div>
                        </div>
                      )
                    })}
                    {(!lead.journey || lead.journey.length === 0) && (
                      <div className="text-[13px] text-[rgba(232,234,230,0.72)] italic py-2">No navigation telemetry records stored.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "comm" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <form onSubmit={handleDispatchComm} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Send template</label>
                    <select
                      value={commTemplate}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                    >
                      <option className="bg-[color:var(--ink-2)]" value="custom">Custom (No template)</option>
                      <option className="bg-[color:var(--ink-2)]" value="welcome">Welcome Pre-Owned Introduction</option>
                      <option className="bg-[color:var(--ink-2)]" value="followup">Finance Options Follow-Up</option>
                      <option className="bg-[color:var(--ink-2)]" value="finance">Pre-Approval Contract Draft</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Send by</label>
                    <select
                      value={commChannel}
                      onChange={(e) => setCommChannel(e.target.value as any)}
                      className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                    >
                      <option className="bg-[color:var(--ink-2)]" value="email">Email preview</option>
                      <option className="bg-[color:var(--ink-2)]" value="sms">SMS text network</option>
                      <option className="bg-[color:var(--ink-2)]" value="whatsapp">WhatsApp Business API</option>
                      <option className="bg-[color:var(--ink-2)]" value="call">Voice Call Log Records</option>
                    </select>
                  </div>
                </div>

                {/* Sub-inputs depending on channel */}
                {commChannel === "email" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Subject Line</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Subject..."
                        className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
                      />
                    </div>
                    <div className="flex flex-col gap-1 relative">
                      <div className="flex justify-between items-center">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Email Body</label>
                        <button
                          type="button"
                          onClick={() => setEmailBody(templates.email())}
                          className="flex items-center gap-1 text-[13px] font-semibold text-[color:var(--cyan)] hover:text-[color:var(--white)] transition-colors cursor-pointer"
                        >
                          <><Wand2 size={10} /> Use template</>
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Type email body contents..."
                        className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-sans"
                      ></textarea>
                    </div>
                  </div>
                )}

                {commChannel === "sms" && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">SMS Body (160 characters max)</label>
                      <button
                        type="button"
                        onClick={() => setSmsBody(templates.sms())}
                        className="flex items-center gap-1 text-[13px] font-semibold text-[color:var(--cyan)] hover:text-[color:var(--white)] transition-colors cursor-pointer"
                      >
                        <Wand2 size={10} /> Use template
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      maxLength={160}
                      value={smsBody}
                      onChange={(e) => setSmsBody(e.target.value)}
                      placeholder="Type SMS text..."
                      className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-sans"
                    ></textarea>
                  </div>
                )}

                {commChannel === "whatsapp" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/40 border border-white/5 rounded-xl p-4 animate-in fade-in duration-150">
                    {/* LEFT PANE: CONTROLS & COMPOSER */}
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Compose Message</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setWhatsappBody(templates.whatsapp())}
                            className="flex items-center gap-1 text-[13px] font-semibold text-[color:var(--cyan)] bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-faint)] px-2 py-1 rounded-lg hover:bg-[color:var(--cyan-faint)] transition-all cursor-pointer"
                          >
                            <Sparkles size={10} /> Use template
                          </button>
                        </div>
                      </div>

                      <textarea
                        rows={4}
                        value={whatsappBody}
                        onChange={(e) => setWhatsappBody(e.target.value)}
                        placeholder="Type WhatsApp content or load a template..."
                        className="bg-[color:var(--ink-2)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-sans resize-none leading-relaxed"
                      ></textarea>

                      {/* Launch Real Deep Link Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const sanitizedPhone = lead.phone.replace(/[^0-9]/g, "");
                          const encodedText = encodeURIComponent(whatsappBody || "Good day! Following up from Sandton Pre-Owned.");
                          window.open(`https://wa.me/${sanitizedPhone}?text=${encodedText}`, "_blank");
                        }}
                        className="w-full py-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 rounded-lg text-[13px] font-semibold tracking-normal transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Smartphone size={12} /> Open Real WhatsApp Desktop (wa.me)
                      </button>
                    </div>

                    {/* RIGHT PANE: WHATSAPP PHONE SIMULATOR */}
                    <div className="bg-[color:var(--ink)] border border-[#25D366]/20 rounded-2xl overflow-hidden flex flex-col shadow-inner h-64 font-sans text-[13px]">
                      {/* Phone Header */}
                      <div className="bg-[#075e54] text-[color:var(--white)] px-3 py-2 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#128C7E] flex items-center justify-center text-[13px] font-semibold text-[color:var(--white)]  font-mono shadow-sm">
                          {lead.firstName[0]}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-[13px] leading-tight">{lead.firstName} {lead.lastName}</div>
                          <div className="text-[13px] text-[#25D366] font-semibold">Online</div>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
                      </div>

                      {/* Phone Chat Body */}
                      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 bg-[radial-gradient(circle_at_center,rgba(7,94,84,0.08)_0%,transparent_80%)]">
                        {whatsappHistory.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`max-w-[85%] rounded-lg px-3 py-2 leading-relaxed text-[13px] relative flex flex-col gap-0.5 shadow-sm ${
                              msg.sender === "agent"
                                ? "bg-[color:var(--cyan-faint)] text-[color:var(--white)] self-end rounded-tr-none border border-[color:var(--cyan-soft)]"
                                : "bg-[color:var(--glass)] text-[color:var(--white)] self-start rounded-tl-none border border-white/5"
                            }`}
                          >
                            <span>{msg.text}</span>
                            <span className={`text-[13px] self-end mt-0.5 text-[color:var(--muted)] ${msg.sender === "agent" ? "" : "font-mono"}`}>
                              {msg.time}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Phone Footer */}
                      <div className="bg-[color:var(--ink-2)] border-t border-white/5 p-2 flex justify-between items-center text-[rgba(232,234,230,0.72)] font-mono text-[13px]">
                        <span>Secure Messaging Session</span>
                        <span className="text-[#25D366] font-semibold  tracking-widest text-[13px]">WhatsApp API Active</span>
                      </div>
                    </div>
                  </div>
                )}

                {commChannel === "call" && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Call Duration (seconds)</label>
                        <input
                          type="number"
                          value={callDuration}
                          onChange={(e) => setCallDuration(parseInt(e.target.value) || 0)}
                          className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Outcome State</label>
                        <select
                          value={callOutcome}
                          onChange={(e) => setCallOutcome(e.target.value)}
                          className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
                        >
                          <option className="bg-[color:var(--ink-2)]" value="Reached">Reached client directly</option>
                          <option className="bg-[color:var(--ink-2)]" value="No Answer">No Answer / Left Voicemail</option>
                          <option className="bg-[color:var(--ink-2)]" value="Call Back">Request Callback</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-semibold">Voice Call Discussion Summary</label>
                      <textarea
                        rows={2}
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="Log what was discussed or agreed..."
                        className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)] font-sans"
                      ></textarea>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-1">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm flex items-center gap-2"
                  >
                    <Send size={12} /> Dispatch Outbound Message
                  </button>
                </div>
              </form>

              {/* Dispatch logs */}
              <div className="mt-4 border-t border-white/5 pt-4">
                <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono mb-2">Communications Outbound logs</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px] text-[rgba(232,234,230,0.72)] text-left border-collapse stack-mobile">
                    <thead>
                      <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)]">
                        <th className="py-2 font-semibold tracking-normal text-[13px]">Date</th>
                        <th className="py-2 font-semibold tracking-normal text-[13px]">Type</th>
                        <th className="py-2 font-semibold tracking-normal text-[13px]">Subject</th>
                        <th className="py-2 font-semibold tracking-normal text-[13px]">Sent by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communications.map((c) => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-[color:var(--glass)]">
                          <td data-label="Date" className="py-3 text-[13px] md:text-[15px] font-medium">{c.sentAt}</td>
                          <td data-label="Type" className="py-3">
                            <span className="px-2 py-0.5 bg-[color:var(--cyan-faint)] text-[color:var(--cyan-bright)] rounded text-[13px] font-mono font-semibold tracking-normal">
                              {c.type}
                            </span>
                          </td>
                          <td data-label="Subject" className="py-3 max-w-[280px] truncate text-[13px] md:text-[15px] font-semibold text-[color:var(--white)]">
                            {c.subject} <span className="block text-[13px] font-normal text-[rgba(232,234,230,0.72)] mt-0.5">{c.content}</span>
                          </td>
                          <td data-label="Sent by" className="py-3 text-[13px] md:text-[15px]">{c.sentBy}</td>
                        </tr>
                      ))}
                      {communications.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-[rgba(232,234,230,0.72)] italic">
                            No dispatch communications logs stored for this lead file.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="card !bg-[color:var(--glass)]">
                <div className="card-body p-4">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono mb-2">DMS Lifecycle events</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px] text-[rgba(232,234,230,0.72)] border-collapse stack-mobile">
                      <thead>
                        <tr className="border-b border-white/10 text-[rgba(232,234,230,0.72)]">
                          <th className="py-2 font-semibold tracking-normal text-[13px]">Date</th>
                          <th className="py-2 font-semibold tracking-normal text-[13px]">Who</th>
                          <th className="py-2 font-semibold tracking-normal text-[13px]">Action</th>
                          <th className="py-2 font-semibold tracking-normal text-[13px]">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td data-label="Date" className="py-3 text-[13px] md:text-[15px]">{lead.createdAt}</td>
                          <td data-label="Who" className="py-3 text-[13px] md:text-[15px] font-mono">DMS CENTRAL</td>
                          <td data-label="Action" className="py-3 text-[13px] md:text-[15px] font-semibold text-[color:var(--white)]">Lead Registered</td>
                          <td data-label="Outcome" className="py-3 text-[13px] md:text-[15px]">Logged from {lead.source} source</td>
                        </tr>
                        {lead.lastContactedAt && (
                          <tr>
                            <td data-label="Date" className="py-3 text-[13px] md:text-[15px]">{lead.lastContactedAt}</td>
                            <td data-label="Who" className="py-3 text-[13px] md:text-[15px] font-mono">MARC_VAN_DER_MERWE</td>
                            <td data-label="Action" className="py-3 text-[13px] md:text-[15px] font-semibold text-[color:var(--white)]">Contact Completed</td>
                            <td data-label="Outcome" className="py-3 text-[13px] md:text-[15px]">Sent</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === "tasks" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="card !bg-[color:var(--glass)]">
                <div className="card-body p-4 flex flex-col gap-3">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono mb-1 border-b border-white/5 pb-2">Schedule Follow-up</div>
                  
                  {/* Task Suggestion (based on time since last contact or no contact) */}
                  {(!lead.lastContactedAt || new Date().getTime() - new Date(lead.lastContactedAt).getTime() > 24 * 60 * 60 * 1000) && (
                    <div className="bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] rounded-lg p-3 flex justify-between items-center">
                      <div className="flex gap-2 items-center">
                        <Award size={14} className="text-[color:var(--cyan)]" />
                        <span className="text-[13px] text-[color:var(--white)]">AI Suggestion: Lead hasn't been contacted recently. Schedule a follow-up call.</span>
                      </div>
                      <button 
                        onClick={() => {
                          setNewTaskTitle("Follow-up Call with " + lead.firstName);
                          setNewTaskPriority("High");
                        }}
                        className="text-[13px] bg-[color:var(--cyan)] on-fill px-2 py-1 rounded cursor-pointer hover:bg-opacity-80"
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleCreateTask} className="grid grid-cols-12 gap-3 mt-2">
                    <div className="col-span-12 md:col-span-5">
                      <input
                        type="text"
                        placeholder="Task Description..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full bg-[color:var(--ink)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none placeholder:text-[rgba(232,234,230,0.72)]"
                        required
                      />
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <input
                        type="date"
                        value={newTaskDate}
                        onChange={(e) => setNewTaskDate(e.target.value)}
                        className="w-full bg-[color:var(--ink)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        className="w-full bg-[color:var(--ink)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
                      >
                        <option value="High">High Priority</option>
                        <option value="Normal">Normal</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <button type="submit" className="w-full bg-[color:var(--glass)] hover:bg-[color:var(--glass)] border border-white/15 text-[color:var(--white)] font-semibold text-[13px] rounded-lg py-2 transition-all cursor-pointer h-full">
                        Add Task
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="card !bg-[color:var(--glass)]">
                <div className="card-body p-4 flex flex-col gap-3">
                  <div className="text-[length:var(--t-micro)] font-medium text-[color:var(--muted)] tracking-normal font-mono border-b border-white/5 pb-2">Active Tasks</div>
                  <div className="flex flex-col gap-2 mt-2">
                    {tasks.length === 0 ? (
                      <div className="text-center py-6 text-[13px] text-[rgba(232,234,230,0.72)]">No tasks scheduled for this lead.</div>
                    ) : (
                      tasks.map((task) => (
                        <div key={task.id} className="bg-[color:var(--ink)] border border-white/5 rounded-lg p-3 flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handleCompleteTask(task.id)}
                              className={`cursor-pointer transition-all ${task.status === "Completed" ? "text-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.72)] hover:text-[color:var(--cyan)]"}`}
                              disabled={task.status === "Completed"}
                            >
                              <CheckCircle size={18} />
                            </button>
                            <div className="flex flex-col">
                              <span className={`text-[13px] font-semibold ${task.status === "Completed" ? "text-[rgba(232,234,230,0.72)] line-through" : "text-[color:var(--white)]"}`}>
                                {task.title}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[13px] text-[rgba(232,234,230,0.72)] flex items-center gap-1"><Calendar size={10} /> {task.dueDate}</span>
                                {task.priority === "High" && <span className="text-[13px] bg-[color:var(--glass)] text-[color:var(--muted)] px-2 py-0.5 rounded font-semibold tracking-normal">High</span>}
                              </div>
                            </div>
                          </div>
                          <span className="text-[13px] font-mono text-[rgba(232,234,230,0.72)] group-hover:text-[rgba(232,234,230,0.72)] transition-colors">{task.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "finance" && (() => {
            const CHECK_ITEMS = [
              { key: "natis", label: "NATIS" },
              { key: "roadworthy", label: "Roadworthy" },
              { key: "invoiced", label: "Invoiced" },
              { key: "depositReceived", label: "Deposit" },
              { key: "delivered", label: "Delivered" },
            ] as const;
            const FINANCE_OPTS = ["N/A", "Submitted", "Approved", "Declined"] as const;
            const cl: any = lead.dealChecklist || {};
            const done =
              CHECK_ITEMS.filter((i) => cl[i.key]).length +
              (cl.financeStatus && cl.financeStatus !== "N/A" ? 1 : 0);
            const total = CHECK_ITEMS.length + 1;
            const patchChecklist = async (patch: any) => {
              await updateLead(lead.id, { dealChecklist: { ...(lead.dealChecklist || {}), ...patch } as any });
              loadLocalLead();
              onRefresh();
            };
            const estMonthly = vehicle ? Math.round(vehicle.retailPrice * 0.0195) : 0;
            return (
              <div className="flex flex-col gap-5 animate-in fade-in duration-150">
                {/* Deal readiness — status of the steps to close and hand over this
                    deal. Dealers raise invoices/contracts in their own systems; we
                    only record what's done, so nothing sensitive is stored here. */}
                <div className="card !bg-[color:var(--glass)]">
                  <div className="card-body p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="text-[13px] font-semibold text-[color:var(--cyan)] tracking-normal font-mono">Deal readiness</div>
                      <span className="text-[13px] text-[rgba(232,234,230,0.55)] tabular-nums">{done}/{total} done</span>
                    </div>
                    <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
                      The steps to close and hand over. Invoices and contracts stay in your own systems — this just tracks what's done.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {CHECK_ITEMS.map((item) => {
                        const on = !!cl[item.key];
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => patchChecklist({ [item.key]: !on })}
                            aria-pressed={on}
                            className={`px-3 py-1.5 rounded-full text-[13px] font-semibold border cursor-pointer transition-colors active:scale-95 ${
                              on
                                ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)]"
                                : "text-[rgba(232,234,230,0.72)] border-[color:var(--glass-line)] hover:text-[color:var(--white)] hover:border-white/20"
                            }`}
                          >
                            {on ? "\u2713 " : ""}{item.label}
                          </button>
                        );
                      })}
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border border-[color:var(--glass-line)] text-[rgba(232,234,230,0.72)]">
                        Finance
                        <select
                          value={cl.financeStatus || "N/A"}
                          onChange={(e) => patchChecklist({ financeStatus: e.target.value })}
                          className="bg-transparent text-[color:var(--white)] outline-none cursor-pointer"
                        >
                          {FINANCE_OPTS.map((o) => (
                            <option key={o} value={o} className="bg-[color:var(--ink-2)]">{o}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Repayment estimate — indicative, seeded from this deal's vehicle.
                    Full terms live in the Repayment calculator. */}
                <div className="card !bg-[color:var(--glass)]">
                  <div className="card-body p-4 flex flex-col gap-3">
                    <div className="text-[13px] font-semibold text-[color:var(--cyan)] tracking-normal font-mono border-b border-white/5 pb-2">Repayment estimate</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col">
                        <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold">Vehicle price</span>
                        <span className="text-[13px] font-mono font-semibold text-[color:var(--cyan)]">{vehicle ? `R ${vehicle.retailPrice.toLocaleString()}` : "N/A"}</span>
                      </div>
                      <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col">
                        <span className="text-[13px] text-[rgba(232,234,230,0.72)] font-semibold">Est. monthly*</span>
                        <span className="text-[13px] font-mono font-semibold text-[rgba(232,234,230,0.72)]">{estMonthly ? `R ${estMonthly.toLocaleString()}` : "N/A"}</span>
                      </div>
                    </div>
                    <p className="text-[13px] text-[rgba(232,234,230,0.55)]">*Rough guide only. Use the Repayment calculator for deposit, rate, balloon and term.</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === "dochub" && docHubPanel && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <Suspense fallback={<div className="text-sm text-[rgba(232,234,230,0.55)]">Loading DocHub…</div>}>
                {docHubPanel}
              </Suspense>
            </div>
          )}
        </div>

        {/* Footer */}
        {/* Stacks under 640px. Side by side, Delete and the status group were
            fighting over 358px and both wrapped — "Delete Lead File" rendered
            44px wide and 78px tall, a column of letters. col-reverse puts the
            status control above Delete on a phone, so the destructive action
            sits last rather than first under the thumb. */}
        <div className="px-4 sm:px-6 py-4 border-t border-[rgba(138,162,184,0.1)] flex flex-col-reverse sm:flex-row gap-3 sm:justify-between sm:items-center bg-[color:var(--glass)]">
          <button
            onClick={handleDelete}
            className="w-full sm:w-auto whitespace-nowrap px-3 py-2 rounded-lg border border-[color:var(--glass-line)] text-[color:var(--muted)] bg-[color:var(--glass)] text-[13px] font-semibold cursor-pointer active:scale-95 transition-all hover:bg-[color:var(--glass)]"
          >
            Delete Lead File
          </button>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}
              className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none font-sans"
            >
              <option className="bg-[color:var(--ink-2)]" value="New">New</option>
              <option className="bg-[color:var(--ink-2)]" value="Contacted">Contacted</option>
              <option className="bg-[color:var(--ink-2)]" value="Test Drive Scheduled">Test Drive Scheduled</option>
              <option className="bg-[color:var(--ink-2)]" value="Negotiating">Negotiating</option>
              <option className="bg-[color:var(--ink-2)]" value="Closed Won">Closed Won</option>
              <option className="bg-[color:var(--ink-2)]" value="Closed Lost">Closed Lost</option>
            </select>
            <button
              onClick={handleSaveStatus}
              className="btn btn-primary btn-sm shrink-0 whitespace-nowrap"
            >
              Save Status Changes
            </button>
          </div>
        </div>

      </div>

      {/* Log-a-note toast (call / WhatsApp only) */}
      {logToast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(380px,calc(100%-32px))] bg-[color:var(--ink-2)] border border-[rgba(138,162,184,0.22)] rounded-xl p-4 shadow-2xl z-[210] animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-[color:var(--white)] flex items-center gap-2">
              {logToast.channel === "call" ? <Phone size={14} className="text-[color:var(--cyan)]" /> : <Smartphone size={14} className="text-[#25D366]" />}
              Log this {logToast.channel === "call" ? "call" : "WhatsApp"}?
            </span>
            <button onClick={() => setLogToast(null)} className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] p-1 cursor-pointer"><X size={14} /></button>
          </div>
          <div className="flex flex-col gap-2">
            <select
              value={logOutcome}
              onChange={e => setLogOutcome(e.target.value)}
              className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none"
            >
              <option value="Connected">Connected</option>
              <option value="No Answer">No Answer</option>
              <option value="Voicemail">Voicemail</option>
              <option value="N/A">N/A</option>
            </select>
            <input
              type="text"
              placeholder="Note (optional)"
              value={logNote}
              onChange={e => setLogNote(e.target.value)}
              className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none placeholder:text-[color:var(--muted)]"
            />
            <button
              type="button"
              onClick={saveLogEntry}
              className="btn btn-primary btn-sm w-full"
            >
              <CheckCircle size={13} /> Save to timeline
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
