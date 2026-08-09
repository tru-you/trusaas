import React, { useState } from 'react';
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
import { TruDocsView, OnboardingView } from './components/documents/DocViews';
import { LoginScreen } from './components/auth/LoginScreen';

const SESSION_KEY = 'trusaas_demo_session_v1';

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
      {activeView === 'documents' && <TruDocsView />}
      {activeView === 'onboarding' && <OnboardingView />}
      {activeView === 'settings' && <SettingsView />}
    </main>
  );
};

export default function App() {
  const [navOpen, setNavOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SESSION_KEY) === '1';
    } catch {
      return false;
    }
  });

  const handleLogin = () => {
    try {
      localStorage.setItem(SESSION_KEY, '1');
    } catch {
      // storage unavailable — session lasts for this page load only
    }
    setLoggedIn(true);
    setNavOpen(false);
  };

  if (!loggedIn) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <AppProvider>
      <TruCrmProvider>
      <NotificationProvider>
        <div className="flex h-screen bg-[color:var(--ink)] font-sans text-[#1A2332] antialiased overflow-hidden">
          <Sidebar mobileOpen={navOpen} onMobileClose={() => setNavOpen(false)} />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            <Navbar onMenuClick={() => setNavOpen(true)} />
            <MainContent />
          </div>
        </div>
      </NotificationProvider>
      </TruCrmProvider>
    </AppProvider>
  );
}
