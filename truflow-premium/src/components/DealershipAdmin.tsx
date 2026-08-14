import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { authFetch } from "../lib/session";
import { TRUFLOW_MOBILE_URL } from "../lib/ecosystem";
import type { Dealership as FullDealership } from "../types";

const DealerDetailsSettings = lazy(() => import("./DealerDetailsSettings"));
const DocSettingsPanel = lazy(() => import("./DocSettingsPanel"));
const AccountingIntegrationsSettings = lazy(() => import("./AccountingIntegrationsSettings"));
const TruSocialSettings = lazy(() => import("./TruSocialSettings"));

type SettingsTab = "details" | "documents" | "accounting" | "social";

/**
 * Onboarding a dealership, as a screen rather than four curl commands.
 *
 * Admin only, and the server enforces that too; this component just avoids
 * showing a form that would 403.
 */

type Dealership = {
  id: string;
  name: string;
  location?: string;
  slug: string;
  websiteUrl?: string;
  /** Which apps this dealership's code opens. */
  products?: string[];
  address?: string;
  registrationNumber?: string;
  vatNumber?: string;
};

const FEED_ORIGIN = "https://flow.tru-saas.com";

/** Keep in step with PRODUCTS in server.ts. */
const PRODUCT_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "lens", label: "TruLens", hint: "Guided photo & video capture" },
  { id: "flow", label: "TruFlow", hint: "The DMS — stock, leads, invoicing" },
  { id: "flow-lite", label: "TruFlow Mobile", hint: "Premium companion app — leads, stock & deals from the floor" },
  { id: "inspect", label: "TruInspect", hint: "Condition report / VIR" },
  { id: "live", label: "TruLive", hint: "Live video walkaround" },
  { id: "value", label: "TruValue", hint: "Live video trade-in appraisal" },
  { id: "social", label: "TruSocial", hint: "Auto-publish stock to social channels" },
];

/** Mirrors the server's rule exactly, so the form fails before the request does. */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          /* clipboard blocked — the value is on screen to select by hand */
        }
      }}
      className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px] shrink-0 inline-flex items-center gap-1.5"
    >
      {done ? <Check size={13} /> : <Copy size={13} />}
      {done ? "Copied" : label}
    </button>
  );
}

