import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  FolderKanban,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Plus,
  CheckCircle2,
  Clock,
  Zap,
  ChevronRight,
  FileText,
  Activity,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../../context/AppContext';

export const ExecutiveDashboard: React.FC = () => {
  const {
    deals,
    projects,
    invoices,
    transactions,
    getFinancialSummary,
    setActiveView,
    setIsCopilotOpen,
    addNotification,
    profile,
  } = useApp();

  const summary = getFinancialSummary();

  const activeDeals = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const wonDealsCount = deals.filter((d) => d.stage === 'won').length;
  const inProgressProjects = projects.filter((p) => p.status === 'In Progress');
  const overdueInvoices = invoices.filter((i) => i.status === 'Overdue');

  // Chart Data: Monthly Cash Flow trend
  const cashFlowData = [
    { month: 'Feb', Revenue: 28000, Expenses: 14000, Net: 14000 },
    { month: 'Mar', Revenue: 34000, Expenses: 18000, Net: 16000 },
    { month: 'Apr', Revenue: 41000, Expenses: 19500, Net: 21500 },
    { month: 'May', Revenue: 38500, Expenses: 16000, Net: 22500 },
    { month: 'Jun', Revenue: 46000, Expenses: 21000, Net: 25000 },
    { month: 'Jul', Revenue: summary.totalRevenue || 47500, Expenses: summary.totalExpenses || 22400, Net: summary.netProfit || 25100 },
  ];

  // Pipeline distribution chart data
  const pipelineData = [
    { name: 'Lead', value: deals.filter((d) => d.stage === 'lead').reduce((s, d) => s + d.value, 0), color: '#52525b' },
    { name: 'Qualified', value: deals.filter((d) => d.stage === 'qualified').reduce((s, d) => s + d.value, 0), color: '#71717a' },
    { name: 'Proposal', value: deals.filter((d) => d.stage === 'proposal').reduce((s, d) => s + d.value, 0), color: '#a1a1aa' },
    { name: 'Negotiation', value: deals.filter((d) => d.stage === 'negotiation').reduce((s, d) => s + d.value, 0), color: '#d4d4d8' },
    { name: 'Won', value: deals.filter((d) => d.stage === 'won').reduce((s, d) => s + d.value, 0), color: '#ffffff' },
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto bg-black text-white">
      {/* Top Banner & AI Recommendation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-black text-white p-6 rounded-2xl shadow-2xl relative overflow-hidden border border-zinc-800">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 text-zinc-100 border border-zinc-700 flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              Ridgeway Auto · live
            </span>
            <span className="text-xs text-zinc-400">July 2026 · sales & service</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dealership Dashboard</h1>
          <p className="text-sm text-zinc-300">
            Sales, service, stock and money — one live view of the dealership.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10">
          <button
            onClick={() => setIsCopilotOpen(true)}
            className="px-4 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl text-sm font-bold shadow-md flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-black animate-pulse" />
            Ask Dealer Assist
          </button>
        </div>
      </div>

      {/* Top KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Sales run-rate (annualised sales, monthly alongside) */}
        <div className="p-5 bg-black rounded-2xl border border-zinc-800 shadow-xl hover:border-zinc-700 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sales run-rate</span>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center font-bold shadow-xs">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{profile.currency}{summary.arr.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-cyan-300 font-semibold mt-1">
              <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
              <span>+18.4% vs last quarter</span>
              <span className="text-zinc-500 font-normal ml-1">({profile.currency}{(summary.mrr).toLocaleString()}/mo)</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Active CRM Pipeline */}
        <div
          onClick={() => setActiveView('crm')}
          className="p-5 bg-black rounded-2xl border border-zinc-800 shadow-xl hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sales pipeline</span>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center font-bold group-hover:scale-105 transition-transform shadow-xs">
              <Briefcase className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{profile.currency}{summary.pipelineValue.toLocaleString()}</div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mt-1">
              <span>{activeDeals.length} active deals</span>
              <span className="text-white font-medium group-hover:underline flex items-center">
                View pipeline <ChevronRight className="w-3 h-3 text-cyan-400 ml-0.5" />
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Active Projects & Delivery */}
        <div
          onClick={() => setActiveView('projects')}
          className="p-5 bg-black rounded-2xl border border-zinc-800 shadow-xl hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Workshop & prep</span>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center font-bold group-hover:scale-105 transition-transform shadow-xs">
              <FolderKanban className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{inProgressProjects.length} Active</div>
            <div className="flex items-center justify-between text-xs text-zinc-400 mt-1">
              <span>Avg 62% Completion</span>
              <span className="text-white font-medium group-hover:underline flex items-center">
                Manage tasks <ChevronRight className="w-3 h-3 text-cyan-400 ml-0.5" />
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Cash Balance & Pending Invoices */}
        <div
          onClick={() => setActiveView('accounting')}
          className="p-5 bg-black rounded-2xl border border-zinc-800 shadow-xl hover:border-zinc-600 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Cash & Receivables</span>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-700 text-white flex items-center justify-center font-bold group-hover:scale-105 transition-transform shadow-xs">
              <DollarSign className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{profile.currency}{summary.cashBalance.toLocaleString()}</div>
            <div className="flex items-center justify-between text-xs text-zinc-300 font-medium mt-1">
              <span>{profile.currency}{summary.pendingInvoicesAmount.toLocaleString()} pending invoices</span>
              <span className="group-hover:underline flex items-center">
                Ledger <ChevronRight className="w-3 h-3 ml-0.5" />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visual Data Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue & Expenses Trend Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-black p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-white" />
                Financial Performance & Cash Flow
              </h3>
              <p className="text-xs text-zinc-400">Monthly breakdown of client revenue vs operational expenses</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-medium text-white">
                <span className="w-2.5 h-2.5 rounded-full bg-white inline-block" /> Revenue
              </span>
              <span className="flex items-center gap-1 font-medium text-zinc-400">
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 inline-block" /> Expenses
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#71717a" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#71717a" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} tickFormatter={(v) => `${profile.currency}${v / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => [`${profile.currency}${Number(value).toLocaleString()}`, '']}
                  contentStyle={{ backgroundColor: '#000000', borderRadius: '12px', borderColor: '#27272a', color: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
                />
                <Area type="monotone" dataKey="Revenue" stroke="#ffffff" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                <Area type="monotone" dataKey="Expenses" stroke="#71717a" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Distribution Chart (1 Col) */}
        <div className="bg-black p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-white" />
              Pipeline Stage Distribution
            </h3>
            <p className="text-xs text-zinc-400">Value of deals by stage in sales funnel</p>
          </div>

          <div className="h-48 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pipelineData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => `${profile.currency}${Number(val).toLocaleString()}`} contentStyle={{ backgroundColor: '#000000', borderRadius: '12px', borderColor: '#27272a', color: '#ffffff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800 text-xs">
            {pipelineData.map((p) => (
              <div key={p.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-zinc-400 font-medium truncate">{p.name}:</span>
                <span className="text-zinc-200 font-bold ml-auto">{profile.currency}{p.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cross-Suite Synchronized Activity & Urgent Action Center */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Urgent Actions */}
        <div className="bg-black p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-cyan-400" />
              Urgent Cross-Suite Actions
            </h3>
            <span className="px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-200 border border-zinc-700 text-xs font-semibold">
              Action Required
            </span>
          </div>

          <div className="space-y-3">
            {/* Action 1: Overdue Invoice */}
            {overdueInvoices.length > 0 && (
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Accounting Overdue</span>
                    <span className="text-xs text-zinc-300 font-semibold">{overdueInvoices[0].clientName}</span>
                  </div>
                  <p className="text-sm font-semibold text-zinc-100">
                    Invoice {overdueInvoices[0].invoiceNumber} ({profile.currency}{overdueInvoices[0].amount.toLocaleString()}) is 2 days past due.
                  </p>
                  <p className="text-xs text-zinc-400">
                    Workflow trigger ready to send automated reminder to {overdueInvoices[0].clientEmail}.
                  </p>
                </div>
                <button
                  onClick={() => setActiveView('accounting')}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-lg text-xs font-semibold shrink-0 transition-colors shadow-xs"
                >
                  Send Notice
                </button>
              </div>
            )}

            {/* Action 2: High Value Deal in Negotiation */}
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">CRM Deal Closing</span>
                  <span className="text-xs text-zinc-300 font-semibold">Sundays River Citrus Co.</span>
                </div>
                <p className="text-sm font-semibold text-zinc-100">
                  Deal "Fleet supply — 4× Toyota Hilux" ({profile.currency}2,519,600) is at 85% probability.
                </p>
                <p className="text-xs text-zinc-400">
                  On stage win, TruSaaS will automatically create Project & issue 50% deposit invoice.
                </p>
              </div>
              <button
                onClick={() => setActiveView('crm')}
                className="px-3 py-1.5 bg-white text-black hover:bg-zinc-200 rounded-lg text-xs font-bold shrink-0 transition-colors shadow-xs"
              >
                Review Deal
              </button>
            </div>
          </div>
        </div>

        {/* Live Synchronized Operations Stream */}
        <div className="bg-black p-6 rounded-2xl border border-zinc-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Live activity — sales & service
            </h3>
            <span className="text-xs text-zinc-400">Real-time across the dealership</span>
          </div>

          <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-zinc-800 pl-6">
            <div className="relative flex flex-col gap-0.5">
              <span className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-white ring-4 ring-black shadow-xs" />
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-100">Sale won → delivery prep booked</span>
                <span className="text-zinc-400">10m ago</span>
              </div>
              <p className="text-xs text-zinc-400">
                Deal "Isuzu D-Max — cash" won. Auto-booked valet, roadworthy & handover.
              </p>
            </div>

            <div className="relative flex flex-col gap-0.5 pt-2">
              <span className="absolute -left-6 top-3.5 w-2.5 h-2.5 rounded-full bg-zinc-400 ring-4 ring-black shadow-xs" />
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-100">Service invoice scanned</span>
                <span className="text-zinc-400">2h ago</span>
              </div>
              <p className="text-xs text-zinc-400">
                Processed PE Panel & Paint invoice ({profile.currency}1,450.00) & filed under Reconditioning.
              </p>
            </div>

            <div className="relative flex flex-col gap-0.5 pt-2">
              <span className="absolute -left-6 top-3.5 w-2.5 h-2.5 rounded-full bg-zinc-600 ring-4 ring-black shadow-xs" />
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-100">Vehicle payment received</span>
                <span className="text-zinc-400">5h ago</span>
              </div>
              <p className="text-xs text-zinc-400">
                Johan Pretorius paid Invoice #INV-2026-001 ({profile.currency}559,900). Ledger auto-reconciled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
