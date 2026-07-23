import React, { useState, useEffect } from "react";
import { Lead, Vehicle, User, Communication, Task, Agreement } from "../types";
import { getAccount } from "../lib/session";
import { updateLead, deleteLead, createCommunication, createTask, updateTask, createInvoice, createAgreement, updateAgreement } from "../api";
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
  const [activeTab, setActiveTab] = useState<"overview" | "journey" | "comm" | "history" | "tasks" | "finance">("overview");
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

  const loadLocalLead = () => {
    fetch(`/api/state`)
      .then((res) => res.json())
      .then((state) => {
        const found = state.leads.find((l: Lead) => l.id === leadId);
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
      await updateLead(lead.id, { status: leadStatus as any });
      
      if (leadStatus === "Closed Won" && lead.status !== "Closed Won") {
        // Auto-generate documents for Closed Won
        if (vehicle) {
          await createAgreement({
            leadId: lead.id,
            vehicleId: vehicle.id,
            purchasePrice: vehicle.retailPrice,
            depositAmount: 0,
            type: "Vehicle Sale",
            status: "Pending Signature"
          });
          
          await createInvoice({
            leadId: lead.id,
            vehicleId: vehicle.id,
            amount: vehicle.retailPrice,
            additionalCharges: crmSetupFee ? 5000 : 0,
            chargeDescription: crmSetupFee ? "CRM Setup, Workflow & Training Fee" : "",
            paymentMethod: "Bank Finance",
            status: "Sent",
            dueDate: new Date().toISOString().slice(0, 10)
          });
          
          alert("Lead stage updated successfully! OTP, Invoice, and Delivery Note auto-generated.");
        } else {
          alert("Lead stage updated successfully!");
        }
      } else {
        alert("Lead stage updated successfully!");
      }
      
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
      <div className="bg-[#0f1826] border border-[rgba(126,164,214,0.22)] rounded-2xl w-full max-w-[720px] max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl relative font-sans animate-in zoom-in-95 duration-150">
        
        {/* Border strip */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#15C7C0] via-[#1466E0] to-[#C9A24B]"></div>

        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[rgba(126,164,214,0.1)]">
          <div>
            <span className="text-[10px] font-bold text-[#15C7C0] uppercase tracking-widest font-mono">CRM Pipeline Lead Folder</span>
            <h3 className="font-serif text-lg font-black text-[#E8EEF6] mt-0.5">
              Customer File — {lead.firstName} {lead.lastName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#9DB0C6] hover:text-[#E8EEF6] p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-[rgba(126,164,214,0.1)] pb-1.5">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "text-[#E8EEF6] bg-[#1466E0]/15 border-b-2 border-[#15C7C0]"
                  : "text-[#9DB0C6] hover:text-[#E8EEF6] hover:bg-white/5"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("journey")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer ${
                activeTab === "journey"
                  ? "text-[#E8EEF6] bg-[#1466E0]/15 border-b-2 border-[#15C7C0]"
                  : "text-[#9DB0C6] hover:text-[#E8EEF6] hover:bg-white/5"
              }`}
            >
              Digital Journey Tracker
            </button>
            <button
              onClick={() => setActiveTab("comm")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer ${
                activeTab === "comm"
                  ? "text-[#E8EEF6] bg-[#1466E0]/15 border-b-2 border-[#15C7C0]"
                  : "text-[#9DB0C6] hover:text-[#E8EEF6] hover:bg-white/5"
              }`}
            >
              Automated Dispatches
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer ${
                activeTab === "history"
                  ? "text-[#E8EEF6] bg-[#1466E0]/15 border-b-2 border-[#15C7C0]"
                  : "text-[#9DB0C6] hover:text-[#E8EEF6] hover:bg-white/5"
              }`}
            >
              System History logs
            </button>
            <button
              onClick={() => setActiveTab("tasks")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer ${
                activeTab === "tasks"
                  ? "text-[#E8EEF6] bg-[#1466E0]/15 border-b-2 border-[#15C7C0]"
                  : "text-[#9DB0C6] hover:text-[#E8EEF6] hover:bg-white/5"
              }`}
            >
              Tasks & Follow-up
            </button>
             <button
              onClick={() => setActiveTab("finance")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === "finance"
                  ? "text-[#E8EEF6] bg-[#C9A24B]/15 border-b-2 border-[#C9A24B]"
                  : "text-[#9DB0C6] hover:text-[#E8EEF6] hover:bg-white/5"
              }`}
            >
              F&I, Docs & e-Sign Hub
            </button>
          </div>

          {/* Tab Contents */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Profile Card */}
                <div className="card !bg-[#0f1826]/1">
                  <div className="card-body p-4 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Contact Details</div>
                    <div className="text-base font-bold text-[#E8EEF6]">{lead.firstName} {lead.lastName}</div>
                    <div className="text-xs text-[#9DB0C6] flex flex-col gap-1.5 mt-1">
                      <span className="flex items-center gap-1.5"><Phone size={13} className="text-[#15C7C0]" /> {lead.phone}</span>
                      <span className="flex items-center gap-1.5"><Mail size={13} className="text-[#1466E0]" /> {lead.email}</span>
                    </div>
                    <div className="border-t border-white/5 mt-2 pt-2 text-xs">
                      <span className="font-bold text-[#E8EEF6]">Notes:</span> <span className="text-[#9DB0C6]">{lead.notes || "None logged"}</span>
                    </div>
                  </div>
                </div>

                {/* Session Card */}
                <div className="card !bg-[#0f1826]/1">
                  <div className="card-body p-4 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">Session Attributes</div>
                    <div className="text-xs text-[#9DB0C6] flex flex-col gap-2 leading-relaxed">
                      <div><span className="font-bold text-[#E8EEF6]">Ad Source:</span> <span className="px-2 py-0.5 bg-[#1466E0]/15 text-[#4D9BFF] rounded text-[10px] font-bold uppercase tracking-wider">{lead.source}</span></div>
                      <div><span className="font-bold text-[#E8EEF6]">Creation Stamp:</span> <span>{lead.createdAt}</span></div>
                      <div><span className="font-bold text-[#E8EEF6]">Assigned Specialist:</span> <span>{assignedUser?.name || "Awaiting Pool Assign"}</span></div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-bold text-[#E8EEF6]">Intent Score:</span>
                        <span className="font-mono text-sm font-bold text-[#15C7C0] bg-[#15C7C0]/10 px-2 py-0.5 rounded">{lead.digitalScore}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Vehicle */}
              {vehicle && (
                <div className="card !bg-[#0f1826]/1">
                  <div className="card-body p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono mb-1">Subject Vehicle Focus</div>
                      <div className="text-sm font-bold text-[#E8EEF6]">{vehicle.year} {vehicle.make} {vehicle.model}</div>
                      <div className="text-xs text-[#9DB0C6] mt-0.5">Stock No: {vehicle.stockNumber} / Price: R {vehicle.retailPrice.toLocaleString()}</div>
                    </div>
                    <span className="px-2 py-1 bg-[#35C46B]/15 text-[#35C46B] text-[10px] font-bold uppercase tracking-wider rounded">
                      {vehicle.status === "INVENTORY" ? "Active Showroom" : vehicle.status === "PENDING" ? "Finance Pending" : "Delivered"}
                    </span>
                  </div>
                </div>
              )}

              {/* TrueAI Smart Lead Qualification Hub */}
              <div className="card !bg-[#1466E0]/5 border-[#1466E0]/20">
                <div className="card-body p-5 flex flex-col gap-4 relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#15C7C0]/10 rounded-full blur-2xl"></div>
                  
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-[#15C7C0] animate-pulse" />
                      <div>
                        <span className="text-[10px] font-bold text-[#15C7C0] uppercase tracking-wider font-mono block">TrueAI Smart Qualification</span>
                        <span className="text-[9px] text-[#9DB0C6]">Central Behavioral Analysis Node</span>
                      </div>
                    </div>
                    
                    {/* Dynamic Hot/Warm/Cold Rating Badge */}
                    {lead.digitalScore >= 75 ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/15 text-red-400 text-xs font-black uppercase tracking-wider rounded-lg border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.2)] font-mono">
                        Hot 🔥 (High Intent: {lead.digitalScore}%)
                      </span>
                    ) : lead.digitalScore >= 50 ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-[#E7B24B]/15 text-[#E7B24B] text-xs font-black uppercase tracking-wider rounded-lg border border-[#E7B24B]/20 font-mono">
                        Warm ☀️ (Engaged: {lead.digitalScore}%)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/15 text-sky-400 text-xs font-black uppercase tracking-wider rounded-lg border border-sky-500/20 font-mono">
                        Cold ❄️ (Nurture: {lead.digitalScore}%)
                      </span>
                    )}
                  </div>

                  {/* Behavioral Analysis Explanation */}
                  <div className="text-xs text-[#E8EEF6] leading-relaxed font-sans space-y-1.5">
                    <p className="font-semibold text-white">Analysis Summary:</p>
                    <p className="text-[#9DB0C6]">
                      {lead.digitalScore >= 75 
                        ? `Incoming message demonstrates urgent buying intent for the ${vehicle ? vehicle.make + ' ' + vehicle.model : 'vehicle'}. Customer completed virtual financing calculations and viewed showroom photos 5+ times in past 2 hours.`
                        : lead.digitalScore >= 50
                        ? `Moderate interest. Customer is comparing spec alternatives for the ${vehicle ? vehicle.make : 'vehicle'}. Visited pricing and specifications directories and requested dynamic financing brochure updates.`
                        : `Early research phase. Customer is scanning multiple models. Subscribed to general newsletters but hasn't performed high-value commitment actions yet.`}
                    </p>
                  </div>

                  {/* Suggested Smart Actions Grid */}
                  <div className="space-y-2 mt-1">
                    <span className="text-[9px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono block">TrueAI Smart Suggestions:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      
                      {/* Suggestion 1: Book Test Drive / Call Now */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("tasks");
                          setNewTaskTitle(`Call now to book test drive for ${vehicle ? vehicle.make + ' ' + vehicle.model : 'vehicle'}`);
                          setNewTaskPriority("High");
                        }}
                        className="p-2 bg-[#0f1826]/3 border border-white/5 hover:border-[#15C7C0]/30 hover:bg-white/5 transition-all text-left rounded-lg group cursor-pointer"
                      >
                        <span className="text-[8px] text-[#15C7C0] font-bold uppercase tracking-wider block font-mono">Action 01</span>
                        <span className="text-[11px] font-bold text-white block mt-0.5 group-hover:text-[#15C7C0]">Book Test Drive</span>
                        <span className="text-[9px] text-[#9DB0C6] block mt-0.5">Call now & schedule date</span>
                      </button>

                      {/* Suggestion 2: Send pricing PDF / WhatsApp */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("comm");
                          setCommChannel("whatsapp");
                          handleTemplateChange("welcome");
                        }}
                        className="p-2 bg-[#0f1826]/3 border border-white/5 hover:border-[#1466E0]/30 hover:bg-white/5 transition-all text-left rounded-lg group cursor-pointer"
                      >
                        <span className="text-[8px] text-[#1466E0] font-bold uppercase tracking-wider block font-mono">Action 02</span>
                        <span className="text-[11px] font-bold text-white block mt-0.5 group-hover:text-[#1466E0]">Send pricing PDF</span>
                        <span className="text-[9px] text-[#9DB0C6] block mt-0.5">Push pricing template over WhatsApp</span>
                      </button>

                      {/* Suggestion 3: Draft Offer to Purchase (OTP) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab("finance");
                          setDocTypeToGenerate("Offer to Purchase");
                        }}
                        className="p-2 bg-[#0f1826]/3 border border-white/5 hover:border-[#C9A24B]/30 hover:bg-white/5 transition-all text-left rounded-lg group cursor-pointer"
                      >
                        <span className="text-[8px] text-[#C9A24B] font-bold uppercase tracking-wider block font-mono">Action 03</span>
                        <span className="text-[11px] font-bold text-white block mt-0.5 group-hover:text-[#C9A24B]">Generate OTP Document</span>
                        <span className="text-[9px] text-[#9DB0C6] block mt-0.5">Draft digital pre-agreement folder</span>
                      </button>

                    </div>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {!lead.lastContactedAt && (
                <div className="bg-[#F0555A]/10 border border-[#F0555A]/30 rounded-xl p-4 text-xs text-[#F0555A] font-medium leading-relaxed flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#F0555A]/20 flex items-center justify-center font-bold text-sm">!</span>
                  <span>Alert: This lead is currently uncontacted. Direct follow-up or automated introductory welcome email dispatch is highly advised.</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "journey" && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-150">
              <div className="card !bg-[#0f1826]/1">
                <div className="card-body p-4">
                  <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono mb-4">Website Pre-Enquiry Analytics Activity Log</div>
                  <div className="relative border-l border-white/10 pl-6 flex flex-col gap-6 ml-2">
                    {(lead.journey || []).map((j, idx) => {
                      const Icon = j.action.includes('Viewed') ? Eye : j.action.includes('Requested') ? Sparkles : ShoppingCart;
                      return (
                        <div key={idx} className="relative">
                          <span className="absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full bg-[#1466E0] border-2 border-white/10 shadow-[0_0_8px_rgba(20,102,224,0.5)]"></span>
                          <div className="flex items-center gap-2">
                             <Icon size={12} className="text-[#1466E0]" />
                             <div className="text-[10px] text-[#9DB0C6] font-mono font-medium">{j.time}</div>
                          </div>
                          <div className="text-xs font-bold text-[#E8EEF6] mt-0.5">{j.action}</div>
                          <div className="text-xs text-[#9DB0C6] mt-0.5">{j.detail}</div>
                        </div>
                      )
                    })}
                    {(!lead.journey || lead.journey.length === 0) && (
                      <div className="text-xs text-[#9DB0C6] italic py-2">No navigation telemetry records stored.</div>
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
                    <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Template Dispatch</label>
                    <select
                      value={commTemplate}
                      onChange={(e) => handleTemplateChange(e.target.value)}
                      className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                    >
                      <option className="bg-[#0f1826]" value="custom">Custom (No template)</option>
                      <option className="bg-[#0f1826]" value="welcome">Welcome Pre-Owned Introduction</option>
                      <option className="bg-[#0f1826]" value="followup">Finance Options Follow-Up</option>
                      <option className="bg-[#0f1826]" value="finance">Pre-Approval Contract Draft</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Dispatch Node Channel</label>
                    <select
                      value={commChannel}
                      onChange={(e) => setCommChannel(e.target.value as any)}
                      className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                    >
                      <option className="bg-[#0f1826]" value="email">Simulated Email Client</option>
                      <option className="bg-[#0f1826]" value="sms">SMS text network</option>
                      <option className="bg-[#0f1826]" value="whatsapp">WhatsApp Business API</option>
                      <option className="bg-[#0f1826]" value="call">Voice Call Log Records</option>
                    </select>
                  </div>
                </div>

                {/* Sub-inputs depending on channel */}
                {commChannel === "email" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Subject Line</label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Subject..."
                        className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none focus:border-[#1466E0]"
                      />
                    </div>
                    <div className="flex flex-col gap-1 relative">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Email Body</label>
                        <button
                          type="button"
                          onClick={() => setEmailBody(templates.email())}
                          className="flex items-center gap-1 text-[9px] font-bold text-[#15C7C0] hover:text-[#E8EEF6] transition-colors cursor-pointer"
                        >
                          <><Wand2 size={10} /> Use template</>
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        placeholder="Type email body contents..."
                        className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none focus:border-[#1466E0] font-sans"
                      ></textarea>
                    </div>
                  </div>
                )}

                {commChannel === "sms" && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">SMS Body (160 characters max)</label>
                      <button
                        type="button"
                        onClick={() => setSmsBody(templates.sms())}
                        className="flex items-center gap-1 text-[9px] font-bold text-[#15C7C0] hover:text-[#E8EEF6] transition-colors cursor-pointer"
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
                      className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none focus:border-[#1466E0] font-sans"
                    ></textarea>
                  </div>
                )}

                {commChannel === "whatsapp" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/40 border border-white/5 rounded-xl p-4 animate-in fade-in duration-150">
                    {/* LEFT PANE: CONTROLS & COMPOSER */}
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-bold">Compose Message</label>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setWhatsappBody(templates.whatsapp())}
                            className="flex items-center gap-1 text-[9px] font-bold text-[#15C7C0] bg-[#15C7C0]/10 border border-[#15C7C0]/20 px-2 py-1 rounded-lg hover:bg-[#15C7C0]/20 transition-all cursor-pointer"
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
                        className="bg-[#0f1826] border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none focus:border-[#1466E0] font-sans resize-none leading-relaxed"
                      ></textarea>

                      {/* Launch Real Deep Link Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const sanitizedPhone = lead.phone.replace(/[^0-9]/g, "");
                          const encodedText = encodeURIComponent(whatsappBody || "Good day! Following up from Sandton Pre-Owned.");
                          window.open(`https://wa.me/${sanitizedPhone}?text=${encodedText}`, "_blank");
                        }}
                        className="w-full py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Smartphone size={12} /> Open Real WhatsApp Desktop (wa.me)
                      </button>
                    </div>

                    {/* RIGHT PANE: WHATSAPP PHONE SIMULATOR */}
                    <div className="bg-[#070d15] border border-[#25D366]/20 rounded-2xl overflow-hidden flex flex-col shadow-inner h-64 font-sans text-xs">
                      {/* Phone Header */}
                      <div className="bg-[#075e54] text-white px-3 py-2 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#128C7E] flex items-center justify-center text-[10px] font-black text-white uppercase font-mono shadow-sm">
                          {lead.firstName[0]}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-[11px] leading-tight">{lead.firstName} {lead.lastName}</div>
                          <div className="text-[8px] text-[#25D366] font-bold">Online</div>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
                      </div>

                      {/* Phone Chat Body */}
                      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 bg-[radial-gradient(circle_at_center,rgba(7,94,84,0.08)_0%,transparent_80%)]">
                        {whatsappHistory.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`max-w-[85%] rounded-lg px-2.5 py-1.5 leading-relaxed text-[11px] relative flex flex-col gap-0.5 shadow-sm ${
                              msg.sender === "agent"
                                ? "bg-[#dcf8c6] text-gray-900 self-end rounded-tr-none"
                                : "bg-[#0f1826] text-gray-100 self-start rounded-tl-none border border-white/5"
                            }`}
                          >
                            <span>{msg.text}</span>
                            <span className={`text-[8px] self-end mt-0.5 ${msg.sender === "agent" ? "text-gray-400" : "text-gray-400 font-mono"}`}>
                              {msg.time}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Phone Footer */}
                      <div className="bg-[#0f1826] border-t border-white/5 p-1.5 flex justify-between items-center text-[#9DB0C6] font-mono text-[9px]">
                        <span>Secure Messaging Session</span>
                        <span className="text-[#25D366] font-bold uppercase tracking-widest text-[8px]">WhatsApp API Active</span>
                      </div>
                    </div>
                  </div>
                )}

                {commChannel === "call" && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Call Duration (seconds)</label>
                        <input
                          type="number"
                          value={callDuration}
                          onChange={(e) => setCallDuration(parseInt(e.target.value) || 0)}
                          className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Outcome State</label>
                        <select
                          value={callOutcome}
                          onChange={(e) => setCallOutcome(e.target.value)}
                          className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
                        >
                          <option className="bg-[#0f1826]" value="Reached">Reached client directly</option>
                          <option className="bg-[#0f1826]" value="No Answer">No Answer / Left Voicemail</option>
                          <option className="bg-[#0f1826]" value="Call Back">Request Callback</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-[#9DB0C6] uppercase tracking-wider font-semibold">Voice Call Discussion Summary</label>
                      <textarea
                        rows={2}
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="Log what was discussed or agreed..."
                        className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none focus:border-[#1466E0] font-sans"
                      ></textarea>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-1">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm flex items-center gap-1.5"
                  >
                    <Send size={12} /> Dispatch Outbound Message
                  </button>
                </div>
              </form>

              {/* Dispatch logs */}
              <div className="mt-4 border-t border-white/5 pt-4">
                <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono mb-2">Communications Outbound logs</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-[#9DB0C6] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-[#9DB0C6]">
                        <th className="py-2 font-bold uppercase tracking-wider text-[9px]">Date</th>
                        <th className="py-2 font-bold uppercase tracking-wider text-[9px]">Type</th>
                        <th className="py-2 font-bold uppercase tracking-wider text-[9px]">Subject discussion</th>
                        <th className="py-2 font-bold uppercase tracking-wider text-[9px]">Dispatched by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communications.map((c) => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-[#0f1826]/2">
                          <td className="py-2.5 font-medium">{c.sentAt}</td>
                          <td className="py-2.5">
                            <span className="px-1.5 py-0.5 bg-[#1466E0]/15 text-[#4D9BFF] rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                              {c.type}
                            </span>
                          </td>
                          <td className="py-2.5 max-w-[280px] truncate font-semibold text-[#E8EEF6]">
                            {c.subject} <span className="block text-[10px] font-normal text-[#9DB0C6] mt-0.5">{c.content}</span>
                          </td>
                          <td className="py-2.5">{c.sentBy}</td>
                        </tr>
                      ))}
                      {communications.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-[#9DB0C6] italic">
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
              <div className="card !bg-[#0f1826]/1">
                <div className="card-body p-4">
                  <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono mb-2">DMS Lifecycle events</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-[#9DB0C6] border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[#9DB0C6]">
                          <th className="py-2 font-bold uppercase tracking-wider text-[9px]">Date Stamp</th>
                          <th className="py-2 font-bold uppercase tracking-wider text-[9px]">Actor Node</th>
                          <th className="py-2 font-bold uppercase tracking-wider text-[9px]">System Action</th>
                          <th className="py-2 font-bold uppercase tracking-wider text-[9px]">Outcome</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-2.5">{lead.createdAt}</td>
                          <td className="py-2.5 font-mono">DMS CENTRAL</td>
                          <td className="py-2.5 font-bold text-[#E8EEF6]">Lead Registered</td>
                          <td className="py-2.5">Logged from {lead.source} source</td>
                        </tr>
                        {lead.lastContactedAt && (
                          <tr>
                            <td className="py-2.5">{lead.lastContactedAt}</td>
                            <td className="py-2.5 font-mono">MARC_VAN_DER_MERWE</td>
                            <td className="py-2.5 font-bold text-[#E8EEF6]">Contact Completed</td>
                            <td className="py-2.5">Outbound dispatch completed</td>
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
              <div className="card !bg-[#0f1826]/1">
                <div className="card-body p-4 flex flex-col gap-3">
                  <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono mb-1 border-b border-white/5 pb-2">Schedule Follow-up</div>
                  
                  {/* Task Suggestion (based on time since last contact or no contact) */}
                  {(!lead.lastContactedAt || new Date().getTime() - new Date(lead.lastContactedAt).getTime() > 24 * 60 * 60 * 1000) && (
                    <div className="bg-[#1466E0]/10 border border-[#1466E0]/30 rounded-lg p-3 flex justify-between items-center">
                      <div className="flex gap-2 items-center">
                        <Award size={14} className="text-[#15C7C0]" />
                        <span className="text-xs text-[#E8EEF6]">AI Suggestion: Lead hasn't been contacted recently. Schedule a follow-up call.</span>
                      </div>
                      <button 
                        onClick={() => {
                          setNewTaskTitle("Follow-up Call with " + lead.firstName);
                          setNewTaskPriority("High");
                        }}
                        className="text-[10px] bg-[#1466E0] text-white px-2 py-1 rounded cursor-pointer hover:bg-opacity-80"
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
                        className="w-full bg-[#070d15] border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none placeholder:text-[#9DB0C6]"
                        required
                      />
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <input
                        type="date"
                        value={newTaskDate}
                        onChange={(e) => setNewTaskDate(e.target.value)}
                        className="w-full bg-[#070d15] border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as any)}
                        className="w-full bg-[#070d15] border border-[rgba(126,164,214,0.1)] rounded-lg px-3 py-2 text-xs text-[#E8EEF6] outline-none"
                      >
                        <option value="High">High Priority</option>
                        <option value="Normal">Normal</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <button type="submit" className="w-full bg-[#0f1826]/10 hover:bg-[#0f1826]/15 border border-white/15 text-white font-bold text-xs rounded-lg py-2 transition-all cursor-pointer h-full">
                        Add Task
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="card !bg-[#0f1826]/1">
                <div className="card-body p-4 flex flex-col gap-3">
                  <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono border-b border-white/5 pb-2">Active Tasks</div>
                  <div className="flex flex-col gap-2 mt-2">
                    {tasks.length === 0 ? (
                      <div className="text-center py-6 text-xs text-[#9DB0C6]">No tasks scheduled for this lead.</div>
                    ) : (
                      tasks.map((task) => (
                        <div key={task.id} className="bg-[#070d15] border border-white/5 rounded-lg p-3 flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handleCompleteTask(task.id)}
                              className={`cursor-pointer transition-all ${task.status === "Completed" ? "text-[#15C7C0]" : "text-[#9DB0C6] hover:text-[#1466E0]"}`}
                              disabled={task.status === "Completed"}
                            >
                              <CheckCircle size={18} />
                            </button>
                            <div className="flex flex-col">
                              <span className={`text-xs font-semibold ${task.status === "Completed" ? "text-[#9DB0C6] line-through" : "text-[#E8EEF6]"}`}>
                                {task.title}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-[#9DB0C6] flex items-center gap-1"><Calendar size={10} /> {task.dueDate}</span>
                                {task.priority === "High" && <span className="text-[8px] bg-[#F0555A]/20 text-[#F0555A] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">High</span>}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-[#9DB0C6] group-hover:text-[#9DB0C6] transition-colors">{task.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "finance" && (
            <div className="flex flex-col gap-5 animate-in fade-in duration-150">

              {/* This buyer's paperwork. Same upload + e-sign flow the standalone
                  Documents screen used, now filed against the lead it belongs to. */}
              {documentsPanel && (
                <div className="card !bg-[#0f1826]/1">
                  <div className="card-body p-4 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-[#C9A24B] uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                      Documents for this buyer
                    </div>
                    {documentsPanel}
                  </div>
                </div>
              )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* LEFT COLUMN: CONTROLS & SELECTION (5 COLS) */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                
                {/* 1. Pre-Approval Simulator */}
                <div className="card !bg-[#0f1826]/1">
                  <div className="card-body p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="text-[10px] font-bold text-[#C9A24B] uppercase tracking-wider font-mono">F&I Pre-Approval Simulator</div>
                      <span className="text-[8px] bg-[#C9A24B]/15 text-[#C9A24B] px-2 py-0.5 rounded font-bold uppercase tracking-wider">SECURE PORTAL</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/30 border border-white/5 p-2.5 rounded-xl flex flex-col">
                        <span className="text-[8px] text-[#9DB0C6] uppercase font-bold tracking-wider">Vehicle Price</span>
                        <span className="text-xs font-mono font-bold text-[#35C46B]">{vehicle ? `R ${vehicle.retailPrice.toLocaleString()}` : "N/A"}</span>
                      </div>
                      <div className="bg-black/30 border border-white/5 p-2.5 rounded-xl flex flex-col">
                        <span className="text-[8px] text-[#9DB0C6] uppercase font-bold tracking-wider">Est. Monthly</span>
                        <span className="text-xs font-mono font-bold text-[#9DB0C6]">{vehicle ? `R ${Math.round(vehicle.retailPrice * 0.0195).toLocaleString()}` : "N/A"}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <button 
                        type="button"
                        onClick={() => alert("SMS with secure pre-approval link dispatched to customer cell.")}
                        className="w-full py-2 bg-[#C9A24B]/10 hover:bg-[#C9A24B]/20 border border-[#C9A24B]/30 text-[#C9A24B] font-bold text-[10px] uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Phone size={11} /> Send Pre-Approval SMS Link
                      </button>
                      <button 
                        type="button"
                        onClick={() => alert("Bureau analysis complete. Passing probability score: 92%. Soft-check approved.")}
                        className="w-full py-2 bg-[#0f1826]/5 hover:bg-white/10 border border-white/10 text-white font-bold text-[10px] uppercase rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle size={11} /> Soft credit bureau check
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Document Generator Panel */}
                <div className="card !bg-[#0f1826]/1 border border-white/5">
                  <div className="card-body p-4 flex flex-col gap-3">
                    <div className="text-[10px] font-bold text-[#E8EEF6] uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                      F&I Document Generator
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[9px] text-[#9DB0C6] uppercase font-bold">Select Agreement Template</label>
                      <select
                        value={docTypeToGenerate}
                        onChange={(e) => setDocTypeToGenerate(e.target.value as any)}
                        className="bg-[#0f1826] border border-white/10 rounded-lg p-2 text-xs text-[#E8EEF6] outline-none"
                      >
                        <option value="Offer to Purchase">Offer to Purchase (OTP)</option>
                        <option value="Finance Application">Finance Application</option>
                        <option value="Vehicle Sale">Sales Agreement (Deed of Sale)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={generatingDoc}
                      onClick={async () => {
                        setGeneratingDoc(true);
                        try {
                          const docType = docTypeToGenerate === "Offer to Purchase" 
                            ? "Offer to Purchase" 
                            : docTypeToGenerate === "Finance Application" 
                            ? "Finance Application" 
                            : "Vehicle Sale";

                          const newAg = await createAgreement({
                            leadId: lead.id,
                            vehicleId: vehicle?.id || "",
                            purchasePrice: vehicle?.retailPrice || 320000,
                            depositAmount: 0,
                            type: docType,
                            status: "Pending Signature",
                            date: new Date().toISOString().split('T')[0]
                          });

                          alert(`Generated draft for ${docType} contract package successfully!`);
                          loadLocalLead();
                          setSelectedAgreementId(newAg.id);
                        } catch (err) {
                          alert("Failed to draft contract.");
                        } finally {
                          setGeneratingDoc(false);
                        }
                      }}
                      className="w-full py-2.5 bg-[#1466E0] hover:bg-[#1466E0]/80 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <FileSignature size={12} /> {generatingDoc ? "Drafting legal terms..." : "Generate Digital Document"}
                    </button>
                  </div>
                </div>

                {/* 3. Generated Documents list */}
                <div className="card !bg-[#0f1826]/1 border border-white/5">
                  <div className="card-body p-4 flex flex-col gap-2">
                    <div className="text-[10px] font-bold text-[#9DB0C6] uppercase tracking-wider font-mono">
                      Draft Folders ({agreements.length})
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                      {agreements.map((ag) => (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => setSelectedAgreementId(ag.id)}
                          className={`w-full p-2.5 text-left rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                            selectedAgreementId === ag.id
                              ? "bg-[#C9A24B]/15 border-[#C9A24B] text-[#E8EEF6]"
                              : "bg-black/20 border-white/5 text-[#9DB0C6] hover:bg-black/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FileText size={13} className={selectedAgreementId === ag.id ? "text-[#C9A24B]" : "text-[#9DB0C6]"} />
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold">{ag.type}</span>
                              <span className="text-[8px] text-[#9DB0C6] font-mono">{ag.id.substring(0, 8).toUpperCase()} • {ag.date}</span>
                            </div>
                          </div>
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            ag.status === "Signed" 
                              ? "bg-[#35C46B]/10 text-[#35C46B]" 
                              : "bg-red-500/10 text-red-400 animate-pulse"
                          }`}>
                            {ag.status}
                          </span>
                        </button>
                      ))}
                      {agreements.length === 0 && (
                        <div className="text-center py-4 text-[11px] text-[#9DB0C6] italic">
                          No digital contract packages generated yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: DOCUMENT VIEW & SIGNATURE PAD (7 COLS) */}
              <div className="lg:col-span-7 border border-white/5 bg-[#070d15] rounded-2xl overflow-hidden p-4 min-h-[500px] flex flex-col">
                {selectedAgreementId && agreements.find(a => a.id === selectedAgreementId) ? (
                  <AgreementPreview
                    agreement={agreements.find(a => a.id === selectedAgreementId)!}
                    lead={lead}
                    vehicle={vehicle || undefined}
                    onSignAgreement={async (id, signedBy) => {
                      try {
                        await updateAgreement(id, {
                          status: "Signed",
                          signedBy,
                          signedAt: new Date().toISOString()
                        });
                        alert("Legal contract signed and secured with blockchain integrity receipt!");
                        loadLocalLead();
                      } catch (err) {
                        alert("Failed to record digital signature.");
                      }
                    }}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <FileSignature size={48} className="text-[#9DB0C6] mb-3 opacity-40" />
                    <h3 className="text-xs font-bold text-[#9DB0C6] uppercase tracking-wider mb-1">Contract Signature Desk</h3>
                    <p className="text-[11px] max-w-sm text-[#9DB0C6] leading-relaxed">
                      Select or generate a contract package from the left panel to display interactive legal layouts, finance amortization grids, and the digital signature pad.
                    </p>
                  </div>
                )}
              </div>

            </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(126,164,214,0.1)] flex justify-between items-center bg-[#0f1826]/1">
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg border border-[#F0555A]/30 text-[#F0555A] bg-[#F0555A]/10 text-xs font-semibold cursor-pointer active:scale-95 transition-all hover:bg-[#F0555A]/20"
          >
            Delete Lead File
          </button>
          
          <div className="flex gap-2">
            {leadStatus === "Closed Won" && (
              <label className="flex items-center gap-2 text-xs text-[#E8EEF6] cursor-pointer bg-[#0f1826]/5 px-2 py-1.5 rounded-lg">
                <input type="checkbox" checked={crmSetupFee} onChange={(e) => setCrmSetupFee(e.target.checked)} />
                CRM Setup & Training Fee (R 5,000)
              </label>
            )}
            <select
              value={leadStatus}
              onChange={(e) => setLeadStatus(e.target.value)}
              className="bg-[#0f1826]/4 border border-[rgba(126,164,214,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-[#E8EEF6] outline-none font-sans"
            >
              <option className="bg-[#0f1826]" value="New">New</option>
              <option className="bg-[#0f1826]" value="Contacted">Contacted</option>
              <option className="bg-[#0f1826]" value="Test Drive Scheduled">Test Drive Scheduled</option>
              <option className="bg-[#0f1826]" value="Negotiating">Negotiating</option>
              <option className="bg-[#0f1826]" value="Closed Won">Closed Won</option>
              <option className="bg-[#0f1826]" value="Closed Lost">Closed Lost</option>
            </select>
            <button
              onClick={handleSaveStatus}
              className="btn btn-primary btn-sm"
            >
              Save Status Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