export default function DealershipAdmin({
  onNotify,
  scopedDealershipId,
  onDealerSaved,
}: {
  onNotify: (title: string, message: string, type?: "info" | "warning" | "error") => void;
  scopedDealershipId?: string | null;
  /** Fires after per-dealer settings tabs save, so the parent can reload shared state. */
  onDealerSaved?: () => void;
}) {
  const [rows, setRows] = useState<Dealership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [address, setAddress] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [products, setProducts] = useState<string[]>(["lens", "flow"]);
  const [savingProductsFor, setSavingProductsFor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  // Progressive disclosure: only one row expanded at a time, add-form collapsed by default.
  const [expandedRow, setExpandedRow] = useState<string | null>(scopedDealershipId ?? null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<Record<string, SettingsTab>>({});

  const deleteDealership = async (d: Dealership) => {
    if (confirmingDelete !== d.id) {
      setConfirmingDelete(d.id);
      return;
    }
    setConfirmingDelete(null);
    setDeleting(d.id);
    try {
      const res = await authFetch(`/api/dealerships/${d.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Server responded ${res.status}`);
      setRows((prev) => prev.filter((r) => r.id !== d.id));
      onNotify("Dealership removed", body?.message || `${d.name} deleted.`);
    } catch (err: any) {
      onNotify("Could not delete", err?.message || "Unknown error", "error");
    } finally {
      setDeleting(null);
    }
  };

  const updateProducts = async (d: Dealership, next: string[]) => {
    setSavingProductsFor(d.id);
    try {
      const res = await authFetch(`/api/dealerships/${d.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Server responded ${res.status}`);
      setRows((prev) => prev.map((r) => (r.id === d.id ? { ...r, products: body.dealership.products } : r)));
      onNotify("Products updated", `${d.name} now has access to ${next.length} app${next.length === 1 ? "" : "s"}.`);
    } catch (err: any) {
      onNotify("Could not update products", err?.message || "Unknown error", "error");
    } finally {
      setSavingProductsFor(null);
    }
  };

  const [issued, setIssued] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState<string | null>(null);

  const [hasCode, setHasCode] = useState<Record<string, boolean>>({});
  const [stock, setStock] = useState<Record<string, number | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/dealerships");
      if (res.status === 403) throw new Error("Admin only — sign in with the master admin code.");
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const list: Dealership[] = await res.json();
      setRows(list);

      authFetch("/api/auth/codes")
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (!body?.accounts) return;
          const map: Record<string, boolean> = {};
          for (const a of body.accounts) if (a.dealershipId) map[a.dealershipId] = true;
          setHasCode(map);
        })
        .catch(() => { /* leave unknown */ });

      list.forEach((d) => {
        fetch(`/api/public/stock?dealer=${encodeURIComponent(d.slug)}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((body) => setStock((p) => ({ ...p, [d.id]: typeof body?.count === "number" ? body.count : null })))
          .catch(() => setStock((p) => ({ ...p, [d.id]: null })));
      });
    } catch (err: any) {
      setError(err?.message || "Could not load dealerships.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const slugValid = SLUG_RE.test(effectiveSlug);
  const slugTaken = rows.some((d) => d.slug === effectiveSlug);
  const canSave = Boolean(name.trim()) && slugValid && !slugTaken && !saving;

  const addDealership = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/dealerships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          location: location.trim(),
          websiteUrl: websiteUrl.trim(),
          slug: effectiveSlug,
          products,
          address: address.trim(),
          registrationNumber: regNumber.trim(),
          vatNumber: vatNumber.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Server responded ${res.status}`);

      setRows((prev) => [...prev, body.dealership]);
      setName("");
      setLocation("");
      setWebsiteUrl("");
      setAddress("");
      setRegNumber("");
      setVatNumber("");
      setSlug("");
      setSlugTouched(false);
      setProducts(["lens", "flow"]);
      setAddFormOpen(false);
      onNotify(
        "Dealership added",
        `${body.dealership.name} can sign in to ` +
          `${(body.dealership.products || []).join(", ") || "no apps"} as soon as they have a code.`,
      );
    } catch (err: any) {
      onNotify("Could not add dealership", err?.message || "Unknown error", "error");
    } finally {
      setSaving(false);
    }
  };

  const issueCode = async (d: Dealership) => {
    setIssuing(d.id);
    try {
      const res = await authFetch("/api/auth/codes/rotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealershipId: d.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Server responded ${res.status}`);
      setIssued((prev) => ({ ...prev, [d.id]: body.code }));
      onNotify("Code issued", `Save ${d.name}'s code now — it is not shown again.`, "warning");
    } catch (err: any) {
      onNotify("Could not issue code", err?.message || "Unknown error", "error");
    } finally {
      setIssuing(null);
    }
  };

  const filteredRows = rows.filter((d) => {
    if (scopedDealershipId && d.id !== scopedDealershipId) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.slug.toLowerCase().includes(q) ||
      (d.location || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="card border-[color:var(--cyan-soft)]">
      <div className="card-header border-b border-white/5 px-5 py-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[16px] text-[color:var(--white)] flex items-center gap-2">
          <Building2 size={14} className="text-[color:var(--cyan-bright)]" /> Dealerships
        </h3>
        <button
          type="button"
          onClick={load}
          className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px] inline-flex items-center gap-1.5"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="card-body p-5 flex flex-col gap-4">
        {error && (
          <p className="text-[13px] text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Toolbar: search + add toggle */}
        {!scopedDealershipId && (
          <div className="flex items-center gap-2 flex-wrap">
            {rows.length > 3 && (
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(232,234,230,0.4)]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search dealerships…"
                  className="w-full bg-[color:var(--ink-2)] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-[13px] text-[color:var(--white)]"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setAddFormOpen((v) => !v)}
              className={
                "btn text-[13px] font-semibold inline-flex items-center gap-1.5 ml-auto " +
                (addFormOpen
                  ? "bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)]"
                  : "btn-primary")
              }
            >
              <Plus size={14} /> {addFormOpen ? "Cancel" : "Add dealership"}
            </button>
          </div>
        )}

        {/* Row count */}
        {rows.length > 0 && (
          <p className="text-[13px] text-[rgba(232,234,230,0.55)]">
            {rows.length} dealership{rows.length === 1 ? "" : "s"}
            {searchQuery && ` · ${filteredRows.length} matching`}
          </p>
        )}

        {loading && rows.length === 0 && (
          <p className="text-[13px] text-[rgba(232,234,230,0.72)]">Loading dealerships…</p>
        )}

        {/* Dealership rows — collapsed by default */}
        <div className="flex flex-col gap-2">
          {filteredRows.map((d) => {
            const isOpen = expandedRow === d.id;
            const stockCount = stock[d.id];
            const stockLabel =
              stockCount === null || stockCount === undefined
                ? "stock: —"
                : stockCount === 0
                ? "no live stock"
                : `${stockCount} live`;

            return (
              <div
                key={d.id}
                className="rounded-xl border border-white/10 bg-[color:var(--ink-2)] overflow-hidden"
              >
                {/* Collapsed header row */}
                <button
                  type="button"
                  onClick={() => setExpandedRow(isOpen ? null : d.id)}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-[color:var(--white)] truncate">
                      {d.name}
                    </div>
                    <div className="text-[13px] text-[rgba(232,234,230,0.55)] flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[color:var(--cyan-bright)]">{d.slug}</span>
                      {d.location && <span>· {d.location}</span>}
                      <span>·</span>
                      <span className={hasCode[d.id] ? "text-[color:var(--cyan)]" : ""}>
                        {hasCode[d.id] ? "✓ code" : "○ no code"}
                      </span>
                      <span>·</span>
                      <span className={stockCount ? "text-[color:var(--cyan)]" : ""}>{stockLabel}</span>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp size={16} className="text-[color:var(--muted)] shrink-0" />
                  ) : (
                    <ChevronDown size={16} className="text-[color:var(--muted)] shrink-0" />
                  )}
                </button>

                {/* Freshly-issued code — always visible so it isn't lost behind a collapse */}
                {issued[d.id] && (
                  <div className="mx-4 mb-3 rounded-lg border border-[color:var(--cyan-soft)] bg-[color:var(--cyan-faint)] px-3 py-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[color:var(--white)] tracking-wider">
                          Shown once — save it now
                        </div>
                        <div className="font-mono text-[15px] text-[color:var(--white)] break-all">
                          {issued[d.id]}
                        </div>
                      </div>
                      <CopyButton value={issued[d.id]} label="Copy code" />
                    </div>
                    <div className="border-t border-[color:var(--cyan-soft)] pt-2 flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-[13px] text-[color:var(--muted)]">
                          Append to <span className="font-mono text-[color:var(--cyan-bright)]">TRULENS_DEALER_CODES</span> on Render (needs restart):
                        </div>
                        <div className="font-mono text-[13px] text-[color:var(--white)] break-all">
                          {d.slug}:{issued[d.id]}
                        </div>
                      </div>
                      <CopyButton value={`${d.slug}:${issued[d.id]}`} label="Copy env line" />
                    </div>
                  </div>
                )}

                {/* Expanded body */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 flex flex-col gap-3 border-t border-white/5">
                    {(d.registrationNumber || d.vatNumber || d.address) && (
                      <div className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                        {d.registrationNumber && <div>Reg: {d.registrationNumber}</div>}
                        {d.vatNumber && <div>VAT: {d.vatNumber}</div>}
                        {d.address && <div>{d.address}</div>}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => issueCode(d)}
                        disabled={issuing === d.id}
                        className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px] inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <KeyRound size={13} />
                        {issuing === d.id ? "Issuing…" : "Issue login code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDealership(d)}
                        onBlur={() => { if (confirmingDelete === d.id) setConfirmingDelete(null); }}
                        disabled={deleting === d.id}
                        className={
                          "btn text-[13px] inline-flex items-center gap-1.5 disabled:opacity-50 " +
                          (confirmingDelete === d.id
                            ? "bg-red-500/20 text-red-400 border border-red-400/40"
                            : "bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] hover:text-red-400 hover:border-red-400/30")
                        }
                      >
                        <Trash2 size={13} />
                        {confirmingDelete === d.id ? "Confirm?" : "Delete"}
                      </button>
                    </div>

                    {/* Apps */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                        Apps
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {PRODUCT_OPTIONS.map((p) => {
                          const on = (d.products || []).includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              title={p.hint}
                              disabled={savingProductsFor === d.id}
                              onClick={() => {
                                const next = on
                                  ? (d.products || []).filter((x) => x !== p.id)
                                  : [...(d.products || []), p.id];
                                updateProducts(d, next);
                              }}
                              className={
                                "px-2.5 py-1.5 rounded-lg border text-[13px] font-semibold cursor-pointer transition-colors disabled:opacity-50 " +
                                (on
                                  ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)]"
                                  : "bg-[color:var(--glass)] text-[color:var(--muted)] border-[color:var(--glass-line)] hover:text-[color:var(--white)]")
                              }
                            >
                              {on ? "✓ " : ""}{p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Feed URL */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[13px] text-[rgba(232,234,230,0.55)] font-mono break-all min-w-0">
                        {FEED_ORIGIN}/api/public/stock?dealer={d.slug}
                      </div>
                      <CopyButton value={`${FEED_ORIGIN}/api/public/stock?dealer=${d.slug}`} label="Copy feed URL" />
                    </div>

                    {/* Per-dealer settings — folded in as tabs so the admin
                        doesn't scroll through one stack per dealer.
                        onSaved calls loadAllState in the parent, which will
                        also refetch this component's list. */}
                    {(() => {
                      const tab: SettingsTab = settingsTab[d.id] ?? "details";
                      const socialOn = (d.products || []).includes("social");
                      const full = d as unknown as FullDealership;
                      const setTab = (t: SettingsTab) =>
                        setSettingsTab((prev) => ({ ...prev, [d.id]: t }));
                      const tabBtn = (id: SettingsTab, label: string) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setTab(id)}
                          className={
                            "px-3 py-1.5 rounded-lg border text-[13px] font-semibold transition-colors " +
                            (tab === id
                              ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)]"
                              : "bg-[color:var(--glass)] text-[color:var(--muted)] border-[color:var(--glass-line)] hover:text-[color:var(--white)]")
                          }
                        >
                          {label}
                        </button>
                      );
                      return (
                        <div className="rounded-xl border border-white/10 bg-[color:var(--ink)]/40 p-3 flex flex-col gap-3">
                          <div className="flex flex-wrap gap-1.5">
                            {tabBtn("details", "Details")}
                            {tabBtn("documents", "Documents")}
                            {tabBtn("accounting", "Accounting")}
                            {socialOn && tabBtn("social", "Social")}
                          </div>
                          <Suspense
                            fallback={
                              <div className="p-4 text-[13px] text-[rgba(232,234,230,0.55)]">
                                Loading…
                              </div>
                            }
                          >
                            {tab === "details" && (
                              <DealerDetailsSettings
                                dealership={full}
                                isAdmin
                                onSaved={() => {
                                  load();
                                  onDealerSaved?.();
                                }}
                              />
                            )}
                            {tab === "documents" && (
                              <DocSettingsPanel
                                dealership={full}
                                isAdmin
                                onSaved={() => {
                                  load();
                                  onDealerSaved?.();
                                }}
                              />
                            )}
                            {tab === "accounting" && (
                              <AccountingIntegrationsSettings
                                dealershipId={d.id}
                                accountingEnabled={!!full.accountingEnabled}
                                onNotify={onNotify}
                              />
                            )}
                            {tab === "social" && socialOn && (
                              <TruSocialSettings
                                dealershipId={d.id}
                                truSocialEnabled={!!full.truSocialEnabled}
                                onNotify={onNotify}
                              />
                            )}
                          </Suspense>
                        </div>
                      );
                    })()}

                    {/* TruFlow Mobile */}
                    {(d.products || []).includes("flow-lite") && (
                      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-[rgba(0,136,255,0.15)] bg-[rgba(0,136,255,0.06)] px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-[color:var(--white)] flex items-center gap-1.5">
                            <ExternalLink size={12} className="text-[#0088FF]" />
                            TruFlow Mobile
                          </div>
                          <div className="text-[13px] text-[rgba(232,234,230,0.55)] font-mono break-all">
                            {TRUFLOW_MOBILE_URL}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <CopyButton value={TRUFLOW_MOBILE_URL} label="Copy URL" />
                          <a
                            href={TRUFLOW_MOBILE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn bg-[#0088FF] text-[color:var(--ink)] border border-transparent text-[13px] shrink-0 inline-flex items-center gap-1.5"
                          >
                            <ExternalLink size={13} /> Open
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add dealership — collapsed behind toolbar button */}
        {!scopedDealershipId && addFormOpen && (
          <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-3">
            <div className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
              Add a dealership
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                  Dealership name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Garden Route Motors"
                  className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                  Location
                </span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="George, Western Cape"
                  className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                  Slug — permanent
                </span>
                <input
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase());
                  }}
                  placeholder="garden-route-motors"
                  className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                  Website (optional)
                </span>
                <input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://gardenroutemotors.co.za"
                  className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono"
                />
              </label>
            </div>

            <div className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider mt-1">
              Document branding — appears on invoices &amp; agreements
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                  Street address
                </span>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main Rd, Sandton, 2196"
                  className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                  CIPC registration no.
                </span>
                <input
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  placeholder="2015/123456/07"
                  className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                  VAT number
                </span>
                <input
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="4920194857"
                  className="bg-[color:var(--ink-2)] border border-white/10 rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] font-mono"
                />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] tracking-wider">
                Apps this dealership can sign in to
              </span>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_OPTIONS.map((p) => {
                  const on = products.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      title={p.hint}
                      onClick={() =>
                        setProducts((prev) =>
                          prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                        )
                      }
                      className={
                        "px-3 py-2 rounded-lg border text-[13px] font-semibold cursor-pointer transition-colors " +
                        (on
                          ? "bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border-[color:var(--cyan-soft)]"
                          : "bg-[color:var(--glass)] text-[color:var(--muted)] border-[color:var(--glass-line)] hover:text-[color:var(--white)]")
                      }
                    >
                      {on ? "✓ " : ""}{p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[13px] text-[rgba(232,234,230,0.55)] leading-relaxed">
              The slug is the dealer's identity in their website feed, the TruLens picker and the tag on
              every car they photograph. It <b className="text-[color:var(--white)]">cannot be changed
              later</b> — check it before saving.
            </p>

            {name.trim() && !slugValid && (
              <p className="text-[13px] text-[color:var(--white)]">
                Slug must be lowercase letters, numbers and single hyphens — e.g.{" "}
                <span className="font-mono">cars-on-caledon</span>.
              </p>
            )}
            {slugTaken && (
              <p className="text-[13px] text-[color:var(--white)]">
                <span className="font-mono">{effectiveSlug}</span> is already taken by another dealership.
              </p>
            )}

            <button
              type="button"
              onClick={addDealership}
              disabled={!canSave}
              className="btn btn-primary self-start text-[13px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
            >
              <Plus size={14} />
              {saving ? "Adding…" : "Add dealership"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
