import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  DollarSign,
  User,
  Building2,
  Mail,
  Phone,
  Sparkles,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Send,
  Trash2,
  Users,
  LayoutGrid,
  Table as TableIcon,
  Clock,
  X,
  MessageCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Deal, StageId, Contact } from '../../types';
import { ProgressBadge, getDealProgressStatus } from '../common/StatusBadge';
import { AddContactForm } from './AddContactForm';
import { CommunicationModal, CommunicationTarget } from '../common/CommunicationModal';
import { CommunicationBar } from '../common/CommunicationBar';

const STAGES: { id: StageId; title: string; color: string; bg: string }[] = [
  { id: 'lead', title: 'New Leads', color: 'text-zinc-400', bg: 'bg-zinc-950 border-zinc-800' },
  { id: 'qualified', title: 'Qualified', color: 'text-zinc-200', bg: 'bg-zinc-950 border-zinc-800' },
  { id: 'proposal', title: 'Proposal Sent', color: 'text-zinc-200', bg: 'bg-zinc-950 border-zinc-800' },
  { id: 'negotiation', title: 'Negotiation', color: 'text-zinc-200', bg: 'bg-zinc-950 border-zinc-800' },
  { id: 'won', title: 'Closed Won', color: 'text-white', bg: 'bg-zinc-950 border-zinc-800' },
];

