/**
 * TruRadar dealer provisioning — OWNER-ONLY surface (mounted in the admin's
 * DealershipAdmin tabs, never in dealer-facing Settings).
 *
 * The radar (packages/tru-arbitrage) holds its own dealer registry. Flow is
 * the admin surface: this component talks to Flow's proxy routes with the
 * admin JWT, and Flow relays to the radar with the sync key. The sync key
 * never touches the browser.
 *
 * Access codes are shown ONCE at generation — the radar stores only the hash.
 */

import React, { useEffect, useState } from "react";
import { Radar, Check, Loader2, Copy, RefreshCw } from "lucide-react";
import { authFetch } from "../lib/session";

interface Props {
  dealershipId: string;
  slug?: string;
  dealerName?: string;
  /** Called after a successful save so the parent can refresh its list. */
  onChanged?: () => void;
}

const inputCls =
  "px-3 py-2 min-h-[40px] rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-[13px] text-[color:var(--white)] focus:border-[color:var(--cyan)] focus:outline-none";
const labelCls = "text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]";

const RADAR_LOGIN_URL = "https://trusaas-arbitrage.onrender.com";

function generateAccessCode(): string {
  // 16 chars, unambiguous alphabet — long enough to brute-force-proof, short
  // enough to read out over the phone without a spelling alphabet.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default function TruRadarSettings({ dealershipId, slug, dealerName, onChanged }: Props) {
  const [configured, setConfigured] = useState<null | boolean>(null);
  const [active, setActive] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [websiteDomain, setWebsiteDomain] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [busy, setBusy] = useState<"save" | "toggle" | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const flash = (m: string, e = "") => {
    setMsg(e ? "" : m);
    setErr(e);
    window.setTimeout(() => { setMsg(""); setErr(""); }, 3500);
  };

  // Load the current registry record for this slug (via Flow's proxy).
  useEffect(() => {
    let alive = true;
    if (!slug) return;
    authFetch(`/api/internal/truradar/dealers/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setConfigured(!!data.configured);
        if (data.dealer) {
          setActive(data.dealer.active !== false);
          setWebhookUrl(data.dealer.webhookUrl || "");
          setWebsiteDomain(data.dealer.websiteDomain || "");
        }
      })
      .catch(() => alive && setConfigured(false));
    return () => { alive = false; };
  }, [slug]);

  const save = async (payload: Record<string, unknown>, kind: "save" | "toggle") => {
    if (!slug) return;
    setBusy(kind);
    try {
      const res = await authFetch(`/api/internal/truradar/dealers/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealerName: dealerName || slug, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || String(res.status));
      setConfigured(true);
      if (payload.accessCode) setNewCode(null); // shown once — done
      flash(payload.accessCode ? "Dealer provisioned — code shown once, copy it now" : kind === "toggle" ? (payload.active ? "TruRadar enabled" : "TruRadar disabled") : "Saved");
      onChanged?.();
    } catch (e: any) {
      flash("", e?.message || "Save failed — is the radar service up?");
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async () => {
    if (!newCode) return;
    try { await navigator.clipboard.writeText(newCode); setCopiedCode(true); window.setTimeout(() => setCopiedCode(false), 2000); } catch { /* clipboard denied — the code is on screen anyway */ }
  };

  const loading = configured === null;

  return (
    <div className="flex flex-col gap-4">
      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center gap-2 mb-1">
          <Radar size={14} className="text-[color:var(--cyan-bright)]" />
          <h4 className="font-semibold text-[14px] text-[color:var(--white)]">TruRadar — vehicle sourcing radar</h4>
          <span className="ml-auto text-[11px] text-[color:var(--muted)] font-mono">{slug}</span>
        </div>
        <p className="text-[11px] text-[rgba(232,234,230,0.45)] mb-3">
          Standalone sourcing app: confidence-gated classifieds + dealer-site deals, priced against live market comps.
          Provisioning here issues this yard's login. The access code is stored hashed — shown once, never again.
        </p>

        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[color:var(--muted)]" />
        ) : (
          <>
            {/* Enable / disable */}
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div className="text-[13px] text-[color:var(--white)]">
                {configured ? (active ? "Provisioned and active" : "Provisioned — currently disabled") : "Not provisioned yet"}
              </div>
              {configured && (
                <button
                  type="button"
                  onClick={() => void save({ active: !active }, "toggle")}
                  disabled={busy !== null}
                  className="btn-secondary inline-flex items-center gap-2 px-4 py-2 min-h-[36px] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {busy === "toggle" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {active ? "Disable" : "Enable"}
                </button>
              )}
            </div>

            {/* Webhook (optional) */}
            <label className="flex flex-col gap-1 mb-3 max-w-md">
              <span className={labelCls}>Webhook URL — deals POST here (optional)</span>
              <input
                className={inputCls}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://… (their CRM / automation endpoint)"
                style={{ fontFamily: "var(--mono)" }}
              />
            </label>

            {/* Website domain — excluded from their own radar scans */}
            <label className="flex flex-col gap-1 mb-3 max-w-md">
              <span className={labelCls}>Their website domain — excluded from their own radar (optional)</span>
              <input
                className={inputCls}
                value={websiteDomain}
                onChange={(e) => setWebsiteDomain(e.target.value)}
                placeholder="e.g. true-cars.co.za"
                style={{ fontFamily: "var(--mono)" }}
              />
            </label>

            {/* Provision / reissue */}
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {!newCode ? (
                <>
                  <button
                    type="button"
                    onClick={() => setNewCode(generateAccessCode())}
                    disabled={busy !== null}
                    className="btn-primary inline-flex items-center gap-2 px-4 py-2 min-h-[36px] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {configured ? "Reissue access code" : "Generate access code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void save({ webhookUrl: webhookUrl.trim(), websiteDomain: websiteDomain.trim() }, "save")}
                    disabled={busy !== null}
                    className="btn-secondary inline-flex items-center gap-2 px-4 py-2 min-h-[36px] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save settings
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="px-3 py-2 rounded-md bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)] text-[color:var(--cyan)] text-[14px] font-mono tracking-wider">
                    {newCode}
                  </code>
                  <button type="button" onClick={() => void copyCode()} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-[12px]">
                    <Copy className="w-3.5 h-3.5" />{copiedCode ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void save({ accessCode: newCode, webhookUrl: webhookUrl.trim(), active: true }, "save")}
                    disabled={busy !== null}
                    className="btn-primary inline-flex items-center gap-2 px-4 py-2 min-h-[36px] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Confirm — issue to dealer
                  </button>
                </div>
              )}
            </div>

            {newCode && (
              <p className="text-[11px] text-[rgba(245,158,11,0.8)] mb-3">
                This code shows once. Confirm only when you've copied it — reissuing later invalidates the old code.
              </p>
            )}

            {/* Login URL */}
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-[13px] text-[rgba(232,234,230,0.55)] font-mono break-all">
                {RADAR_LOGIN_URL} · login: <span className="text-[color:var(--white)]">{slug}</span> + access code
              </div>
              <a
                href={RADAR_LOGIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-3 py-1.5 min-h-[30px] text-[12px]"
              >
                Open radar ↗
              </a>
            </div>
          </>
        )}

        {/* aria-live so the owner hears confirmation without watching the button */}
        <span role="status" aria-live="polite" className={`text-[12px] h-4 block mt-2 ${err ? "text-red-300" : "text-emerald-300"}`}>
          {err || msg}
        </span>
      </div>
    </div>
  );
}