import React, { useState } from "react";
import { Check, Loader2, Building2, ShieldCheck } from "lucide-react";
import type { Dealership } from "../types";
import { updateDealershipSelf } from "../api";

interface Props {
  dealership: Dealership;
  isAdmin?: boolean;
  onSaved?: (updated: Dealership) => void;
}

/** Dealer identity editor — the fields quoted on invoices, agreements, and
 *  the public listing. Self-service so a dealer can correct a VAT number or
 *  swap a trading name without waiting on admin. Admins targeting another
 *  dealership pass isAdmin so the server-side check accepts the dealershipId
 *  in the body. */
export default function DealerDetailsSettings({ dealership, isAdmin, onSaved }: Props) {
  const [form, setForm] = useState({
    name: dealership.name || "",
    tradingAs: dealership.tradingAs || "",
    registrationNumber: dealership.registrationNumber || "",
    vatNumber: dealership.vatNumber || "",
    contactEmail: dealership.contactEmail || "",
    address: dealership.address || "",
    websiteUrl: dealership.websiteUrl || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDealershipSelf(form, isAdmin ? dealership.id : undefined);
      onSaved?.(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, key: keyof typeof form, placeholder = "", type = "text") => (
    <label className="flex flex-col gap-1">
      <span className="text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]">{label}</span>
      <input
        type={type}
        value={form[key]}
        onChange={setField(key)}
        placeholder={placeholder}
        className="px-3 py-2 min-h-[40px] rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-[13px] text-[color:var(--white)] focus:border-[color:var(--cyan)] focus:outline-none"
      />
    </label>
  );

  return (
    <div className="card border-[color:var(--cyan-soft)]">
      <div className="card-header border-b border-white/5 px-5 py-3 flex items-center gap-2">
        <Building2 size={14} className="text-[color:var(--cyan-bright)]" />
        <h3 className="font-semibold text-[16px] text-[color:var(--white)]">
          Dealer details
          {isAdmin && <span className="ml-2 text-[12px] text-[rgba(232,234,230,0.55)] font-normal">— {dealership.name}</span>}
        </h3>
        <span className="ml-auto text-[12px] text-[color:var(--muted)]">
          Used on invoices, agreements and your listing
        </span>
      </div>
      <div className="card-body p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {field("Registered name", "name", "Sipho Auto (Pty) Ltd")}
          {field("Trading as", "tradingAs", "Sipho Motors")}
          {field("Registration number", "registrationNumber", "2015/123456/07")}
          {field("VAT number", "vatNumber", "4001234567")}
          {field("Contact email", "contactEmail", "sales@example.co.za", "email")}
          {field("Website", "websiteUrl", "https://example.co.za", "url")}
        </div>
        {field("Address", "address", "12 Main Rd, Kariega, 6229")}
        <div className="border-t border-white/5 pt-3 mt-1">
          {/* TransUnion/Imagin8 access is provisioned by TruSaaS at platform
              level (server env vars + per-dealer credit bundles) — there is
              deliberately no dealer-entered API key here. The old input was
              dead: the server's save whitelist dropped it, so anything typed
              was silently discarded. */}
          <div className="flex items-start gap-2 rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] px-3 py-2.5">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[color:var(--cyan-bright)]" />
            <p className="text-[12px] leading-snug text-[rgba(232,234,230,0.72)]">
              <span className="font-semibold text-[color:var(--white)]">TransUnion verification</span>
              {" "}— TU Valuations, Reg Checks, Accident Reports and M&M lookups are enabled for you by TruSaaS.
              Paid calls use your dealership's Premium credits; contact your account manager to top up.
            </p>
          </div>
        </div>
        {error && (
          <div className="text-sm text-red-300 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save
          </button>
          {saved && !saving && <span className="text-xs text-emerald-300">Saved.</span>}
        </div>
      </div>
    </div>
  );
}
