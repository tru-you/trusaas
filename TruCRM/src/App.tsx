import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { ExecutiveDashboard } from './components/dashboard/ExecutiveDashboard';
import { CrmSuite } from './components/crm/CrmSuite';
import { ProjectSuite } from './components/projects/ProjectSuite';
import { AccountingSuite } from './components/accounting/AccountingSuite';
import { WorkflowsSuite } from './components/workflows/WorkflowsSuite';
import { CopilotDrawer } from './components/copilot/CopilotDrawer';
import { CopilotView } from './components/copilot/CopilotView';
import { SettingsView } from './components/settings/SettingsView';
import { ProposalsSlaSuite } from './components/proposals/ProposalsSlaSuite';
import { CarDealerSuite } from './components/cardealer/CarDealerSuite';
import { TruCrmProvider } from './context/TruCrmContext';
import { TruCrmSuite } from './components/trucrm/TruCrmSuite';

const MainContent: React.FC = () => {
  const { activeView } = useApp();

  return (
    <main className="flex-1 overflow-y-auto bg-[color:var(--ink)] min-h-screen">
      {activeView === 'dashboard' && <ExecutiveDashboard />}
      {activeView === 'crm' && <CrmSuite />}
      {activeView === 'trucrm' && <TruCrmSuite />}
      {activeView === 'proposals' && <ProposalsSlaSuite />}
      {activeView === 'cardealer' && <CarDealerSuite />}
      {activeView === 'projects' && <ProjectSuite />}
      {activeView === 'accounting' && <AccountingSuite />}
      {activeView === 'workflows' && <WorkflowsSuite />}
      {activeView === 'copilot' && <CopilotView />}
      {activeView === 'settings' && <SettingsView />}
    </main>
  );
};

export default function App() {
  return (
    <AppProvider>
      <TruCrmProvider>
      <NotificationProvider>
        <div className="flex h-screen bg-[color:var(--ink)] font-sans text-white/90 antialiased overflow-hidden">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            <Navbar />
            <MainContent />
            <CopilotDrawer />
          </div>
        </div>
      </NotificationProvider>
      </TruCrmProvider>
    </AppProvider>
  );
}