export const CrmSuite: React.FC = () => {
  const { deals, contacts, addDeal, updateDealStage, deleteDeal, addContact, deleteContact, deleteAllData, profile } = useApp();

  const [activeTab, setActiveTab] = useState<'pipeline' | 'contacts'>('pipeline');
  const [pipelineSubTab, setPipelineSubTab] = useState<'board' | 'table'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  // Delete Confirmation States
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  // New Deal Modal
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState('');
  const [newDealCompany, setNewDealCompany] = useState('');
  const [newDealContact, setNewDealContact] = useState('');
  const [newDealEmail, setNewDealEmail] = useState('');
  const [newDealValue, setNewDealValue] = useState('25000');
  const [newDealStage, setNewDealStage] = useState<StageId>('qualified');

  // New Contact Modal / Inline Form
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [showInlineAddContact, setShowInlineAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState('');

  // Communication Modal State (Call, Email, WhatsApp)
  const [commTarget, setCommTarget] = useState<CommunicationTarget | null>(null);
  const [commChannel, setCommChannel] = useState<'call' | 'email' | 'whatsapp'>('email');
  const [isCommOpen, setIsCommOpen] = useState(false);

  const openCommunication = (
    target: { name: string; company?: string; email: string; phone?: string; dealTitle?: string },
    channel: 'call' | 'email' | 'whatsapp'
  ) => {
    setCommTarget({
      name: target.name,
      company: target.company,
      email: target.email,
      phone: target.phone || '+1 (555) 234-8901',
      dealTitle: target.dealTitle,
    });
    setCommChannel(channel);
    setIsCommOpen(true);
  };

  // AI Deal Health Loading
  const [isAiHealthLoading, setIsAiHealthLoading] = useState(false);
  const [aiHealthReport, setAiHealthReport] = useState<any>(null);

  const filteredDeals = deals.filter(
    (d) =>
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contactName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealTitle || !newDealCompany) return;

    addDeal({
      title: newDealTitle,
      company: newDealCompany,
      contactName: newDealContact || 'Primary Contact',
      contactEmail: newDealEmail || 'buyer@email.co.za.com',
      value: Number(newDealValue) || 10000,
      stage: newDealStage,
      probability: newDealStage === 'won' ? 100 : 50,
      closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      healthScore: 85,
    });

    setNewDealTitle('');
    setNewDealCompany('');
    setNewDealContact('');
    setNewDealEmail('');
    setShowAddDealModal(false);
  };

  const handleCreateContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactEmail) return;

    addContact({
      name: newContactName,
      company: newContactCompany || 'Independent',
      role: newContactRole || 'Decision Maker',
      email: newContactEmail,
      phone: newContactPhone || '+1 (555) 000-0000',
      status: 'Lead',
      lastContactDate: new Date().toISOString().split('T')[0],
    });

    setNewContactName('');
    setNewContactCompany('');
    setNewContactEmail('');
    setNewContactPhone('');
    setNewContactRole('');
    setShowAddContactModal(false);
  };

  const analyzeDealWithAi = async (deal: Deal) => {
    setIsAiHealthLoading(true);
    setAiHealthReport(null);
    try {
      const res = await fetch('/api/ai/deal-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal }),
      });
      const data = await res.json();
      setAiHealthReport(data);
    } catch (err) {
      setAiHealthReport({
        score: deal.healthScore || 80,
        healthStatus: 'Healthy',
        riskFactors: ['Competitor pitching lower rate', 'Decision timeline stretched past Q3'],
        recommendedActions: ['Schedule executive demo with CTO', 'Offer free onboarding trial'],
        draftEmail: `Hi ${deal.contactName},\n\nI hope your week is off to a great start. I wanted to check in regarding the ${deal.title} proposal for ${deal.company}.\n\nWould you have 10 minutes open this Thursday for a quick sync?\n\nBest regards,\nSales Team`,
      });
    } finally {
      setIsAiHealthLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto bg-black text-white">
      {/* CRM Header & Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-cyan-400" />
            Sales Pipeline
          </h1>
          <p className="text-sm text-zinc-400">
            Deals in flight — vehicles, buyers and where each is in the sale. Full lead workflow lives in TruCRM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-zinc-950 p-1 rounded-xl flex items-center gap-1 border border-zinc-800">
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'pipeline'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Pipeline Board
            </button>
            <button
              onClick={() => setActiveTab('contacts')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'contacts'
                  ? 'bg-white text-black shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Contacts ({contacts.length})
            </button>
          </div>

          <button
            onClick={() => (activeTab === 'pipeline' ? setShowAddDealModal(true) : setShowAddContactModal(true))}
            className="px-4 py-2 bg-white text-black hover:bg-zinc-200 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'pipeline' ? 'Add Deal' : 'Add Contact'}</span>
          </button>

          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md"
            title="Delete all workspace data"
          >
            <Trash2 className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Delete All Data</span>
          </button>
        </div>
      </div>

      {/* Search & Sub-view Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
            <input
              type="text"
              placeholder={activeTab === 'pipeline' ? 'Search deals or companies...' : 'Search contacts by name, company, or email...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-hidden focus:ring-2 focus:ring-zinc-700"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100 p-0.5 rounded-md hover:bg-zinc-800 transition-colors"
                title="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {activeTab === 'pipeline' && (
            <div className="bg-zinc-950 p-1 rounded-xl flex items-center gap-1 border border-zinc-800 shrink-0">
              <button
                onClick={() => setPipelineSubTab('board')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  pipelineSubTab === 'board'
                    ? 'bg-white text-black shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Kanban Board View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden md:inline">Board</span>
              </button>
              <button
                onClick={() => setPipelineSubTab('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                  pipelineSubTab === 'table'
                    ? 'bg-white text-black shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                title="Deals Table View"
              >
                <TableIcon className="w-4 h-4" />
                <span className="hidden md:inline">Table</span>
              </button>
            </div>
          )}
        </div>

        {activeTab === 'pipeline' && (
          <div className="flex items-center gap-4 text-xs font-medium text-zinc-400">
            <span>
              Total Deals: <strong className="text-white">{deals.length}</strong>
            </span>
            <span>
              Active Value:{' '}
              <strong className="text-white">
                {profile.currency}{deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').reduce((s, d) => s + d.value, 0).toLocaleString()}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Tab Content: Pipeline Kanban Board */}
      {activeTab === 'pipeline' && pipelineSubTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto pb-6">
          {STAGES.map((stage) => {
            const stageDeals = filteredDeals.filter((d) => d.stage === stage.id);
            const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div
                key={stage.id}
                className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/80 flex flex-col min-h-[500px] backdrop-blur-md"
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stage.color.replace('text-', 'bg-')} shadow-xs`} />
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${stage.color}`}>
                      {stage.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 bg-slate-950 text-slate-300 rounded-full text-[11px] font-bold border border-slate-800">
                    {stageDeals.length}
                  </span>
                </div>

                {/* Stage Total Value */}
                <div className="mb-3 px-2 py-1.5 bg-slate-950/80 rounded-lg text-xs font-semibold text-slate-300 flex justify-between items-center border border-slate-800/60">
                  <span className="text-slate-400 font-normal">Stage Value</span>
                  <span>{profile.currency}{stageTotal.toLocaleString()}</span>
                </div>

                {/* Cards List */}
                <div className="flex-1 space-y-3">
                  {stageDeals.map((deal) => {
                    const status = getDealProgressStatus(deal.stage, deal.closeDate);
                    return (
                      <div
                        key={deal.id}
                        onClick={() => {
                          setSelectedDeal(deal);
                          analyzeDealWithAi(deal);
                        }}
                        className="p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer space-y-2 group relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-100 group-hover:text-cyan-400 transition-colors line-clamp-1">
                            {deal.title}
                          </h4>
                          <ProgressBadge status={status} size="sm" />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-500" />
                            <span className="font-medium truncate max-w-[120px]">{deal.company}</span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {deal.closeDate}
                          </span>
                        </div>

                        {/* Direct Call / Email / WhatsApp Communication Action Bar */}
                        <div className="pt-1.5 flex items-center justify-between gap-2 border-t border-slate-800/60">
                          <CommunicationBar
                            size="sm"
                            onCall={() =>
                              openCommunication(
                                {
                                  name: deal.contactName,
                                  company: deal.company,
                                  email: deal.contactEmail,
                                  phone: deal.contactPhone,
                                  dealTitle: deal.title,
                                },
                                'call'
                              )
                            }
                            onEmail={() =>
                              openCommunication(
                                {
                                  name: deal.contactName,
                                  company: deal.company,
                                  email: deal.contactEmail,
                                  phone: deal.contactPhone,
                                  dealTitle: deal.title,
                                },
                                'email'
                              )
                            }
                            onWhatsApp={() =>
                              openCommunication(
                                {
                                  name: deal.contactName,
                                  company: deal.company,
                                  email: deal.contactEmail,
                                  phone: deal.contactPhone,
                                  dealTitle: deal.title,
                                },
                                'whatsapp'
                              )
                            }
                          />

                          {/* Move Stage Selector */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-[10px]"
                          >
                            {stage.id !== 'won' && (
                              <button
                                onClick={() => updateDealStage(deal.id, 'won')}
                                className="px-2 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900 rounded-md font-semibold transition-colors flex items-center gap-1"
                                title="Mark Won (Triggers auto-project creation)"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Won</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {stageDeals.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-xs text-slate-500">
                      No deals in stage
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab Content: Pipeline Deals Table View */}
      {activeTab === 'pipeline' && pipelineSubTab === 'table' && (
        <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <tr>
                  <th className="px-6 py-3.5">Deal & Company</th>
                  <th className="px-6 py-3.5">Contact Person</th>
                  <th className="px-6 py-3.5">Pipeline Stage</th>
                  <th className="px-6 py-3.5">Target Close</th>
                  <th className="px-6 py-3.5">Progress Status</th>
                  <th className="px-6 py-3.5">Value</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredDeals.map((deal) => {
                  const status = getDealProgressStatus(deal.stage, deal.closeDate);
                  const stageObj = STAGES.find((s) => s.id === deal.stage);
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => {
                        setSelectedDeal(deal);
                        analyzeDealWithAi(deal);
                      }}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-100">
                        <p className="font-bold text-white hover:text-cyan-400 transition-colors">{deal.title}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          {deal.company}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-slate-200 font-medium">{deal.contactName}</p>
                        <p className="text-xs text-slate-400">{deal.contactEmail}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800 ${stageObj?.color}`}>
                          {stageObj?.title || deal.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-300">
                        {deal.closeDate}
                      </td>
                      <td className="px-6 py-4">
                        <ProgressBadge status={status} />
                      </td>
                      <td className="px-6 py-4 font-bold text-white text-base">
                        {profile.currency}{deal.value.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {deal.stage !== 'won' && (
                            <button
                              onClick={() => updateDealStage(deal.id, 'won')}
                              className="px-2.5 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Won</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedDeal(deal);
                              analyzeDealWithAi(deal);
                            }}
                            className="px-2.5 py-1 bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 hover:bg-cyan-900 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Analyze
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Contacts Table */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {/* Action header bar for contacts */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Client Contacts & Accounts ({filteredContacts.length})</h2>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {/* Dedicated Real-time Search Field for Contacts */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter name, company, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-slate-200 placeholder-slate-500 text-xs focus:outline-hidden focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowInlineAddContact(!showInlineAddContact)}
                className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/30 shrink-0"
              >
                <Plus className={`w-3.5 h-3.5 transition-transform ${showInlineAddContact ? 'rotate-45' : ''}`} />
                <span>{showInlineAddContact ? 'Close Form' : 'Manual Add Contact'}</span>
              </button>
            </div>
          </div>

          {/* Inline Add Contact Form when expanded */}
          {showInlineAddContact && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <AddContactForm
                isModal={false}
                onClose={() => setShowInlineAddContact(false)}
                onSuccess={() => setShowInlineAddContact(false)}
              />
            </div>
          )}

          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                  <tr>
                    <th className="px-6 py-3.5">Contact Name</th>
                    <th className="px-6 py-3.5">Company & Role</th>
                    <th className="px-6 py-3.5">Contact Email</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Total Revenue</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredContacts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 text-slate-500 flex items-center justify-center">
                            <Search className="w-6 h-6" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-200">No client contacts found</p>
                            <p className="text-xs text-slate-500">
                              {searchQuery
                                ? `No contact records matched "${searchQuery}". Try typing a name, company, or email.`
                                : 'No contacts in your CRM database yet.'}
                            </p>
                          </div>
                          {searchQuery && (
                            <button
                              onClick={() => setSearchQuery('')}
                              className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/60 text-cyan-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Clear Search Query</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredContacts.map((contact) => (
                      <tr key={contact.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-100 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400 font-bold text-xs">
                            {contact.name.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-white">{contact.name}</p>
                            <p className="text-xs text-slate-400">{contact.phone}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-200">{contact.company}</p>
                          <p className="text-xs text-slate-400">{contact.role}</p>
                        </td>
                        <td className="px-6 py-4 text-cyan-400 font-medium">
                          <a href={`mailto:${contact.email}`} className="hover:underline flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {contact.email}
                          </a>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              contact.status === 'Customer'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                : contact.status === 'Prospect'
                                ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/60'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {contact.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-white">
                          {profile.currency}{contact.totalSpent.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <CommunicationBar
                              size="sm"
                              onCall={() =>
                                openCommunication(
                                  {
                                    name: contact.name,
                                    company: contact.company,
                                    email: contact.email,
                                    phone: contact.phone,
                                  },
                                  'call'
                                )
                              }
                              onEmail={() =>
                                openCommunication(
                                  {
                                    name: contact.name,
                                    company: contact.company,
                                    email: contact.email,
                                    phone: contact.phone,
                                  },
                                  'email'
                                )
                              }
                              onWhatsApp={() =>
                                openCommunication(
                                  {
                                    name: contact.name,
                                    company: contact.company,
                                    email: contact.email,
                                    phone: contact.phone,
                                  },
                                  'whatsapp'
                                )
                              }
                            />
                            <button
                              onClick={() => {
                                setShowAddDealModal(true);
                                setNewDealCompany(contact.company);
                                setNewDealContact(contact.name);
                                setNewDealEmail(contact.email);
                              }}
                              className="px-3 py-1.5 bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900 border border-cyan-800/60 rounded-lg text-xs font-semibold transition-colors shrink-0"
                            >
                              Create Deal
                            </button>
                            <button
                              onClick={() => setContactToDelete(contact)}
                              className="p-1.5 bg-slate-950 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800/60 rounded-lg transition-colors flex items-center justify-center shrink-0"
                              title="Delete client contact"
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

      {/* Deal Detail & AI Health Analysis Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-6 text-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">{selectedDeal.company}</span>
                <h2 className="text-xl font-extrabold text-white">{selectedDeal.title}</h2>
                <p className="text-xs text-slate-400">Close Date Target: {selectedDeal.closeDate}</p>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Deal Value & Stage advancement */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-400">Deal Value</span>
                <p className="text-2xl font-black text-white">{profile.currency}{selectedDeal.value.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Current Pipeline Stage</span>
                <select
                  value={selectedDeal.stage}
                  onChange={(e) => {
                    updateDealStage(selectedDeal.id, e.target.value as StageId);
                    setSelectedDeal({ ...selectedDeal, stage: e.target.value as StageId });
                  }}
                  className="mt-1 block w-full rounded-lg border-slate-800 text-sm font-semibold bg-slate-900 text-slate-200 p-2 focus:ring-2 focus:ring-cyan-500/30"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Direct Communication Bar for Contact */}
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Primary Contact</span>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <span>{selectedDeal.contactName}</span>
                    <span className="text-xs text-slate-400 font-normal">({selectedDeal.contactEmail})</span>
                  </p>
                </div>
                <span className="text-xs text-emerald-400 font-mono font-semibold">
                  {selectedDeal.contactPhone || '+1 (555) 234-8901'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    openCommunication(
                      {
                        name: selectedDeal.contactName,
                        company: selectedDeal.company,
                        email: selectedDeal.contactEmail,
                        phone: selectedDeal.contactPhone,
                        dealTitle: selectedDeal.title,
                      },
                      'call'
                    )
                  }
                  className="py-2 px-3 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Phone Call</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openCommunication(
                      {
                        name: selectedDeal.contactName,
                        company: selectedDeal.company,
                        email: selectedDeal.contactEmail,
                        phone: selectedDeal.contactPhone,
                        dealTitle: selectedDeal.title,
                      },
                      'email'
                    )
                  }
                  className="py-2 px-3 bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Email</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openCommunication(
                      {
                        name: selectedDeal.contactName,
                        company: selectedDeal.company,
                        email: selectedDeal.contactEmail,
                        phone: selectedDeal.contactPhone,
                        dealTitle: selectedDeal.title,
                      },
                      'whatsapp'
                    )
                  }
                  className="py-2 px-3 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            {/* AI Deal Health Analyzer Section */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950 via-slate-900 to-slate-950 border border-cyan-900/50 text-white space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="font-bold text-white text-sm">TrueAI Deal Health & Strategy</h3>
                </div>
                {aiHealthReport && (
                  <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full text-xs font-bold">
                    Score: {aiHealthReport.score}/100
                  </span>
                )}
              </div>

              {isAiHealthLoading ? (
                <div className="p-4 text-center text-xs text-cyan-200 flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
                  Analyzing deal velocity, win probability, & drafting AI response...
                </div>
              ) : aiHealthReport ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-cyan-300 font-semibold uppercase tracking-wider text-[10px]">Identified Risks</span>
                    <ul className="list-disc list-inside mt-1 text-slate-200 space-y-0.5">
                      {aiHealthReport.riskFactors?.map((r: string, idx: number) => (
                        <li key={idx}>{r}</li>
                      ))}
                    </ul>
                  </div>

                  {aiHealthReport.draftEmail && (
                    <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <span className="text-amber-400 font-semibold block mb-1">AI Generated Follow-up Email Draft</span>
                      <p className="whitespace-pre-line text-slate-300 text-[11px] font-mono leading-relaxed">
                        {aiHealthReport.draftEmail}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  deleteDeal(selectedDeal.id);
                  setSelectedDeal(null);
                }}
                className="px-3 py-2 text-rose-400 hover:bg-rose-950/50 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete Deal
              </button>

              <button
                onClick={() => setSelectedDeal(null)}
                className="px-4 py-2 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Deal Modal */}
      {showAddDealModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateDeal} className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-4 text-slate-200">
            <h3 className="text-lg font-bold text-white">Create New CRM Deal</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Deal Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Enterprise Cloud License"
                  value={newDealTitle}
                  onChange={(e) => setNewDealTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Systems"
                  value={newDealCompany}
                  onChange={(e) => setNewDealCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Deal Value ({profile.currency})</label>
                  <input
                    type="number"
                    required
                    value={newDealValue}
                    onChange={(e) => setNewDealValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Stage</label>
                  <select
                    value={newDealStage}
                    onChange={(e) => setNewDealStage(e.target.value as StageId)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                  >
                    {STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Contact Email</label>
                <input
                  type="email"
                  placeholder="contact@company.com"
                  value={newDealEmail}
                  onChange={(e) => setNewDealEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddDealModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-cyan-600/30"
              >
                Save Deal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <AddContactForm
          isModal={true}
          onClose={() => setShowAddContactModal(false)}
          onSuccess={() => setShowAddContactModal(false)}
        />
      )}

      {/* Delete Contact Confirmation Dialog */}
      {contactToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-5 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Client Contact</h3>
                <p className="text-xs text-slate-400">Confirm permanent deletion from CRM</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
              <p>
                Are you sure you want to delete <span className="font-bold text-white">{contactToDelete.name}</span> from <span className="font-bold text-white">{contactToDelete.company}</span>?
              </p>
              <p className="text-slate-400">
                Email: <span className="text-cyan-400">{contactToDelete.email}</span>
              </p>
            </div>

            <p className="text-xs text-rose-400/90 font-medium">
              This action will permanently remove this contact record from your CRM database.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setContactToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteContact(contactToDelete.id);
                  setContactToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Contact</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Workspace Data Modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 w-full max-w-md p-6 space-y-5 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/60 text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete All Workspace Data</h3>
                <p className="text-xs text-slate-400">Permanently clear CRM & workspace records</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-2">
              <p>
                Are you sure you want to <span className="font-bold text-rose-400">delete all data</span>?
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                <li>All Client Contacts & Pipeline Deals</li>
                <li>All Project Tasks & Logged Hours</li>
                <li>All Invoices & Financial Transactions</li>
              </ul>
            </div>

            <p className="text-xs text-rose-400/90 font-medium">
              This operation will permanently purge local storage and reset all lists.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteAllData();
                  setShowDeleteAllModal(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete All</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Communication Modal (Call, Email, WhatsApp) */}
      <CommunicationModal
        isOpen={isCommOpen}
        onClose={() => setIsCommOpen(false)}
        target={commTarget}
        defaultChannel={commChannel}
      />
    </div>
  );
};
