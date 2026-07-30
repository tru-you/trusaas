import { useCallback, useEffect, useState } from "react";
import { Building2, Check, Copy, KeyRound, Plus, RefreshCw } from "lucide-react";
import { authFetch } from "../lib/session";

/**
 * Onboarding a dealership, as a screen rather than four curl commands.
 *
 * The endpoints have existed since dealerships became data, but nothing in the
 * UI called them, so adding a dealer meant hand-writing an admin token into a
 * terminal. That does not scale past a handful and it puts the slug — the one
 * field that cannot be changed later — behind a typo with no confirmation.
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

/** The apps a dealership can be signed up for.
 *
 *  Every product verifies dealer codes against this instance, so ticking a box
 *  here is the whole of granting access. It used to mean pasting the dealer's
 *  code into that app's environment variable in plaintext and restarting it —
 *  once per app, per dealer — and revoking meant editing the same string and
 *  redeploying again. Keep in step with PRODUCTS in server.ts. */
const PRODUCT_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "lens", label: "TruLens", hint: "Guided photo & video capture" },
  { id: "flow", label: "TruFlow", hint: "The DMS — stock, leads, invoicing" },
  { id: "flow-lite", label: "TruFlow Lite", hint: "Lightweight dealer console — leads, inventory & upload" },
  { id: "inspect", label: "TruInspect", hint: "Condition report / VIR" },
  { id: "live", label: "TruLive", hint: "Live video walkaround" },
  { id: "value", label: "TruValue", hint: "Live video trade-in appraisal" },
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
}: {
  onNotify: (title: string, message: string, type?: "info" | "warning" | "error") => void;
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
  // Once the slug is hand-edited we stop overwriting it from the name.
  const [slugTouched, setSlugTouched] = useState(false);
  /* Defaults to the common case — a yard buying the DMS and the capture app.
     A Lens-only dealer is now a matter of unticking TruFlow, rather than
     something the provisioning model could not express at all. */
  const [products, setProducts] = useState<string[]>(["lens", "flow"]);
  const [savingProductsFor, setSavingProductsFor] = useState<string | null>(null);

  /* Codes come back from the server exactly once. Holding them in state means
     a mis-click elsewhere loses them, so they stay until dismissed and the
     copy button is the primary action. */
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState<string | null>(null);

  /* Which dealerships already have a login code, and how much stock each is
     actually publishing. Onboarding used to be four steps with no way to see
     which of them you had done — you found out a dealer was half set up when
     they phoned. /api/auth/codes cannot return the codes themselves (they are
     hashed) but it does say who has one, which is the part worth knowing. */
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

      /* Best-effort. A failure here must not blank the dealership list, so
         each lookup degrades to "unknown" rather than throwing. */
      authFetch("/api/auth/codes")
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (!body?.accounts) return;
          const map: Record<string, boolean> = {};
          for (const a of body.accounts) if (a.dealershipId) map[a.dealershipId] = true;
          setHasCode(map);
        })
        .catch(() => { /* leave unknown */ });

      // The public feed is what the dealer's website sees, so ask it the same
      // way the website does rather than counting rows in the DMS.
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
      onNotify(
        "Dealership added",
        `${body.dealership.name} can sign in to ` +
          `${(body.dealership.products || []).join(", ") || "no apps"} as soon as they have a code. ` +
          `No environment variable, no redeploy.`,
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

  /* Step 3 of onboarding is a Render env var, and getting it wrong is the
     failure that files a dealer's cars into someone else's yard.
     Real codes are substituted for any dealer whose code was issued in this
     session — that is the only moment the plaintext exists, and having to
     hand-merge it into a template afterwards is exactly where a slug and a
     code get mismatched. Anything not issued here stays as CODE. */
  const dealerCodesLine = rows
    .map((d) => `${d.slug}:${issued[d.id] || "CODE"}`)
    .join(",");
  const codesLineIsComplete = rows.length > 0 && rows.every((d) => issued[d.id]);

  return (
    <div className="card border-[color:var(--cyan-soft)]">
      <div className="card-header border-b border-white/5 px-5 py-3 flex items-center justify-between gap-3">
        <h3 className="font-bold text-[16px] text-[color:var(--white)] flex items-center gap-2">
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

      <div className="card-body p-5 flex flex-col gap-5">
        {error && (
          <p className="text-[13px] text-[color:var(--white)] bg-[color:var(--glass)] border border-[color:var(--glass-line)] rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* ── existing dealerships ─────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          {loading && rows.length === 0 && (
            <p className="text-[13px] text-[rgba(232,234,230,0.72)]">Loading dealerships…</p>
          )}

          {rows.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-white/10 bg-[color:var(--ink-2)] px-4 py-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold text-[color:var(--white)]">{d.name}</div>
                  <div className="text-[13px] text-[rgba(232,234,230,0.72)]">
                    {d.location || "No location set"} ·{" "}
                    <span className="font-mono text-[color:var(--cyan-bright)]">{d.slug}</span>
                  </div>
                  {(d.registrationNumber || d.vatNumber || d.address) && (
                    <div className="text-[13px] text-[rgba(232,234,230,0.55)] mt-0.5">
                      {d.registrationNumber && <span>Reg: {d.registrationNumber}</span>}
                      {d.registrationNumber && d.vatNumber && <span> · </span>}
                      {d.vatNumber && <span>VAT: {d.vatNumber}</span>}
                      {d.address && <div className="mt-0.5">{d.address}</div>}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => issueCode(d)}
                  disabled={issuing === d.id}
                  className="btn bg-[color:var(--glass)] text-[color:var(--muted)] border border-[color:var(--glass-line)] text-[13px] inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <KeyRound size={13} />
                  {issuing === d.id ? "Issuing…" : "Issue login code"}
                </button>
              </div>

              {issued[d.id] && (
                <div className="rounded-lg border border-[color:var(--cyan-soft)] bg-[color:var(--cyan-faint)] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[color:var(--white)] tracking-wider">
                      Shown once — save it now
                    </div>
                    <div className="font-mono text-[15px] text-[color:var(--white)] break-all">
                      {issued[d.id]}
                    </div>
                  </div>
                  <CopyButton value={issued[d.id]} label="Copy code" />
                </div>
              )}

              {/* Setup state at a glance. Two of the three can be answered from
                  here; TruLens pinning lives in a Render env var this app
                  cannot read, so it is listed as a step to confirm rather than
                  reported as done — claiming it was done would be worse than
                  saying nothing. */}
              <div className="flex items-center gap-3 flex-wrap text-[13px]">
                <span
                  className={
                    hasCode[d.id]
                      ? "text-[color:var(--cyan)]"
                      : "text-[color:var(--muted)]"
                  }
                >
                  {hasCode[d.id] ? "✓" : "○"} Login code
                </span>
                <span className="text-[color:var(--muted)]">○ Pinned in TruLens (check Render)</span>
                <span
                  className={
                    stock[d.id] ? "text-[color:var(--cyan)]" : "text-[color:var(--muted)]"
                  }
                >
                  {stock[d.id] ? "✓" : "○"}{" "}
                  {stock[d.id] === null || stock[d.id] === undefined
                    ? "Stock unknown"
                    : stock[d.id] === 0
                    ? "No stock live yet"
                    : `${stock[d.id]} live on site`}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-[13px] text-[rgba(232,234,230,0.72)] font-mono break-all min-w-0">
                  {FEED_ORIGIN}/api/public/stock?dealer={d.slug}
                </div>
                <CopyButton value={`${FEED_ORIGIN}/api/public/stock?dealer=${d.slug}`} label="Copy feed URL" />
              </div>
            </div>
          ))}
        </div>

        {/* ── add a dealership ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-3">
          <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
            Add a dealership
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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
              <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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
              <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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
              <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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

          <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider mt-1">
            Document branding — appears on invoices &amp; agreements
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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
              <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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
              <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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

          {/* Which apps their code opens. Every product checks codes against this
              instance, so this is the whole of provisioning — there is no
              environment variable to edit and nothing to redeploy. */}
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
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
                      "px-3 py-2 rounded-lg border text-[13px] font-bold cursor-pointer transition-colors " +
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
            <span className="text-[13px] text-[rgba(232,234,230,0.55)]">
              {products.length
                ? `Their code will open ${products.length} app${products.length === 1 ? "" : "s"}. Changeable later.`
                : "No apps selected — their code will not open anything."}
            </span>
          </div>

          <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
            The slug is the dealer's identity in their website feed, the TruLens picker and the tag on
            every car they photograph. It <b className="text-[color:var(--white)]">cannot be changed
            later</b> — renaming one orphans their stock, so check it before saving.
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
            className="btn btn-primary self-start text-[13px] font-bold inline-flex items-center gap-1.5 disabled:opacity-40"
          >
            <Plus size={14} />
            {saving ? "Adding…" : "Add dealership"}
          </button>
        </div>

        {/* ── the one step that still needs Render ─────────────────────── */}
        {rows.length > 0 && (
          <div className="rounded-xl border border-white/10 p-4 flex flex-col gap-2">
            <div className="text-[13px] font-bold text-[rgba(232,234,230,0.72)] tracking-wider">
              Last step — TruLens codes on Render
            </div>
            <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
              A dealership added here shows up in the TruLens picker straight away. To pin a phone to
              a dealership server-side — so a wrong tap cannot file cars into another yard — set{" "}
              <span className="font-mono text-[color:var(--cyan-bright)]">TRULENS_DEALER_CODES</span>{" "}
              on the <span className="font-mono">trusaas-lens</span> service. This one needs a
              restart.
            </p>
            <p className="text-[13px] text-[color:var(--muted)] leading-relaxed">
              {codesLineIsComplete
                ? "Every code below was issued in this session, so this line is ready to paste as-is."
                : "Codes issued in this session are filled in below. Any that still read CODE belong to a dealer whose code was issued earlier — a code can only be read once, so either use the one you saved or issue a fresh one above."}
            </p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-mono text-[13px] text-[color:var(--white)] break-all min-w-0">
                {dealerCodesLine}
              </div>
              <CopyButton
                value={dealerCodesLine}
                label={codesLineIsComplete ? "Copy line" : "Copy template"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
