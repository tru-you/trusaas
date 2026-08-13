// SHARED SOURCE — edit only in packages/tru-ui-src/src/. Synced into app trees on predev/prebuild.
import React, { useState, useEffect } from 'react';
import { Shield, Unlink, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { kredoStatus, kredoConnect, kredoDisconnect, type KredoStatus } from '../lib/kredo';

export default function KredoSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<KredoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [sandboxKey, setSandboxKey] = useState('');
  const [productionKey, setProductionKey] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const s = await kredoStatus(token);
        setStatus(s);
      } catch {
        /* best-effort — not connected is the default */
      }
      setLoading(false);
    })();
  }, [user]);

  const handleConnect = async () => {
    if (!user) return;
    if (!sandboxKey.trim() && !productionKey.trim()) {
      setError('Enter at least one API key.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = await user.getIdToken();
      const res = await kredoConnect(token, {
        sandboxKey: sandboxKey.trim() || undefined,
        productionKey: productionKey.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.error || 'Connection failed');
      } else {
        setSuccess('Kredo connected — CarTrust + CarValue active.');
        setSandboxKey('');
        setProductionKey('');
        const s = await kredoStatus(token);
        setStatus(s);
      }
    } catch (err: any) {
      setError(err?.message || 'Connection failed');
    }
    setSaving(false);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleDisconnect = async () => {
    if (!user) return;
    setDisconnecting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      await kredoDisconnect(token);
      setStatus((s) => s ? { ...s, connected: false, hasSandboxKey: false, hasProductionKey: false } : s);
    } catch (err: any) {
      setError(err?.message || 'Disconnect failed');
    }
    setDisconnecting(false);
  };

  if (loading) {
    return (
      <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-4 flex items-center gap-2 text-[13px] text-neutral-500">
        <Loader2 size={13} className="animate-spin" /> Loading Kredo status…
      </div>
    );
  }

  const connected = status?.connected;

  return (
    <div className="bg-neutral-950 border border-neutral-850 rounded-xl overflow-hidden">
      <div className="p-3 border-b border-neutral-850 bg-neutral-900/40 flex items-center justify-between">
        <span className="text-[13px] font-bold text-neutral-400 flex items-center gap-2">
          <Shield size={12} className="text-amber-400" />
          Kredo
        </span>
        {connected && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-400">
            <CheckCircle2 size={11} /> Connected
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <p className="text-[13px] text-neutral-500 leading-relaxed">
          CarTrust (VIN history) and CarValue (market valuations) — connects to
          Kredo's API marketplace with your own keys.
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
            <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
            <span className="text-[13px] text-red-300">{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span className="text-[13px] text-emerald-300">{success}</span>
          </div>
        )}

        {connected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-[12px]">
              {status?.hasSandboxKey && (
                <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Sandbox key ✓
                </span>
              )}
              {status?.hasProductionKey && (
                <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Production key ✓
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[13px] font-semibold text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Unlink size={12} />
              {disconnecting ? 'Removing…' : 'Disconnect Kredo'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-[12px] text-neutral-500 font-semibold">Sandbox API Key</label>
              <input
                type="password"
                value={sandboxKey}
                onChange={(e) => setSandboxKey(e.target.value)}
                placeholder="kredo_sandbox_…"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-[#E8EAE6] focus:outline-none focus:border-amber-500/40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[12px] text-neutral-500 font-semibold">Production API Key</label>
              <input
                type="password"
                value={productionKey}
                onChange={(e) => setProductionKey(e.target.value)}
                placeholder="kredo_prod_…"
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-[13px] text-[#E8EAE6] focus:outline-none focus:border-emerald-500/40"
              />
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-[13px] font-bold text-white transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Shield size={13} />}
              {saving ? 'Connecting…' : 'Connect Kredo'}
            </button>
            <p className="text-[12px] text-neutral-600 leading-relaxed">
              Get your API keys from{' '}
              <a href="https://www.kredo.co.za" target="_blank" rel="noopener noreferrer" className="underline text-neutral-400 hover:text-neutral-200">
                Kredo's API Marketplace
              </a>
              . Keys are stored per-dealer and never shared across dealerships.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
