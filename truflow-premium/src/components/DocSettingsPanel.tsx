import React, { useRef, useState } from "react";
import { Check, Loader2, FileText, Plus, X, Upload, Trash2 } from "lucide-react";
import type { Dealership, DocSettings } from "../types";
import { updateDealershipSelf } from "../api";

interface Props {
  dealership: Dealership;
  isAdmin?: boolean;
  onSaved?: (updated: Dealership) => void;
}

export default function DocSettingsPanel({ dealership, isAdmin, onSaved }: Props) {
  const ds = dealership.docSettings || {};
  const bd = ds.bankingDetails || {};

  const [logo, setLogo] = useState<string>(ds.logo || "");
  const [logoPreview, setLogoPreview] = useState<string>(ds.logo || "");
  const logoRef = useRef<HTMLInputElement>(null);
  const [bankName, setBankName] = useState(bd.bankName || "");
  const [branchCode, setBranchCode] = useState(bd.branchCode || "");
  const [accountNumber, setAccountNumber] = useState(bd.accountNumber || "");
  const [accountType, setAccountType] = useState(bd.accountType || "");
  const [saleTerms, setSaleTerms] = useState<string[]>(ds.saleTerms?.length ? ds.saleTerms : [""]);
  const [ownershipClause, setOwnershipClause] = useState(ds.ownershipClause || "");
  const [footerNote, setFooterNote] = useState(ds.footerNote || "");
  const [warrantyTerms, setWarrantyTerms] = useState(ds.warrantyTerms || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = () => setSaved(false);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file (PNG, JPG, SVG).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setLogo(dataUri);
      setLogoPreview(dataUri);
      dirty();
    };
    reader.readAsDataURL(file);
  };

  const handleLogoRemove = () => {
    setLogo("");
    setLogoPreview("");
    if (logoRef.current) logoRef.current.value = "";
    dirty();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const docSettings: DocSettings = {
        logo,
        bankingDetails: { bankName, branchCode, accountNumber, accountType },
        saleTerms: saleTerms.filter((t) => t.trim()),
        ownershipClause,
        footerNote,
        warrantyTerms,
      };
      const updated = await updateDealershipSelf(
        { docSettings },
        isAdmin ? dealership.id : undefined,
      );
      onSaved?.(updated);
      if (updated.docSettings?.logo) {
        setLogo(updated.docSettings.logo);
        setLogoPreview(updated.docSettings.logo);
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const addTerm = () => { setSaleTerms((t) => [...t, ""]); dirty(); };
  const removeTerm = (i: number) => { setSaleTerms((t) => t.filter((_, idx) => idx !== i)); dirty(); };
  const updateTerm = (i: number, v: string) => { setSaleTerms((t) => t.map((c, idx) => (idx === i ? v : c))); dirty(); };

  const inputCls =
    "px-3 py-2 min-h-[40px] rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-[13px] text-[color:var(--white)] focus:border-[color:var(--cyan)] focus:outline-none";
  const labelCls = "text-[length:var(--t-micro)] font-mono text-[color:var(--muted)]";
  const sectionCls = "text-[13px] font-semibold text-[color:var(--white)] mb-1";

  return (
    <div className="card border-[color:var(--cyan-soft)]">
      <div className="card-header border-b border-white/5 px-5 py-3 flex items-center gap-2">
        <FileText size={14} className="text-[color:var(--cyan-bright)]" />
        <h3 className="font-semibold text-[16px] text-[color:var(--white)]">
          Document settings
          {isAdmin && (
            <span className="ml-2 text-[12px] text-[rgba(232,234,230,0.55)] font-normal">
              — {dealership.name}
            </span>
          )}
        </h3>
        <span className="ml-auto text-[12px] text-[color:var(--muted)]">
          Content used on generated documents
        </span>
      </div>
      <div className="card-body p-5 flex flex-col gap-5">
        <p className="text-xs text-[rgba(232,234,230,0.55)] leading-relaxed">
          Configure what appears on your generated invoices, offers and handover documents.
          Leave a field blank to use the default or omit that section.
        </p>
        <p className="text-xs text-[rgba(232,234,230,0.4)] -mt-3">
          Looking for per-stage Attach/Generate/Connect modes instead? That's{" "}
          <b className="text-[rgba(232,234,230,0.6)]">Compliance flow settings</b>, on the Deals page.
        </p>

        {/* Logo */}
        <div>
          <div className={sectionCls}>Logo</div>
          <p className="text-xs text-[rgba(232,234,230,0.55)] mb-2">
            Appears top-left on every generated document next to your dealer name.
            PNG or JPG, max 2 MB. Your website URL from Dealer Details is also printed on documents.
          </p>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="relative group">
                <img
                  src={logoPreview}
                  alt="Dealer logo"
                  className="h-16 max-w-[200px] object-contain rounded border border-[rgba(138,162,184,0.15)] bg-white/5 p-1"
                />
                <button
                  type="button"
                  onClick={handleLogoRemove}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove logo"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <div
                className="h-16 w-[140px] rounded border border-dashed border-[rgba(138,162,184,0.25)] bg-white/2 flex items-center justify-center text-xs text-[rgba(232,234,230,0.35)] cursor-pointer hover:border-[color:var(--cyan)] hover:text-[color:var(--cyan-bright)] transition-colors"
                onClick={() => logoRef.current?.click()}
              >
                No logo set
              </div>
            )}
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-[rgba(138,162,184,0.15)] text-xs text-[color:var(--white)] hover:bg-white/10 transition-colors"
              >
                <Upload size={12} />
                {logoPreview ? "Replace" : "Upload logo"}
              </button>
              <input
                ref={logoRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={handleLogoSelect}
              />
            </div>
          </div>
        </div>

        {/* Banking details */}
        <div>
          <div className={sectionCls}>Banking details</div>
          <p className="text-xs text-[rgba(232,234,230,0.55)] mb-2">
            Printed on invoices so the buyer knows where to pay.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Bank name</span>
              <input className={inputCls} value={bankName} onChange={(e) => { setBankName(e.target.value); dirty(); }} placeholder="FNB" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Branch code</span>
              <input className={inputCls} value={branchCode} onChange={(e) => { setBranchCode(e.target.value); dirty(); }} placeholder="250655" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Account number</span>
              <input className={inputCls} value={accountNumber} onChange={(e) => { setAccountNumber(e.target.value); dirty(); }} placeholder="62012345678" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>Account type</span>
              <input className={inputCls} value={accountType} onChange={(e) => { setAccountType(e.target.value); dirty(); }} placeholder="Business Cheque" />
            </label>
          </div>
        </div>

        {/* Sale terms */}
        <div>
          <div className={sectionCls}>Sale terms</div>
          <p className="text-xs text-[rgba(232,234,230,0.55)] mb-2">
            Your own conditions added to the Offer to Purchase — cooling-off period,
            delivery terms, deposit requirements, or anything specific to how you trade.
          </p>
          <div className="flex flex-col gap-2">
            {saleTerms.map((term, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs text-[rgba(232,234,230,0.4)] mt-3 w-5 text-right shrink-0">
                  {i + 1}.
                </span>
                <textarea
                  className={inputCls + " flex-1 min-h-[60px] resize-y"}
                  value={term}
                  onChange={(e) => updateTerm(i, e.target.value)}
                  placeholder="e.g. A non-refundable deposit of 10% is payable on signing."
                />
                {saleTerms.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTerm(i)}
                    className="mt-2 p-1 rounded hover:bg-white/10 text-[rgba(232,234,230,0.4)] hover:text-red-300"
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addTerm}
              className="inline-flex items-center gap-1 text-xs text-[color:var(--cyan-bright)] hover:underline self-start mt-1"
            >
              <Plus size={12} /> Add term
            </button>
          </div>
        </div>

        {/* Ownership clause */}
        <div>
          <div className={sectionCls}>Ownership clause</div>
          <p className="text-xs text-[rgba(232,234,230,0.55)] mb-2">
            Printed on invoices. Leave blank to use the standard retention-of-ownership wording.
          </p>
          <textarea
            className={inputCls + " w-full min-h-[80px] resize-y"}
            value={ownershipClause}
            onChange={(e) => { setOwnershipClause(e.target.value); dirty(); }}
            placeholder="Ownership of the vehicle remains vested in the Seller until the full purchase price has been received in cleared funds..."
          />
        </div>

        {/* Warranty terms */}
        <div>
          <div className={sectionCls}>Warranty terms</div>
          <p className="text-xs text-[rgba(232,234,230,0.55)] mb-2">
            Warranty description included on the handover document — type, duration, provider.
          </p>
          <textarea
            className={inputCls + " w-full min-h-[60px] resize-y"}
            value={warrantyTerms}
            onChange={(e) => { setWarrantyTerms(e.target.value); dirty(); }}
            placeholder="e.g. 12-month / 20 000 km mechanical warranty via MotorHappy"
          />
        </div>

        {/* Footer note */}
        <div>
          <div className={sectionCls}>Footer note</div>
          <p className="text-xs text-[rgba(232,234,230,0.55)] mb-2">
            Short text printed at the bottom of every generated document.
          </p>
          <input
            className={inputCls + " w-full"}
            value={footerNote}
            onChange={(e) => { setFooterNote(e.target.value); dirty(); }}
            placeholder="e.g. Thank you for choosing Sipho Motors."
          />
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
