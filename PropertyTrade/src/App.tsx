import { useCallback, useEffect, useState } from 'react';
import { api, getToken, setToken } from './lib/api';
import { AgentBrief } from './lib/types';
import { Shell } from './components/layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deals from './pages/Deals';
import Properties from './pages/Properties';
import Tenants from './pages/Tenants';
import Leases from './pages/Leases';
import Payments from './pages/Payments';
import Maintenance from './pages/Maintenance';
import Reports from './pages/Reports';
import Team from './pages/Team';
import Settings from './pages/Settings';
import Master from './pages/Master';
import Assistant from './components/Assistant';
import Placeholder from './pages/Placeholder';

function parseHash(): string {
  const h = location.hash.replace(/^#\/?/, '');
  return h || 'dashboard';
}

export default function App() {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [route, setRoute] = useState<string>(() => parseHash());
  const [agent, setAgent] = useState<AgentBrief | null>(null);
  const [booting, setBooting] = useState<boolean>(!!getToken());

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!token) return;
    api<AgentBrief>('/api/auth/me')
      .then(setAgent)
      .catch(() => setTokenState(null))
      .finally(() => setBooting(false));
  }, [token]);

  const handleLoggedIn = useCallback((t: string) => {
    setToken(t);
    setTokenState(t);
    setRoute('dashboard');
    location.hash = '#/dashboard';
  }, []);

  const handleSignOut = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setAgent(null);
    setRoute('dashboard');
    location.hash = '#/login';
  }, []);

  if (!token) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
      </div>
    );
  }

  const page = (() => {
    switch (route) {
      case 'deals':
        return <Deals />;
      case 'properties':
        return <Properties />;
      case 'tenants':
        return <Tenants />;
      case 'leases':
        return <Leases />;
      case 'payments':
        return <Payments />;
      case 'maintenance':
        return <Maintenance />;
      case 'reports':
        return <Reports />;
      case 'team':
        return <Team currentAgentId={agent?.id} />;
      case 'settings':
        return <Settings agent={agent} />;
      case 'master':
        return <Master agent={agent} />;
      default:
        return <Dashboard />;
    }
  })();

  const placeholderKeys = ['owners', 'buyers', 'documents', 'commissions', 'mandates'];

  return (
    <>
      <Shell active={route} onNav={(k) => (location.hash = `#/${k}`)} agent={agent} onSignOut={handleSignOut}>
        {placeholderKeys.includes(route) ? <Placeholder title={route} /> : page}
      </Shell>
      {agent && <Assistant />}
    </>
  );
}