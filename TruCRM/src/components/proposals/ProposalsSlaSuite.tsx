import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  FileSignature,
  Printer,
  Trash2,
  X,
  ExternalLink,
  Zap,
  TrendingUp,
  ChevronRight,
  ShieldAlert,
  Building,
  Mail,
  Calendar,
  Check,
  DollarSign,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Proposal, ProposalStatus, SlaContract, SlaIncident } from '../../types';
import { useFormAutoSave } from '../../hooks/useFormAutoSave';

/**
 * Draw-to-sign signature pad. Works with mouse or finger (pointer events).
 * Calls onSign with a PNG data URL once the client has drawn something.
 */
const SignaturePad: React.FC<{ onSign: (dataUrl: string, name: string) => void }> = ({ onSign }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inked, setInked] = useState(false);
  const [name, setName] = useState('');
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#7FF0EA';
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = pos(e);
    setInked(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setInked(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-xl border border-slate-800 bg-slate-950 h-28 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-28 touch-none cursor-crosshair"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
        />
        {!inked && (
          <span className="absolute inset-0 flex items-center justify-center text-slate-600 pointer-events-none text-lg italic">
            sign here
          </span>
        )}
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="text-[10px] font-semibold text-slate-500 block mb-1">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Authorised signatory"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button
          type="button"
          onClick={clear}
          className="px-3 py-2 text-[11px] text-slate-400 hover:text-slate-200"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={!inked || !name.trim()}
          onClick={() => onSign(canvasRef.current!.toDataURL('image/png'), name.trim())}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <FileSignature className="w-4 h-4" />
          <span>Authorize &amp; Sign</span>
        </button>
      </div>
    </div>
  );
};

