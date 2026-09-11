/**
 * TransUnion / Imagin8 customer settings — OWNER-ONLY surface (mounted in the
 * admin's DealershipAdmin tabs, never in dealer-facing Settings).
 *
 * Each dealership can be its own Imagin8 customer: paid calls bill that
 * customer instead of the platform account. The server's paid-call cores
 * prefer these credentials and fall back to the platform env vars when blank.
 *
 * Also hosts the credit ledger editor. Top-ups are a TruSaaS-side action —
 * the dealer-facing top-up routes are dead, so this is the only place credits
 * change hands.
 */

import React, { useEffect, useState } from "react";
import { KeyRound, Check, Loader2 } from "lucide-react";
import { authFetch } from "../lib/session";

interface Props {
  dealershipId: string;
  slug?: string;
  apiKey?: string;
  customerId?: string;
  /** Called after a successful save so the parent can refresh its list. */
  onChanged?: () => void;
}

const inputCls =
  "px-3 py-2 min-h-[40px] rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-[13px] text-[color:var(--white)] focus:border-[color:var(--cyan)] focus:outline-none";
const labelCls = "text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]";

export default function Imagin8CustomerSettings({ dealershipId, slug, apiKey = "", customerId = "", onChanged }: Props) {
  const [key, setKey] = useState(apiKey);
  const [cust, setCust] = useState(customerId);
  const [credits, setCredits] = useState({ valuation: 0, regCheck: 0, accidentReport: 0, bankAvs: 0 });
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [busy, setBusy] = useState<"creds" | "credits" | null>(null);
  const [msg, setMsg] = useState("");

  const flash = (m: string) => {
    setMsg(m);
    window.setTimeout(() => setMsg(""), 2000);
  };

  // Credit balance lives in the central ledger.
  useEffect(() => {
    let alive = true;
    setLoadingCredits(true);
    authFetch(`/api/imagin8/bundles?dealershipId=${encodeURIComponent(dealershipId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!alive || !b) return;
        setCredits({
          valuation: Number(b.valuation) || 0,
          regCheck: Number(b.regCheck) || 0,
          accidentReport: Number(b.accidentReport) || 0,
          bankAvs: Number(b.bankAvs) || 0,
        });
      })
      .catch(() => undefined)
      .finally(() => alive && setLoadingCredits(false));
    return () => {
      alive = false;
    };
  }, [dealershipId]);

  const saveCredentials = async () => {
    setBusy("creds");
    try {
      const res = await authFetch(`/api/dealerships/${dealershipId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagin8ApiKey: key, imagin8CustomerId: cust }),
      });
      if (!res.ok) throw new Error(String(res.status));
      flash("Credentials saved");
      onChanged?.();
    } catch {
      flash("Credential save failed");
    } finally {
      setBusy(null);
    }
  };

  const saveCredits = async () => {
    setBusy("credits");
    try {
      const res = await authFetch("/api/imagin8/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealershipId, bundles: credits }),
      });
      if (!res.ok) throw new Error(String(res.status));
      flash("Credits saved");
      onChanged?.();
    } catch {
      flash("Credit save failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Credentials */}
      <div className="border-t border-white/5 pt-3">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={14} className="text-[color:var(--cyan-bright)]" />
          <h4 className="font-semibold text-[14px] text-[color:var(--white)]">Imagin8 customer</h4>
          <span className="ml-auto text-[11px] text-[color:var(--muted)] font-mono">{slug}</span>
        </div>
        <p className="text-[11px] text-[rgba(232,234,230,0.45)] mb-3">
          This dealership's own eValue8 account — paid calls bill it. Leave blank to bill the platform account.
          Keys never touch dealer-facing settings.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>API key</span>
            <input className={inputCls} value={key} onChange={(e) => setKey(e.target.value)} placeholder="Platform account used when blank" style={{ fontFamily: "var(--mono)" }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Customer ID</span>
            <input className={inputCls} value={cust} onChange={(e) => setCust(e.target.value)} placeholder="e.g. 12345" style={{ fontFamily: "var(--mono)" }} />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void saveCredentials()}
          disabled={busy !== null}
          className="btn-primary mt-3 inline-flex items-center gap-2 px-4 py-2 min-h-[36px] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
        >
          {busy === "creds" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save credentials
        </button>
      </div>

      {/* Credits */}
      <div className="border-t border-white/5 pt-3">
        <h4 className="font-semibold text-[14px] text-[color:var(--white)] mb-1">Premium credits</h4>
        <p className="text-[11px] text-[rgba(232,234,230,0.45)] mb-3">
          One credit is spent per TU Valuation / Reg Check / Accident Report / Bank Verification. Set what this yard has purchased.
        </p>
        {loadingCredits ? (
          <Loader2 className="w-4 h-4 animate-spin text-[color:var(--muted)]" />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-lg">
            {(["valuation", "regCheck", "accidentReport", "bankAvs"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className={labelCls}>{k === "bankAvs" ? "Bank AVS" : k === "accidentReport" ? "Accident rpt" : k === "regCheck" ? "Reg check" : "Valuation"}</span>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={credits[k]}
                  onChange={(e) =>
                    setCredits((c) => ({ ...c, [k]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))
                  }
                  style={{ fontFamily: "var(--mono)" }}
                />
              </label>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => void saveCredits()}
          disabled={busy !== null || loadingCredits}
          className="btn-primary mt-3 inline-flex items-center gap-2 px-4 py-2 min-h-[36px] text-[12px] font-semibold disabled:opacity-50 cursor-pointer"
        >
          {busy === "credits" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save credits
        </button>
      </div>

      {/* aria-live so the owner hears confirmation without watching the button */}
      <span role="status" aria-live="polite" className="text-[12px] text-emerald-300 h-4">
        {msg}
      </span>
    </div>
  );
}
