import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AccountingSuite } from './components/accounting/AccountingSuite';
import { WorkflowsSuite } from './components/workflows/WorkflowsSuite';
import { SettingsView } from './components/settings/SettingsView';
import { ProposalsSlaSuite } from './components/proposals/ProposalsSlaSuite';
import { CarDealerSuite } from './components/cardealer/CarDealerSuite';
import { TruCrmProvider } from './context/TruCrmContext';
import { TruCrmSuite } from './components/trucrm/TruCrmSuite';
import { ModuleDock } from './components/modules/ModuleDock';

const MainContent: React.FC = () => {
  const { activeView } = useApp();

  return (
    <main className="flex-1 overflow-y-auto bg-[color:var(--ink)] min-h-screen">
      {activeView === 'trucrm' && <TruCrmSuite />}
      {activeView === 'proposals' && <ProposalsSlaSuite />}
      {activeView === 'cardealer' && <CarDealerSuite />}
      {activeView === 'accounting' && <AccountingSuite />}
      {activeView === 'workflows' && <WorkflowsSuite />}
      {activeView === 'modules' && <ModuleDock />}
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
          </div>
        </div>
      </NotificationProvider>
      </TruCrmProvider>
    </AppProvider>
  );
}
