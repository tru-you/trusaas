import { useCallback, useEffect, useState } from "react";
import { Landmark, Unlink, Loader2 } from "lucide-react";
import { authFetch } from "../lib/session";
import type { AccountingPlatform } from "../types";

interface AccountingAccount {
  connectionId: string;
  dealershipId: string;
  platform: AccountingPlatform;
  companyName?: string;
  connectedAt: string;
}

const PLATFORMS: { id: AccountingPlatform; label: string; icon: string }[] = [
  { id: "xero", label: "Xero", icon: "🟦" },
  { id: "quickbooks", label: "QuickBooks", icon: "🟩" },
  { id: "zoho", label: "Zoho Books", icon: "🟥" },
];

export default function AccountingIntegrationsSettings({
  dealershipId,
  dealerName,
  accountingEnabled,
  onNotify,
}: {
  dealershipId: string;
  dealerName?: string;
  accountingEnabled: boolean;
  onNotify: (title: string, message: string, type?: "info" | "warning" | "error") => void;
}) {
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [enabled, setEnabled] = useState(accountingEnabled);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/accounting/accounts?dealershipId=${encodeURIComponent(dealershipId)}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch { /* best-effort */ }
    setLoading(false);
  }, [dealershipId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  // The parent re-fetches dealer state independently of this component (e.g.
  // after another admin tab toggles it, or a sibling settings panel saves),
  // so `accountingEnabled` can change after mount — resync local state or
  // this panel keeps showing a stale toggle.
  useEffect(() => { setEnabled(accountingEnabled); }, [accountingEnabled]);

  const toggleAccounting = async () => {
    setToggling(true);
    try {
      const res = await authFetch("/api/accounting/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealershipId, enabled: !enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
      setEnabled(!enabled);
      onNotify(
        "Accounting integrations",
        !enabled ? "Enabled — connect Xero, QuickBooks or Zoho below." : "Disabled — existing connections are preserved.",
      );
    } catch (err: any) {
      onNotify("Accounting integrations", err?.message || "Toggle failed", "error");
    }
    setToggling(false);
  };

  const connectPlatform = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await authFetch(`/api/accounting/connect/${encodeURIComponent(platform)}?dealershipId=${encodeURIComponent(dealershipId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connect failed");
      if (data.authUrl) {
        const popup = window.open(data.authUrl, "accounting_connect", "width=600,height=700");
        const timer = setInterval(() => {
          if (!popup || popup.closed) {
            clearInterval(timer);
            setConnecting(null);
            loadAccounts();
          }
        }, 500);
      }
    } catch (err: any) {
      onNotify("Connect failed", err?.message || "Could not start OAuth flow", "error");
      setConnecting(null);
    }
  };

  const disconnectAccount = async (connectionId: string) => {
    setDisconnecting(connectionId);
    try {
      const res = await authFetch("/api/accounting/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealershipId, connectionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Disconnect failed");
      }
      setAccounts((prev) => prev.filter((a) => a.connectionId !== connectionId));
      onNotify("Disconnected", "Accounting connection removed.");
    } catch (err: any) {
      onNotify("Disconnect failed", err?.message || "Unknown error", "error");
    }
    setDisconnecting(null);
  };

  return (
    <div className="card border-[color:var(--glass-line)]">
      <div className="card-header border-b border-white/5 px-5 py-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[16px] text-[color:var(--white)] flex items-center gap-2">
          <Landmark size={14} className="text-[color:var(--cyan-bright)]" /> Accounting integrations{dealerName ? ` — ${dealerName}` : ""}
        </h3>
        <button
          type="button"
          onClick={toggleAccounting}
          disabled={toggling}
          className={
            "px-3 py-1.5 rounded-lg border text-[13px] font-semibold transition-colors disabled:opacity-50 " +
            (enabled
              ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)]"
              : "bg-[color:var(--glass)] text-[color:var(--muted)] border-[color:var(--glass-line)]")
          }
        >
          {toggling ? "…" : enabled ? "✓ Enabled" : "Off"}
        </button>
      </div>

      {enabled && (
        <div className="card-body p-5 flex flex-col gap-4">
          <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
            Connect your accounting package so DocHub's Invoice stage pushes signed invoices
            straight into your books instead of exporting a CSV to import by hand.
          </p>

          {loading ? (
            <p className="text-[13px] text-[rgba(232,234,230,0.55)] flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" /> Loading connections…
            </p>
          ) : accounts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {accounts.map((a) => {
                const plat = PLATFORMS.find((p) => p.id === a.platform);
                return (
                  <div
                    key={a.connectionId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[color:var(--ink-2)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{plat?.icon || "🔗"}</span>
                      <div>
                        <div className="text-[13px] font-semibold text-[color:var(--white)]">
                          {plat?.label || a.platform}
                        </div>
                        {a.companyName && (
                          <div className="text-[13px] text-[rgba(232,234,230,0.55)]">
                            {a.companyName}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => disconnectAccount(a.connectionId)}
                      disabled={disconnecting === a.connectionId}
                      className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px] inline-flex items-center gap-1.5 hover:text-red-400 hover:border-red-400/30 disabled:opacity-50"
                    >
                      <Unlink size={12} />
                      {disconnecting === a.connectionId ? "…" : "Disconnect"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
              Connect a package
            </span>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const alreadyConnected = accounts.some((a) => a.platform === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => connectPlatform(p.id)}
                    disabled={!!connecting || alreadyConnected}
                    className={
                      "px-3 py-2 rounded-lg border text-[13px] font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 " +
                      (alreadyConnected
                        ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)] cursor-default"
                        : "bg-[color:var(--glass)] text-[color:var(--muted)] border-[color:var(--glass-line)] hover:text-[color:var(--white)] cursor-pointer")
                    }
                  >
                    <span>{p.icon}</span>
                    {connecting === p.id ? (
                      <><Loader2 size={12} className="animate-spin" /> Connecting…</>
                    ) : alreadyConnected ? (
                      <>✓ {p.label}</>
                    ) : (
                      <>{p.label}</>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
