import React from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Calculator,
  Workflow,
  Sparkles,
  Settings,
  ShieldCheck,
  TrendingUp,
  Zap,
  FileSignature,
  Car,
  Radar,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTruCrm } from '../../context/TruCrmContext';
import defaultLogo from '../../assets/images/truesaas_logo_1784747570605.jpg';

export const Sidebar: React.FC = () => {
  const { activeView, setActiveView, deals, projects, invoices, workflowRules, proposals, getFinancialSummary, profile } = useApp();

  const { metrics: truCrmMetrics, overdue: truCrmOverdue, unworked: truCrmUnworked } = useTruCrm();
  // Anything needing action today is what the badge should shout about.
  const truCrmActionCount = truCrmOverdue.length + truCrmUnworked.length;

  const activeDealsCount = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length;
  const activeProjectsCount = projects.filter((p) => p.status === 'In Progress').length;
  const pendingInvoicesCount = invoices.filter((i) => i.status === 'Pending' || i.status === 'Overdue').length;
  const activeWorkflowsCount = workflowRules.filter((r) => r.enabled).length;
  const activeProposalsCount = proposals.filter((p) => p.status !== 'Accepted').length;

  const summary = getFinancialSummary();
  const scheme = profile.colorScheme || 'cyan';

  const logoSrc = profile.logoUrl || defaultLogo;

  // Active is a cyan hairline against a faint wash — not a white slab, and not
  // a glow. The sidebar sits *under* the content, so it stays darker than ink.
  const activeNavClass =
    'bg-[color:var(--cyan-faint)] text-[color:var(--white)] border-l-2 border-[color:var(--cyan)]';
  const logoRingClass = 'ring-[color:var(--glass-line)] shadow-none';
  const badgeProClass =
    'bg-[color:var(--glass)] text-[color:var(--white-dim)] border-[color:var(--glass-line)]';
  const badgeQuiet =
    'bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)]';
  // The only badge allowed to draw the eye: leads that are actually unworked.
  const badgeAlert =
    'bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)]';

  // Two distinct jobs that must never read as the same tool:
  //   Sales Floor      → our own customers, leads and deals (TruCRM)
  //   Market Intel     → what competing dealers are doing in the area (Classifieds)
  type NavItem = {
    id: string;
    label: string;
    icon: React.ElementType;
    badge: string | null;
    badgeColor?: string;
  };

  const navGroups: { heading: string; items: NavItem[] }[] = [
    {
      heading: 'Overview',
      items: [
        {
          id: 'dashboard',
          label: 'Executive Overview',
          icon: LayoutDashboard,
          badge: null,
        },
      ],
    },
    {
      heading: 'Sales floor — our customers',
      items: [
        {
          id: 'trucrm',
          label: 'TruCRM — Leads & Deals',
          icon: Car,
          badge:
            truCrmActionCount > 0
              ? `${truCrmActionCount} to work`
              : `${truCrmMetrics.openLeads} open`,
          badgeColor: truCrmActionCount > 0 ? badgeAlert : badgeQuiet,
        },
      ],
    },
    {
      heading: 'Market intel — competitors',
      items: [
        {
          id: 'cardealer',
          label: 'Competitor Classifieds',
          icon: Radar,
          badge: 'Market scan',
          badgeColor: badgeQuiet,
        },
      ],
    },
  ];

  const businessItems = [
    // The generic "CRM & Sales Suite" is retired from the nav — TruCRM (Sales
    // floor) is the automotive CRM and does the job properly. The component and
    // its `crm` view still exist, so restoring is one line if ever needed.
    {
      id: 'proposals',
      label: 'Proposals & SLAs',
      icon: FileSignature,
      badge: activeProposalsCount > 0 ? `${activeProposalsCount} active` : null,
      badgeColor: badgeQuiet,
    },
    {
      id: 'projects',
      label: 'Project Manager',
      icon: FolderKanban,
      badge: activeProjectsCount > 0 ? `${activeProjectsCount} active` : null,
      badgeColor: badgeQuiet,
    },
    {
      id: 'accounting',
      label: 'Automated Accounting',
      icon: Calculator,
      badge: pendingInvoicesCount > 0 ? `${pendingInvoicesCount} pending` : null,
      badgeColor: badgeQuiet,
    },
    {
      id: 'workflows',
      label: 'Automated Workflows',
      icon: Workflow,
      badge: `${activeWorkflowsCount} active`,
      badgeColor: badgeQuiet,
    },
    {
      id: 'copilot',
      label: 'Dealer Assist',
      icon: Sparkles,
      badge: 'AI Active',
      badgeColor: badgeQuiet,
    },
    {
      id: 'settings',
      label: 'Settings & Branding',
      icon: Settings,
      badge: null,
    },
  ];

  const allGroups = [...navGroups, { heading: 'Business operations', items: businessItems }];

  return (
    <aside className="w-64 bg-[#03050A] text-[color:var(--white-dim)] flex flex-col h-screen sticky top-0 shrink-0 border-r border-zinc-800 select-none">
      {/* App Branding Header with Logo */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-1 bg-zinc-900 flex items-center justify-center shrink-0 ${logoRingClass}`}>
            <img
              src={logoSrc}
              alt="TruSaaS Badge"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-white tracking-tight text-base flex items-center gap-1.5 truncate">
              TruCRM Auto
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${badgeProClass}`}>
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400 truncate">Dealership operating system</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {allGroups.map((group) => (
          <div key={group.heading} className="space-y-1">
            <div className="px-3 py-1.5 text-[length:var(--t-micro)] text-[color:var(--faint)]">
              {group.heading}
            </div>

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-${item.id}`}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center justify-between pl-3 pr-3 py-2.5 rounded-[8px] text-[length:var(--t-small)] transition-colors group border-l-2 ${
                    isActive
                      ? activeNavClass
                      : 'border-transparent text-[color:var(--white-dim)] hover:bg-[color:var(--glass)] hover:text-[color:var(--white)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? 'text-[color:var(--cyan)]' : 'text-[color:var(--blue)]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-[100px] text-[length:var(--t-micro)] shrink-0 ${
                        item.badgeColor || 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Live Metric Ticker Card */}
      <div className="p-4 border-t border-zinc-800 bg-black">
        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              Sales run-rate
            </span>
            <span className="text-white font-bold">{profile.currency}{summary.arr.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400 font-medium">Pipeline value</span>
            <span className="text-zinc-200 font-semibold">{profile.currency}{summary.pipelineValue.toLocaleString()}</span>
          </div>
          <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
            <div className="bg-white h-full w-[72%]" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 px-1">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Auto-Sync Active
          </span>
          <span className="text-zinc-400 hover:text-zinc-200 cursor-pointer" onClick={() => setActiveView('settings')}>
            v2.5 Pro
          </span>
        </div>
      </div>
    </aside>
  );
};
