import { useCallback, useEffect, useState } from "react";
import { Share2, Unlink, ExternalLink, Loader2, Sparkles, CheckCircle2, ShoppingBag, ShieldCheck, Facebook, Instagram, Globe } from "lucide-react";
import { authFetch } from "../lib/session";

interface SocialAccount {
  accountId: string;
  dealershipId: string;
  platform: string;
  username?: string;
  connectedAt: string;
}

const PLATFORMS = [
  { id: "facebook", label: "Facebook Page", icon: Facebook, color: "#1877F2", desc: "Auto-publishes new stock announcements" },
  { id: "instagram", label: "Instagram", icon: Instagram, color: "#E4405F", desc: "Posts vehicle cards to Instagram feed" },
  { id: "google-business", label: "Google Business", icon: Globe, color: "#4285F4", desc: "Publishes Google Maps product updates" },
];

export default function TruSocialSettings({
  dealershipId,
  dealerName,
  truSocialEnabled,
  onNotify,
}: {
  dealershipId: string;
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
      const res = await authFetch(`/api/social/accounts?dealershipId=${encodeURIComponent(dealershipId)}`);
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch { /* best-effort */ }
    setLoading(false);
  }, [dealershipId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const toggleSocial = async () => {
    setToggling(true);
    try {
      const res = await authFetch("/api/social/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealershipId, enabled: !enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server responded ${res.status}`);
      setEnabled(!enabled);
      onNotify("TruSocial", !enabled ? "Auto-publishing enabled — connect channels below." : "Auto-publishing disabled — 1-Click packs remain active.");
    } catch (err: any) {
      onNotify("TruSocial", err?.message || "Toggle failed", "error");
    }
    setToggling(false);
  };

  const connectPlatform = async (platform: string) => {
    setConnecting(platform);
    try {
      const res = await authFetch(`/api/social/connect/${encodeURIComponent(platform)}?dealershipId=${encodeURIComponent(dealershipId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connect failed");
      if (data.authUrl) {
        const popup = window.open(data.authUrl, "trusocial_connect", "width=600,height=700");
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
        body: JSON.stringify({ dealershipId, accountId }),
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
    <div className="space-y-4">
      {/* Universal 1-Click Card (Always Available) */}
      <div className="card border-[color:var(--glass-line)] bg-gradient-to-br from-[color:var(--ink-2)] to-black/40 p-5 rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-[color:var(--cyan)]" />
              <h3 className="font-bold text-[15px] text-[color:var(--white)]">
                TruSocial 1-Click Multi-Channel Pack
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                Active on all stock
              </span>
            </div>
            <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed max-w-2xl">
              Every vehicle on your floor has instant 1-click marketing packs for <strong>Facebook Marketplace</strong>, <strong>Facebook Page</strong>, <strong>Instagram</strong>, <strong>WhatsApp Status</strong>, <strong>LinkedIn</strong>, and <strong>Google Business</strong>. Open any vehicle in Stock and tap <em>Social &amp; Share</em>.
            </p>
          </div>
        </div>

        {/* Marketplace Notice */}
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-2.5 text-[12px] text-blue-200">
          <ShoppingBag size={15} className="text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong>Facebook Marketplace Note:</strong> Meta strictly prohibits automated API posting to Marketplace. TruDealer solves this with the 1-Click Marketplace Pack: formatted title, compliant specs, and a 1-click 8-photo pack ready to drag-and-drop into Marketplace.
          </div>
        </div>
      </div>

      {/* Automated Background Channels Card */}
      <div className="card border-[color:var(--glass-line)]">
        <div className="card-header border-b border-white/5 px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-semibold text-[14.5px] text-[color:var(--white)] flex items-center gap-2">
              <Share2 size={15} className="text-[color:var(--cyan)]" />
              Automated Background Publishing (Optional)
            </h4>
            <p className="text-[12px] text-[rgba(232,234,230,0.55)] mt-0.5">
              Sync accounts to allow one-click background syndication to your brand pages.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleSocial}
            disabled={toggling}
            className={
              "px-3 py-1.5 rounded-xl border text-[12.5px] font-semibold transition-all cursor-pointer disabled:opacity-50 " +
              (enabled
                ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)]"
                : "bg-[color:var(--glass)] text-[color:var(--muted)] border-[color:var(--glass-line)] hover:text-white")
            }
          >
            {toggling ? "…" : enabled ? "✓ Auto-Publish Active" : "Disabled"}
          </button>
        </div>

        {enabled && (
          <div className="card-body p-5 space-y-4">
            {/* Connected accounts */}
            {loading ? (
              <p className="text-[13px] text-[rgba(232,234,230,0.55)] flex items-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Checking connected accounts…
              </p>
            ) : accounts.length > 0 ? (
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[color:var(--cyan)]">
                  Connected Accounts ({accounts.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {accounts.map((a) => {
                    const plat = PLATFORMS.find((p) => p.id === a.platform);
                    const IconComponent = plat?.icon || Share2;
                    return (
                      <div
                        key={a.accountId}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[color:var(--ink-2)] px-3.5 py-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span style={{ color: plat?.color || "var(--cyan)" }}>
                            <IconComponent size={16} />
                          </span>
                          <div>
                            <div className="text-[12.5px] font-semibold text-[color:var(--white)]">
                              {plat?.label || a.platform}
                            </div>
                            {a.username && (
                              <div className="text-[11.5px] text-[rgba(232,234,230,0.55)] truncate">
                                @{a.username}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => disconnectAccount(a.accountId)}
                          disabled={disconnecting === a.accountId}
                          className="p-1.5 rounded-lg text-[color:var(--muted)] hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                          title="Disconnect account"
                        >
                          <Unlink size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Connect platform buttons */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[rgba(232,234,230,0.6)]">
                Connect Channels
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {PLATFORMS.map((p) => {
                  const alreadyConnected = accounts.some((a) => a.platform === p.id);
                  const IconComp = p.icon;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => connectPlatform(p.id)}
                      disabled={!!connecting || alreadyConnected}
                      className={
                        "p-3 rounded-xl border text-left flex flex-col justify-between transition-all " +
                        (alreadyConnected
                          ? "bg-emerald-500/10 border-emerald-500/20 cursor-default"
                          : "bg-black/30 border-white/5 hover:border-white/15 cursor-pointer")
                      }
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span style={{ color: p.color }}><IconComp size={18} /></span>
                        {alreadyConnected ? (
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">Connected</span>
                        ) : connecting === p.id ? (
                          <Loader2 size={12} className="animate-spin text-[color:var(--cyan)]" />
                        ) : null}
                      </div>
                      <div className="text-[12.5px] font-semibold text-white">{p.label}</div>
                      <div className="text-[11px] text-[rgba(232,234,230,0.5)] mt-0.5">{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