export const ProposalsSlaSuite: React.FC = () => {
  const {
    proposals,
    slaContracts,
    addProposal,
    updateProposal,
    deleteProposal,
    sendProposal,
    acceptProposal,
    addSlaContract,
    deleteSlaContract,
    profile,
    deals,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'proposals' | 'slas'>('proposals');
  const [proposalStatusFilter, setProposalStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected proposal for viewing document modal
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // Selected SLA contract for incident logging / details
  const [selectedSla, setSelectedSla] = useState<SlaContract | null>(null);

  // Delete confirmation modal states
  const [proposalToDelete, setProposalToDelete] = useState<Proposal | null>(null);
  const [slaToDelete, setSlaToDelete] = useState<SlaContract | null>(null);

  // Modals for creating
  const [showCreateProposalModal, setShowCreateProposalModal] = useState(false);
  const [showCreateSlaModal, setShowCreateSlaModal] = useState(false);
  const [showLogIncidentModal, setShowLogIncidentModal] = useState(false);

  // New Proposal Form State with localStorage auto-save
  const [proposalForm, setProposalForm, clearProposalDraft, proposalHasDraft, proposalLastSaved] = useFormAutoSave('proposals_form', {
    newTitle: '',
    newClientName: '',
    newCompany: '',
    newEmail: '',
    newDealId: '',
    newSlaTier: 'Platinum 99.9%' as 'Platinum 99.9%' | 'Gold 99.5%' | 'Standard 99.0%' | 'Custom',
    newValidUntil: '2026-09-30',
    newScope: '',
    itemsList: [{ description: 'Vehicle — make, model, variant', quantity: 1, unitPrice: 25000 }],
  });

  const { newTitle, newClientName, newCompany, newEmail, newDealId, newSlaTier, newValidUntil, newScope, itemsList } = proposalForm;

  const updateProposalField = (field: string, val: any) => {
    setProposalForm((prev) => ({ ...prev, [field]: val }));
  };

  const setNewTitle = (val: string) => updateProposalField('newTitle', val);
  const setNewClientName = (val: string) => updateProposalField('newClientName', val);
  const setNewCompany = (val: string) => updateProposalField('newCompany', val);
  const setNewEmail = (val: string) => updateProposalField('newEmail', val);
  const setNewDealId = (val: string) => updateProposalField('newDealId', val);
  const setNewSlaTier = (val: any) => updateProposalField('newSlaTier', val);
  const setNewValidUntil = (val: string) => updateProposalField('newValidUntil', val);
  const setNewScope = (val: string) => updateProposalField('newScope', val);
  const setItemsList = (val: any) => updateProposalField('itemsList', typeof val === 'function' ? val(proposalForm.itemsList) : val);

  // New SLA Form State
  const [newSlaClient, setNewSlaClient] = useState('');
  const [newSlaCompany, setNewSlaCompany] = useState('');
  const [newSlaTierName, setNewSlaTierName] = useState<'Platinum 24/7' | 'Gold 12/5' | 'Standard Business'>('Platinum 24/7');
  const [newSlaUptimeTarget, setNewSlaUptimeTarget] = useState(99.9);
  const [newSlaResponseTime, setNewSlaResponseTime] = useState(15);
  const [newSlaResolutionHours, setNewSlaResolutionHours] = useState(4);
  const [newSlaMonthlyFee, setNewSlaMonthlyFee] = useState(2500);
  const [newSlaCoverage, setNewSlaCoverage] = useState('24/7/365 Dedicated Escalation Desk & Phone Priority Queue');

  // New Incident Form State
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'Critical' | 'Major' | 'Minor'>('Minor');
  const [incidentResponseMins, setIncidentResponseMins] = useState(10);

  // Computed metrics
  const totalProposalValue = proposals.reduce((acc, p) => acc + p.amount, 0);
  const acceptedProposals = proposals.filter((p) => p.status === 'Accepted');
  const acceptanceRate = proposals.length > 0 ? Math.round((acceptedProposals.length / proposals.length) * 100) : 0;
  const pendingSentCount = proposals.filter((p) => p.status === 'Sent').length;

  const filteredProposals = proposals.filter((p) => {
    const matchesStatus = proposalStatusFilter === 'All' || p.status === proposalStatusFilter;
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      p.title.toLowerCase().includes(query) ||
      p.company.toLowerCase().includes(query) ||
      p.clientName.toLowerCase().includes(query) ||
      p.proposalNumber.toLowerCase().includes(query);
    return matchesStatus && matchesQuery;
  });

  const filteredSlas = slaContracts.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.company.toLowerCase().includes(query) ||
      s.clientName.toLowerCase().includes(query) ||
      s.tier.toLowerCase().includes(query)
    );
  });

  // Handle line items add/remove
  const handleAddItem = () => {
    setItemsList([...itemsList, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItemsList(itemsList.filter((_, i) => i !== index));
  };

  const handleCreateProposalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formattedItems = itemsList.map((item, idx) => ({
      id: `pi-${Date.now()}-${idx}`,
      description: item.description || 'Service Deliverable',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unitPrice) || 0,
      amount: (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0),
    }));

    const calculatedTotal = formattedItems.reduce((acc, item) => acc + item.amount, 0);

    addProposal({
      title: newTitle,
      clientName: newClientName,
      company: newCompany,
      clientEmail: newEmail,
      dealId: newDealId || undefined,
      status: 'Draft',
      amount: calculatedTotal,
      slaTier: newSlaTier,
      validUntil: newValidUntil,
      scopeSummary: newScope || 'Scope of work details agreed as per requirement specification.',
      items: formattedItems,
      deliverables: ['System Architecture Design', 'Deployment Verification & SLA Sign-off'],
    });

    setShowCreateProposalModal(false);
    resetProposalForm();
  };

  const resetProposalForm = () => {
    clearProposalDraft();
  };

  const handleCreateSlaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addSlaContract({
      clientName: newSlaClient,
      company: newSlaCompany,
      tier: newSlaTierName,
      uptimeTarget: Number(newSlaUptimeTarget),
      actualUptime: Number(newSlaUptimeTarget),
      maxResponseTimeMins: Number(newSlaResponseTime),
      avgResponseTimeMins: Math.round(Number(newSlaResponseTime) * 0.6),
      maxResolutionHours: Number(newSlaResolutionHours),
      status: 'Compliant',
      renewalDate: '2027-08-01',
      supportCoverage: newSlaCoverage,
      monthlyFee: Number(newSlaMonthlyFee),
      incidents: [],
    });
    setShowCreateSlaModal(false);
    setNewSlaClient('');
    setNewSlaCompany('');
  };

  const handleLogIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSla) return;

    const newIncident: SlaIncident = {
      id: `inc-${Date.now()}`,
      title: incidentTitle,
      severity: incidentSeverity,
      reportedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      resolvedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      responseTimeMinutes: Number(incidentResponseMins),
      targetResponseMinutes: selectedSla.maxResponseTimeMins,
      status: 'Resolved',
    };

    const updatedSla: SlaContract = {
      ...selectedSla,
      incidents: [newIncident, ...selectedSla.incidents],
    };

    setSelectedSla(updatedSla);
    setShowLogIncidentModal(false);
    setIncidentTitle('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-700 text-cyan-400 flex items-center justify-center shadow-lg">
              <FileSignature className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Proposals & SLA Suite
                <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-zinc-900 text-cyan-300 border border-zinc-700">
                  Client Agreements
                </span>
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Build vehicle quotations, rent-to-own agreements and fleet service plans, capture the customer signature, and track fleet service contracts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateProposalModal(true)}
            className="px-4 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4 text-cyan-600" />
            <span>Create Proposal</span>
          </button>
          <button
            onClick={() => setShowCreateSlaModal(true)}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>New SLA Policy</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('proposals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'proposals'
                ? 'bg-white text-black shadow-md'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <FileText className="w-4 h-4 text-cyan-500" />
            <span>Client Proposals ({proposals.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('slas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'slas'
                ? 'bg-white text-black shadow-md'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-cyan-500" />
            <span>SLA Contracts ({slaContracts.length})</span>
          </button>
        </div>

        {/* Global Filter Search */}
        <div className="relative w-64 hidden sm:block">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            placeholder={activeTab === 'proposals' ? 'Search proposals...' : 'Search SLA contracts...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-zinc-700"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* PROPOSALS TAB CONTENT */}
      {activeTab === 'proposals' && (
        <div className="space-y-6">
          {/* Key Metric Header Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Proposal Pipeline Value</span>
                <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800/60 text-cyan-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-3">{profile.currency}{totalProposalValue.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-400" />
                <span>Across {proposals.length} active documents</span>
              </p>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Acceptance Win Rate</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800/60 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-3">{acceptanceRate}%</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {acceptedProposals.length} proposals signed & won
              </p>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Pending Review</span>
                <div className="w-8 h-8 rounded-xl bg-amber-950 border border-amber-800/60 text-amber-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-3">{pendingSentCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">Awaiting client signature</p>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">SLA Tier Embedded</span>
                <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800/60 text-cyan-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-black text-white mt-3">100%</p>
              <p className="text-[11px] text-slate-400 mt-1">Standardized SLA terms</p>
            </div>
          </div>

          {/* Status Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {['All', 'Draft', 'Sent', 'Accepted', 'Expired'].map((st) => (
              <button
                key={st}
                onClick={() => setProposalStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  proposalStatusFilter === st
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Proposals Table */}
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Ref # & Proposal Title</th>
                    <th className="px-6 py-3.5">Client & Company</th>
                    <th className="px-6 py-3.5">Contract Value</th>
                    <th className="px-6 py-3.5">SLA Guarantee</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Valid Until</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredProposals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <FileText className="w-8 h-8 text-slate-500" />
                          <p className="text-sm font-semibold text-slate-200">No proposals found</p>
                          <p className="text-xs text-slate-500">
                            {searchQuery ? `No proposal matching "${searchQuery}"` : 'Create your first client proposal above.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProposals.map((prop) => (
                      <tr key={prop.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-800/60">
                              {prop.proposalNumber}
                            </span>
                          </div>
                          <p className="font-bold text-white text-sm mt-1">{prop.title}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-200">{prop.company}</p>
                          <p className="text-xs text-slate-400">{prop.clientName}</p>
                        </td>
                        <td className="px-6 py-4 font-bold text-white text-sm">
                          {profile.currency}{prop.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 flex items-center gap-1.5 w-fit">
                            <ShieldCheck className="w-3 h-3" />
                            {prop.slaTier}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                              prop.status === 'Accepted'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                : prop.status === 'Sent'
                                ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                                : prop.status === 'Draft'
                                ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                            }`}
                          >
                            {prop.status === 'Accepted' && <CheckCircle2 className="w-3 h-3" />}
                            {prop.status === 'Sent' && <Send className="w-3 h-3" />}
                            {prop.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {prop.validUntil}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedProposal(prop)}
                              className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                              title="View Document & Signature"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View Doc</span>
                            </button>

                            {prop.status === 'Draft' && (
                              <button
                                onClick={() => sendProposal(prop.id)}
                                className="p-1.5 bg-slate-900 hover:bg-cyan-950 text-cyan-400 border border-slate-800 hover:border-cyan-800/60 rounded-lg transition-colors"
                                title="Send Proposal to Client"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {prop.status !== 'Accepted' && (
                              <button
                                onClick={() => acceptProposal(prop.id)}
                                className="p-1.5 bg-slate-900 hover:bg-emerald-950 text-emerald-400 border border-slate-800 hover:border-emerald-800/60 rounded-lg transition-colors"
                                title="Mark Signed & Accepted"
                              >
                                <FileSignature className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => setProposalToDelete(prop)}
                              className="p-1.5 bg-slate-950 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/60 rounded-lg transition-colors"
                              title="Delete proposal"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SLA CONTRACTS TAB CONTENT */}
      {activeTab === 'slas' && (
        <div className="space-y-6">
          {/* SLA Performance Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Average System Uptime</span>
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white mt-3">99.77%</p>
              <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Exceeding 99.5% minimum SLA</span>
              </p>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Response SLA Compliance</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-black text-white mt-3">100%</p>
              <p className="text-[11px] text-slate-400 mt-1">Avg response time: 8.3 mins</p>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Active SLA Agreements</span>
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-black text-white mt-3">{slaContracts.length}</p>
              <p className="text-[11px] text-slate-400 mt-1">Enterprise & Gold tier contracts</p>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400">Monthly service-plan income</span>
                <DollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-white mt-3">
                {profile.currency}{slaContracts.reduce((acc, s) => acc + s.monthlyFee, 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Recurring service revenue</p>
            </div>
          </div>

          {/* SLA Contracts Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSlas.map((sla) => (
              <div
                key={sla.id}
                className="bg-slate-900/80 rounded-2xl border border-slate-800 p-5 shadow-xl backdrop-blur-md space-y-4 hover:border-slate-700 transition-all relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                      {sla.tier}
                    </span>
                    <h3 className="font-bold text-white text-base mt-2">{sla.company}</h3>
                    <p className="text-xs text-slate-400">{sla.clientName}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      sla.status === 'Compliant'
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        : 'bg-amber-950/80 text-amber-400 border border-amber-800/60'
                    }`}
                  >
                    {sla.status}
                  </span>
                </div>

                {/* Uptime Gauge */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Guaranteed Uptime</span>
                    <span className="font-bold text-white">
                      {sla.actualUptime}% / {sla.uptimeTarget}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        sla.actualUptime >= sla.uptimeTarget ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(sla.actualUptime, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Response / Support stats */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Max Response Time</span>
                    <span className="font-bold text-slate-200">{sla.maxResponseTimeMins} mins</span>
                  </div>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Monthly SLA Fee</span>
                    <span className="font-bold text-emerald-400">{profile.currency}{sla.monthlyFee.toLocaleString()}/mo</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Support Coverage</span>
                  <p className="line-clamp-2 text-slate-300">{sla.supportCoverage}</p>
                </div>

                {/* Card Action footer */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                  <button
                    onClick={() => setSelectedSla(sla)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                  >
                    <span>View Incidents ({sla.incidents.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSlaToDelete(sla)}
                    className="p-1.5 bg-slate-950 hover:bg-rose-950/80 text-slate-500 hover:text-rose-400 rounded-lg border border-slate-800 transition-colors"
                    title="Delete SLA Contract"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROPOSAL DOCUMENT PREVIEW & SIGNATURE MODAL */}
      {selectedProposal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-3xl p-6 sm:p-8 space-y-6 text-slate-200 my-8">
            {/* Modal Header Actions */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950 px-2.5 py-1 rounded-lg border border-cyan-800/60">
                  {selectedProposal.proposalNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedProposal.status === 'Accepted'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                      : 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                  }`}
                >
                  {selectedProposal.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setSelectedProposal(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Document Body Branding — this block is what prints (borderless). */}
            <div className="print-doc bg-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-slate-800/80 pb-6">
                <div>
                  <h2 className="text-lg font-bold text-white">{profile.companyName}</h2>
                  <p className="text-xs text-slate-400 mt-1">{profile.tagline}</p>
                  <p className="text-xs text-slate-400">{profile.email}</p>
                </div>
                <div className="text-left sm:text-right text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-white text-sm">{selectedProposal.title}</p>
                  <p>Issue Date: {selectedProposal.createdDate}</p>
                  <p>Valid Until: {selectedProposal.validUntil}</p>
                </div>
              </div>

              {/* Client Details & Scope */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-900/80 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Prepared For</span>
                  <p className="font-bold text-white text-sm mt-0.5">{selectedProposal.clientName}</p>
                  <p className="text-xs text-slate-300">{selectedProposal.company}</p>
                  <p className="text-xs text-cyan-400 mt-1">{selectedProposal.clientEmail}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block">Cover / service plan</span>
                  <p className="font-bold text-cyan-400 text-sm mt-0.5">{selectedProposal.slaTier}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Cover level attached to this vehicle / fleet.
                  </p>
                </div>
              </div>

              {/* Scope Summary */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Details & What’s Included</h4>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  {selectedProposal.scopeSummary}
                </p>
              </div>

              {/* Line Items Pricing Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Pricing</h4>
                <table className="w-full text-left text-xs text-slate-300 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase">
                      <th className="py-2">Item Description</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Unit Rate</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {selectedProposal.items.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 font-medium text-slate-200">{item.description}</td>
                        <td className="py-2.5 text-center text-slate-400">{item.quantity}</td>
                        <td className="py-2.5 text-right text-slate-400">{profile.currency}{item.unitPrice.toLocaleString()}</td>
                        <td className="py-2.5 text-right font-bold text-white">{profile.currency}{item.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <div className="text-right">
                    <span className="text-xs text-slate-400">Total:</span>
                    <p className="text-xl font-black text-white">{profile.currency}{selectedProposal.amount.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Signature Box — draw-to-sign, then it becomes the signed mark. */}
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                  Electronic Signature
                </span>

                {selectedProposal.signatureStatus === 'Signed' && selectedProposal.signatureImage ? (
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <img
                        src={selectedProposal.signatureImage}
                        alt="Signature"
                        className="h-16 w-auto max-w-[240px]"
                      />
                      <div className="border-t border-slate-700 mt-1 pt-1">
                        <p className="text-sm font-bold text-white">{selectedProposal.signerName}</p>
                        <p className="text-[11px] text-slate-400">
                          Signed &amp; accepted on {selectedProposal.signedDate}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold no-print">
                      <CheckCircle2 className="w-4 h-4" />
                      Authorised
                    </span>
                  </div>
                ) : (
                  <div className="no-print">
                    <SignaturePad
                      onSign={(dataUrl, name) => {
                        const signed: Proposal = {
                          ...selectedProposal,
                          status: 'Accepted',
                          signatureStatus: 'Signed',
                          signedDate: new Date().toISOString().split('T')[0],
                          signatureImage: dataUrl,
                          signerName: name,
                        };
                        // Persist the signature first, then run the acceptance
                        // automation (marks a linked CRM deal won). acceptProposal
                        // spreads the now-updated proposal, so the signature survives.
                        updateProposal(signed);
                        acceptProposal(selectedProposal.id);
                        setSelectedProposal(signed);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLA CONTRACT INCIDENTS MODAL */}
      {selectedSla && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl p-6 space-y-5 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedSla.company} SLA Incidents Log</h3>
                <p className="text-xs text-slate-400">Guaranteed Max Response: {selectedSla.maxResponseTimeMins} mins</p>
              </div>
              <button
                onClick={() => setSelectedSla(null)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Contract Tier</span>
                <span className="font-bold text-cyan-400">{selectedSla.tier}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Actual Uptime</span>
                <span className="font-bold text-emerald-400">{selectedSla.actualUptime}%</span>
              </div>
              <button
                onClick={() => setShowLogIncidentModal(true)}
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                + Log Incident Event
              </button>
            </div>

            {/* Incidents List */}
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {selectedSla.incidents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-950 rounded-xl border border-slate-800">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                  <p className="font-semibold text-slate-300">100% Zero Breaches Logged</p>
                  <p>All service ticket SLAs responded to within required turnaround window.</p>
                </div>
              ) : (
                selectedSla.incidents.map((inc) => (
                  <div key={inc.id} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white">{inc.title}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {inc.severity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>Reported: {inc.reportedAt}</span>
                      <span className="font-semibold text-emerald-400">
                        Response Time: {inc.responseTimeMinutes}m (Target: &lt;{inc.targetResponseMinutes}m)
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE PROPOSAL MODAL */}
      {showCreateProposalModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateProposalSubmit}
            className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl p-6 space-y-4 text-slate-200 my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Generate Client Proposal</h3>
                {proposalLastSaved && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{proposalLastSaved}</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCreateProposalModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-400 block mb-1">Proposal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Cloud Modernization"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sundays River Citrus Co."
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Client Contact Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Riaan van Wyk"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Client Email</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. m.vance@apex.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">SLA Tier Attached</label>
                <select
                  value={newSlaTier}
                  onChange={(e) => setNewSlaTier(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                >
                  <option value="Platinum 99.9%">Platinum 99.9% Guarantee</option>
                  <option value="Gold 99.5%">Gold 99.5% Guarantee</option>
                  <option value="Standard 99.0%">Standard 99.0% Guarantee</option>
                  <option value="Custom">Custom SLA Tier</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Valid Until Date</label>
                <input
                  type="date"
                  value={newValidUntil}
                  onChange={(e) => setNewValidUntil(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-400 block mb-1 text-xs">Scope Summary</label>
              <textarea
                rows={2}
                placeholder="Brief summary of work, deliverables, and service milestones..."
                value={newScope}
                onChange={(e) => setNewScope(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
              />
            </div>

            {/* Line items editor */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Line Items & Pricing</span>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-cyan-400 hover:underline font-semibold"
                >
                  + Add Item
                </button>
              </div>

              {itemsList.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => {
                      const updated = [...itemsList];
                      updated[idx].description = e.target.value;
                      setItemsList(updated);
                    }}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...itemsList];
                      updated[idx].quantity = Number(e.target.value);
                      setItemsList(updated);
                    }}
                    className="w-16 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-center"
                  />
                  <input
                    type="number"
                    placeholder="Rate"
                    value={item.unitPrice}
                    onChange={(e) => {
                      const updated = [...itemsList];
                      updated[idx].unitPrice = Number(e.target.value);
                      setItemsList(updated);
                    }}
                    className="w-24 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-right"
                  />
                  {itemsList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateProposalModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/30"
              >
                Save Proposal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE SLA POLICY MODAL */}
      {showCreateSlaModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateSlaSubmit}
            className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-4 text-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Create SLA Agreement</h3>
              <button
                type="button"
                onClick={() => setShowCreateSlaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-400 block mb-1">Client / Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sundays River Citrus Co."
                  value={newSlaCompany}
                  onChange={(e) => setNewSlaCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Key Account Lead</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Riaan van Wyk"
                  value={newSlaClient}
                  onChange={(e) => setNewSlaClient(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-400 block mb-1">SLA Tier</label>
                  <select
                    value={newSlaTierName}
                    onChange={(e) => setNewSlaTierName(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  >
                    <option value="Platinum 24/7">Platinum 24/7</option>
                    <option value="Gold 12/5">Gold 12/5</option>
                    <option value="Standard Business">Standard Business</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-400 block mb-1">Uptime Target (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="90"
                    max="100"
                    value={newSlaUptimeTarget}
                    onChange={(e) => setNewSlaUptimeTarget(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-400 block mb-1">Max Response (Mins)</label>
                  <input
                    type="number"
                    value={newSlaResponseTime}
                    onChange={(e) => setNewSlaResponseTime(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-400 block mb-1">Monthly Fee ({profile.currency})</label>
                  <input
                    type="number"
                    value={newSlaMonthlyFee}
                    onChange={(e) => setNewSlaMonthlyFee(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Coverage Scope</label>
                <input
                  type="text"
                  value={newSlaCoverage}
                  onChange={(e) => setNewSlaCoverage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateSlaModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20"
              >
                Activate SLA Policy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LOG INCIDENT MODAL */}
      {showLogIncidentModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleLogIncidentSubmit}
            className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 space-y-4 text-slate-200"
          >
            <h3 className="text-base font-bold text-white">Log SLA Incident Event</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-400 block mb-1">Incident Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. API Response latency check"
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">Severity Tier</label>
                <select
                  value={incidentSeverity}
                  onChange={(e) => setIncidentSeverity(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                >
                  <option value="Minor">Minor</option>
                  <option value="Major">Major</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-400 block mb-1">First Response Time (Minutes)</label>
                <input
                  type="number"
                  required
                  value={incidentResponseMins}
                  onChange={(e) => setIncidentResponseMins(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowLogIncidentModal(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/30"
              >
                Record Incident
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DELETE PROPOSAL CONFIRMATION MODAL */}
      {proposalToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-4 text-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Client Proposal</h3>
                <p className="text-xs text-slate-400">{proposalToDelete.proposalNumber}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete the proposal for <span className="font-bold text-white">{proposalToDelete.company}</span>?
            </p>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setProposalToDelete(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProposal(proposalToDelete.id);
                  setProposalToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SLA CONFIRMATION MODAL */}
      {slaToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-4 text-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete SLA Policy</h3>
                <p className="text-xs text-slate-400">{slaToDelete.company}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to remove the <span className="font-bold text-white">{slaToDelete.tier}</span> SLA contract for <span className="font-bold text-white">{slaToDelete.company}</span>?
            </p>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSlaToDelete(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSlaContract(slaToDelete.id);
                  setSlaToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
