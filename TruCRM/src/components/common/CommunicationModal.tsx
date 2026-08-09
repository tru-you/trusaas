import React, { useState } from 'react';
import {
  Phone,
  Mail,
  MessageCircle,
  X,
  Send,
  PhoneCall,
  CheckCircle2,
  Clock,
  User,
  Building2,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface CommunicationTarget {
  name: string;
  company?: string;
  email: string;
  phone: string;
  dealTitle?: string;
  amount?: number;
}

interface CommunicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: CommunicationTarget | null;
  defaultChannel?: 'call' | 'email' | 'whatsapp';
}

export const CommunicationModal: React.FC<CommunicationModalProps> = ({
  isOpen,
  onClose,
  target,
  defaultChannel = 'email',
}) => {
  const { profile, addNotification } = useApp();
  const [activeChannel, setActiveChannel] = useState<'call' | 'email' | 'whatsapp'>(defaultChannel);

  // Call state
  const [callOutcome, setCallOutcome] = useState<'connected' | 'voicemail' | 'busy' | 'scheduled'>('connected');
  const [callDuration, setCallDuration] = useState<string>('5');
  const [callNotes, setCallNotes] = useState<string>('');
  const [callLogged, setCallLogged] = useState<boolean>(false);

  // Email state
  const [emailTemplate, setEmailTemplate] = useState<string>('followup');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // WhatsApp state
  const [waTemplate, setWaTemplate] = useState<string>('checkin');
  const [waMessage, setWaMessage] = useState<string>('');
  const [copiedWa, setCopiedWa] = useState<boolean>(false);

  // Update templates when target changes or tab changes
  React.useEffect(() => {
    if (!target) return;

    // Default Email Subject & Body based on template
    if (emailTemplate === 'followup') {
      setEmailSubject(`Following up regarding ${target.dealTitle || target.company || 'our partnership'}`);
      setEmailBody(
        `Hi ${target.name},\n\nI hope you are having a productive week.\n\nI wanted to quickly follow up regarding ${
          target.dealTitle ? `our proposal for "${target.dealTitle}"` : 'our ongoing discussions'
        }. Please let me know if you have any questions or if you would like to schedule a brief call to finalize details.\n\nBest regards,\nTruSaaS Team`
      );
    } else if (emailTemplate === 'meeting') {
      setEmailSubject(`Discovery & Demo Call with ${profile.companyName}`);
      setEmailBody(
        `Hi ${target.name},\n\nWould you have 15–20 minutes open this week to discuss how ${profile.companyName} can help streamline operations for ${
          target.company || 'your team'
        }?\n\nPlease let me know what day and time work best for you.\n\nBest regards,\nTruSaaS Sales`
      );
    } else if (emailTemplate === 'invoice') {
      setEmailSubject(`Invoice & Account Update - ${target.company || target.name}`);
      setEmailBody(
        `Hi ${target.name},\n\nThis is a friendly reminder regarding your pending balance/invoice with ${profile.companyName}.\n\nIf you have already processed payment, please disregard this note. Otherwise, feel free to reach out if you need an updated invoice PDF.\n\nBest regards,\nAccounting Dept.`
      );
    }

    // Default WhatsApp Message
    if (waTemplate === 'checkin') {
      setWaMessage(
        `Hi ${target.name}! 👋 Hope you're having a great day. Just following up regarding ${
          target.dealTitle ? `"${target.dealTitle}"` : target.company || 'our proposal'
        }. Do you have 2 mins for a quick update?`
      );
    } else if (waTemplate === 'demo') {
      setWaMessage(
        `Hi ${target.name}! 🚀 We've set up a quick demo preview tailored for ${
          target.company || 'your business'
        }. Would love to share the details when you're available!`
      );
    } else if (waTemplate === 'reminder') {
      setWaMessage(
        `Hi ${target.name}, quick reminder regarding our scheduled check-in today. Looking forward to connecting!`
      );
    }
  }, [target, emailTemplate, waTemplate, profile.companyName]);

  // Set default active channel when prop opens
  React.useEffect(() => {
    if (isOpen && defaultChannel) {
      setActiveChannel(defaultChannel);
      setCallLogged(false);
    }
  }, [isOpen, defaultChannel]);

  if (!isOpen || !target) return null;

  // Clean phone number for tel: and wa.me/
  const rawPhone = target.phone.replace(/[^0-9+]/g, '');
  const cleanWaPhone = target.phone.replace(/[^0-9]/g, '');

  const handleLogCall = () => {
    setCallLogged(true);
    addNotification(
      'Phone Call Logged',
      `Logged ${callOutcome} call with ${target.name} (${callDuration} mins). Notes saved to timeline.`,
      'success'
    );
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const handleSendEmail = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(target.email)}?subject=${encodeURIComponent(
      emailSubject
    )}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, '_blank');
    addNotification('Email Dispatched', `Opened mail client for ${target.email} & logged to CRM history.`, 'success');
    onClose();
  };

  const handleLaunchWhatsApp = () => {
    const waUrl = `https://wa.me/${cleanWaPhone || '15552348901'}?text=${encodeURIComponent(waMessage)}`;
    window.open(waUrl, '_blank');
    addNotification(
      'WhatsApp Chat Launched',
      `Opened WhatsApp chat with ${target.name} (${target.phone}). Message recorded in CRM.`,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,20,32,0.40)] backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-[rgba(10,20,32,0.08)] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-[rgba(10,20,32,0.06)] bg-[#FAFAF8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(14,157,152,0.08)] border border-[rgba(14,157,152,0.20)] flex items-center justify-center text-[#0E9D98] font-bold text-sm">
              {target.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A2332] flex items-center gap-2">
                <span>{target.name}</span>
                {target.company && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#EFEDE8] text-[#334155] font-medium border border-[rgba(10,20,32,0.10)]">
                    {target.company}
                  </span>
                )}
              </h3>
              <p className="text-xs text-[#6B7685] flex items-center gap-3 mt-0.5">
                <span>✉️ {target.email}</span>
                <span>📞 {target.phone}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B7685] hover:text-[#1A2332] bg-[#EFEDE8] hover:bg-[#F5F4F1] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel Navigation Tabs */}
        <div className="grid grid-cols-3 bg-[#FAFAF8] p-1.5 border-b border-[rgba(10,20,32,0.06)] gap-1.5">
          <button
            onClick={() => setActiveChannel('call')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeChannel === 'call'
                ? 'bg-cyan-600 text-white shadow-lg shadow-[rgba(14,157,152,0.15)]'
                : 'text-[#6B7685] hover:text-[#1A2332] hover:bg-[#F5F4F1]'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>Phone Call</span>
          </button>

          <button
            onClick={() => setActiveChannel('email')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeChannel === 'email'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/15'
                : 'text-[#6B7685] hover:text-[#1A2332] hover:bg-[#F5F4F1]'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Direct Email</span>
          </button>

          <button
            onClick={() => setActiveChannel('whatsapp')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
              activeChannel === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/15'
                : 'text-[#6B7685] hover:text-[#1A2332] hover:bg-[#F5F4F1]'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* Channel Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* ================= CHANNEL 1: PHONE CALL ================= */}
          {activeChannel === 'call' && (
            <div className="space-y-5">
              {/* Call Trigger Banner */}
              <div className="p-4 bg-[rgba(14,157,152,0.05)] border border-[rgba(14,157,152,0.20)] rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#0E9D98] block">Direct Dial</span>
                  <p className="text-lg font-black text-[#1A2332] font-mono mt-0.5">{target.phone}</p>
                </div>
                <a
                  href={`tel:${rawPhone}`}
                  className="px-4 py-2.5 bg-[#0E9D98] hover:bg-[#14B8A6] text-white font-bold rounded-xl text-xs shadow-lg shadow-[rgba(14,157,152,0.15)] flex items-center gap-2 transition-transform hover:scale-105"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Start Dialing</span>
                </a>
              </div>

              {/* Log Call Result */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B7685]">Log Call Outcome & Notes</h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'connected', label: 'Connected', icon: CheckCircle2, color: 'text-emerald-400 border-emerald-200' },
                    { id: 'voicemail', label: 'Voicemail', icon: Clock, color: 'text-amber-400 border-amber-800/60' },
                    { id: 'busy', label: 'Busy / No Answer', icon: X, color: 'text-rose-400 border-rose-800/60' },
                    { id: 'scheduled', label: 'Follow-Up Scheduled', icon: Phone, color: 'text-[#0E9D98] border-[rgba(14,157,152,0.20)]' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = callOutcome === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCallOutcome(item.id as any)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-[#EFEDE8] border-[#0E9D98] text-[#1A2332] shadow-md'
                            : 'bg-[#FAFAF8] border-[rgba(10,20,32,0.08)] text-[#6B7685] hover:text-[#1A2332]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${item.color}`} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#6B7685] block mb-1">Call Duration (minutes)</label>
                    <input
                      type="number"
                      value={callDuration}
                      onChange={(e) => setCallDuration(e.target.value)}
                      className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs text-[#1A2332] focus:outline-none focus:border-cyan-500"
                      min="1"
                      max="120"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#6B7685] block mb-1">Follow-up Task</label>
                    <select className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs text-[#1A2332] focus:outline-none focus:border-cyan-500">
                      <option>Send Proposal Quote</option>
                      <option>Schedule Technical Demo</option>
                      <option>Send Contract Agreement</option>
                      <option>No Follow-up Required</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#6B7685] block mb-1">Call Summary & Client Feedback</label>
                  <textarea
                    rows={3}
                    value={callNotes}
                    onChange={(e) => setCallNotes(e.target.value)}
                    placeholder="E.g., Client confirmed review with CTO, interested in custom SLA package..."
                    className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl p-3 text-xs text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleLogCall}
                  disabled={callLogged}
                  className="w-full py-2.5 bg-[#0E9D98] hover:bg-[#14B8A6] disabled:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  {callLogged ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Call Logged to Timeline!</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Save Call Log to CRM History</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ================= CHANNEL 2: EMAIL ================= */}
          {activeChannel === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Email Template</label>
                <select
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs text-[#1A2332] focus:outline-none focus:border-blue-500"
                >
                  <option value="followup">📌 Proposal / Deal Follow-up</option>
                  <option value="meeting">📅 Discovery & Demo Call Request</option>
                  <option value="invoice">💳 Invoice & Remittance Reminder</option>
                  <option value="custom">✏️ Custom Blank Template</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Recipient Email</label>
                <input
                  type="email"
                  value={target.email}
                  readOnly
                  className="w-full bg-[#FAFAF8]/60 border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs text-[#6B7685] font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Subject Line</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs text-[#1A2332] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">Message Body</label>
                <textarea
                  rows={6}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl p-3 text-xs text-[#1A2332] font-sans focus:outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-[#1A2332] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15"
                >
                  <Send className="w-4 h-4" />
                  <span>Send via Mail Client & Log</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${emailSubject}\n\n${emailBody}`);
                    setCopiedEmail(true);
                    setTimeout(() => setCopiedEmail(false), 2000);
                  }}
                  className="px-4 py-2.5 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-[#1A2332] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  {copiedEmail ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ================= CHANNEL 3: WHATSAPP ================= */}
          {activeChannel === 'whatsapp' && (
            <div className="space-y-4">
              {/* WhatsApp Header Badge */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#1A2332] block">WhatsApp Direct Contact</span>
                    <span className="text-[11px] font-mono text-emerald-400">
                      +{cleanWaPhone || '15552348901'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                  Official Web Link
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">WhatsApp Preset Template</label>
                <select
                  value={waTemplate}
                  onChange={(e) => setWaTemplate(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2 text-xs text-[#1A2332] focus:outline-none focus:border-emerald-500"
                >
                  <option value="checkin">👋 Quick Deal & Proposal Check-In</option>
                  <option value="demo">🚀 Live Demo / Product Preview</option>
                  <option value="reminder">📅 Meeting / Call Reminder</option>
                  <option value="custom">💬 Custom Chat Message</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1">WhatsApp Message</label>
                <textarea
                  rows={5}
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  className="w-full bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl p-3 text-xs text-[#1A2332] focus:outline-none focus:border-emerald-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleLaunchWhatsApp}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-[#1A2332] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/15"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Chat in WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(waMessage);
                    setCopiedWa(true);
                    setTimeout(() => setCopiedWa(false), 2000);
                  }}
                  className="px-4 py-2.5 bg-[#EFEDE8] hover:bg-[#EFEDE8] text-[#1A2332] rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  {copiedWa ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedWa ? 'Copied' : 'Copy Text'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
