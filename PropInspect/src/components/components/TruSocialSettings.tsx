import { useCallback, useEffect, useState } from "react";
import { Share2, Unlink, ExternalLink, Loader2 } from "lucide-react";
import { authFetch } from "../lib/session";

interface SocialAccount {
  accountId: string;
  agencyId: string;
  platform: string;
  username?: string;
  connectedAt: string;
}

const PLATFORMS = [
  { id: "facebook", label: "Facebook Page", icon: "📘" },
  { id: "instagram", label: "Instagram", icon: "📷" },
  { id: "google-business", label: "Google Business", icon: "📍" },
];

export default function TruSocialSettings({
  agencyId,
  dealerName,
  truSocialEnabled,
  onNotify,
}: {
  agencyId: string;
  dealerName?: string;
  truSocialEnabled: boolean;
  onNotify: (title: string, message: string, type?: "info" | "warning" | "error") => void;
}) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [enabled, setEnabled] = useState(truSocialEnabled);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/social/accounts?agencyId=${encodeURIComponent(agencyId)}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch { /* best-effort */ }
    setLoading(false);
  }, [agencyId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const toggleSocial = async () => {
    setToggling(true);
    try {
      const res = await authFetch("/api/social/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, enabled: !enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
      setEnabled(!enabled);
      onNotify("TruSocial", !enabled ? "Enabled — connect your social accounts below." : "Disabled — existing connections are preserved.");
    } catch (err: any) {
      onNotify("TruSocial", err?.message || "Toggle failed", "error");
    }
    setToggling(false);
  };

  const connectPlatform = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await authFetch(`/api/social/connect/${encodeURIComponent(platform)}?agencyId=${encodeURIComponent(agencyId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connect failed");
      if (data.authUrl) {
        const popup = window.open(data.authUrl, "trusocial_connect", "width=600,height=700");
        // Poll for popup close, then refresh accounts
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

  const disconnectAccount = async (accountId: string) => {
    setDisconnecting(accountId);
    try {
      const res = await authFetch("/api/social/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId, accountId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Disconnect failed");
      }
      setAccounts((prev) => prev.filter((a) => a.accountId !== accountId));
      onNotify("Disconnected", "Social account removed.");
    } catch (err: any) {
      onNotify("Disconnect failed", err?.message || "Unknown error", "error");
    }
    setDisconnecting(null);
  };

  return (
    <div className="card border-[color:var(--glass-line)]">
      <div className="card-header border-b border-white/5 px-5 py-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[16px] text-[color:var(--white)] flex items-center gap-2">
          <Share2 size={14} className="text-[color:var(--cyan-bright)]" /> TruSocial{dealerName ? ` — ${dealerName}` : ""}
        </h3>
        <button
          type="button"
          onClick={toggleSocial}
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
            Connect your social accounts to auto-publish listing listings.
          </p>

          {/* Connected accounts */}
          {loading ? (
            <p className="text-[13px] text-[rgba(232,234,230,0.55)] flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" /> Loading accounts…
            </p>
          ) : accounts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {accounts.map((a) => {
                const plat = PLATFORMS.find((p) => p.id === a.platform);
                return (
                  <div
                    key={a.accountId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[color:var(--ink-2)] px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{plat?.icon || "🔗"}</span>
                      <div>
                        <div className="text-[13px] font-semibold text-[color:var(--white)]">
                          {plat?.label || a.platform}
                        </div>
                        {a.username && (
                          <div className="text-[13px] text-[rgba(232,234,230,0.55)]">
                            @{a.username}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => disconnectAccount(a.accountId)}
                      disabled={disconnecting === a.accountId}
                      className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px] inline-flex items-center gap-1.5 hover:text-red-400 hover:border-red-400/30 disabled:opacity-50"
                    >
                      <Unlink size={12} />
                      {disconnecting === a.accountId ? "…" : "Disconnect"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {/* Connect buttons */}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
              Connect your socials
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
