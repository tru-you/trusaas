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
};

const FEED_ORIGIN = "https://flow.tru-saas.com";

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
  const [slug, setSlug] = useState("");
  // Once the slug is hand-edited we stop overwriting it from the name.
  const [slugTouched, setSlugTouched] = useState(false);

  /* Codes come back from the server exactly once. Holding them in state means
     a mis-click elsewhere loses them, so they stay until dismissed and the
     copy button is the primary action. */
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/dealerships");
      if (res.status === 403) throw new Error("Admin only — sign in with the master admin code.");
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setRows(await res.json());
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
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Server responded ${res.status}`);

      setRows((prev) => [...prev, body.dealership]);
      setName("");
      setLocation("");
      setWebsiteUrl("");
      setSlug("");
      setSlugTouched(false);
      onNotify(
        "Dealership added",
        `${body.dealership.name} is live in the TruLens picker now — no redeploy needed.`,
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
     failure that files a dealer's cars into someone else's yard. Building the
     whole line here beats retyping it per dealer. */
  const dealerCodesLine = rows.map((d) => `${d.slug}:CODE`).join(",");

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
              on the <span className="font-mono">trusaas-lens</span> service. Replace each{" "}
              <span className="font-mono">CODE</span> with what you gave that dealer. This one needs a
              restart.
            </p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-mono text-[13px] text-[color:var(--white)] break-all min-w-0">
                {dealerCodesLine}
              </div>
              <CopyButton value={dealerCodesLine} label="Copy template" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
