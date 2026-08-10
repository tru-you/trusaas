import { FormEvent, useState } from 'react';
import { api, setToken } from '../lib/api';
import tpIcon from '../assets/TP-AppIcon.svg';
import { Button, Card, Input } from '../components/ui';

export default function Login({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [code, setCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: { code: code.trim(), remember },
      });
      setToken(res.token);
      onLoggedIn(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-[400px] p-8 animate-rise">
        <div className="flex flex-col items-center text-center">
          <img src={tpIcon} alt="PropertyTrade" className="w-14 h-14 mx-auto object-contain" />
          <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-ink">Flow Prop</h1>
          <p className="mt-1.5 text-[13.5px] text-muted">
            Property management for South African rental and sales agencies.
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="block text-[12px] font-medium text-ink-dim mb-1.5 tracking-tight">
              Access code
            </span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="••••••••"
              className="text-center mono tracking-[0.3em] font-semibold"
              autoFocus
              autoComplete="off"
              inputMode="text"
            />
          </label>

          <label className="flex items-center gap-2 text-[13px] text-ink-dim select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded accent-[#0E9D98]"
            />
            Keep me signed in for 30 days
          </label>

          {error && (
            <p className="text-[13px] text-danger bg-danger/10 rounded-[10px] px-3 py-2.5">{error}</p>
          )}

          <Button variant="accent" className="w-full h-11" type="submit" disabled={busy}>
            {busy ? 'Opening…' : 'Open workspace'}
          </Button>
        </form>

        <p className="mt-6 text-[12px] text-muted text-center leading-relaxed">
          New workspace? Your access code prints in the server console
          <br />
          on first boot — save it, it shows once.
        </p>
      </Card>
    </div>
  );
}