import React from 'react';
import { Check } from 'lucide-react';
import proplensLogo from '../assets/images/proplens-logo.svg';

/**
 * "Which agency are you?" — shown once, straight after the generic login,
 * before any capture.
 *
 * The access code is generic (one code for the whole PropLens app), so the app
 * has to learn which agency this phone belongs to. This used to be buried
 * in Settings and *defaulted to Demo*, which is exactly how a new agency's first
 * properties ended up tagged to the wrong site. Now it's an explicit, unavoidable
 * choice with no default — you cannot capture until you've picked.
 */

type Agency = { slug: string; name: string; location: string };

/**
 * The list comes from TruProperty backend, never from here.
 *
 * It used to be a hardcoded array, which meant onboarding an agency needed a
 * PropLens release on top of a backend one. Worse, a hand-maintained list
 * drifts: this one carried three sample agencies — Demo Agency, Summit
 * Properties, Coastal Estates — whose slugs the backend did not know. A capture made under
 * one saved with no agency, and the public feed reads untagged properties as
 * the pilot agency, so picking the wrong row of five put an agency's properties on
 * someone else's website with nothing to notice.
 *
 * Cached because this is a site phone. If the backend cannot be reached we show
 * the last known list and say it is offline — but we never fall back to a
 * built-in list, because a wrong list is what caused the problem.
 */
const CACHE_KEY = 'proplens_agencies_v1';

function readCache(): Agency[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function DealerSelect({ onSelected }: { onSelected: (slug: string, name: string) => void }) {
  const [choice, setChoice] = React.useState<string | null>(null);
  const [dealerships, setDealerships] = React.useState<Agency[]>(() => readCache());
  const [loading, setLoading] = React.useState(true);
  const [stale, setStale] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agencies', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const list = (await res.json()) as Agency[];
      if (!Array.isArray(list) || list.length === 0) throw new Error('empty');
      setDealerships(list);
      setStale(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* private mode */ }
    } catch {
      // Keep whatever was cached and say so, rather than showing nothing.
      setStale(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const confirm = () => {
    const d = dealerships.find((x) => x.slug === choice);
    if (!d) return;
    onSelected(d.slug, d.name);
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-10 bg-[#F5F4F1] text-[#0A1420]">
      <img
        src={proplensLogo}
        alt="PropLens"
        className="h-9 w-auto object-contain mx-auto mb-8"
      />

      <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-center">Which agency?</h1>
      <p className="text-[13px] text-[rgba(10,20,32,0.55)] text-center mt-2 mb-6 leading-relaxed">
        Everything you photograph on this phone is filed to this agency. Pick yours — you can
        change it later in Settings.
      </p>

      <div className="flex flex-col gap-3">
        {dealerships.map((d) => {
          const active = choice === d.slug;
          return (
            <button
              key={d.slug}
              type="button"
              onClick={() => setChoice(d.slug)}
              className={`flex items-center justify-between gap-3 px-4 py-4 rounded-2xl border text-left transition-colors ${
                active
                  ? 'bg-[#0E9D98]/10 border-[#0E9D98]/50'
                  : 'bg-[rgba(10,20,32,0.03)] border-[rgba(10,20,32,0.10)] hover:border-[rgba(10,20,32,0.20)]'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[16px] font-semibold text-[#0A1420]">{d.name}</div>
                <div className="text-[13px] text-[rgba(10,20,32,0.55)]">{d.location}</div>
              </div>
              {active && <Check size={18} className="text-[#0E9D98] shrink-0" />}
            </button>
          );
        })}

        {dealerships.length === 0 && (
          /* Still no invented list here — a wrong list is what put a dealer's
             cars on someone else's website, and that rule does not bend.

             But "Could not load the dealership list." over a dead Try again and
             a Continue that can never enable is a dead end with nothing to act
             on. The list comes from TruFlow via GET /api/dealerships, so the
             thing that has gone wrong is nearly always that endpoint — say so,
             and say what unblocks it. */
          <div className="px-4 py-6 rounded-2xl border border-[rgba(10,20,32,0.10)] bg-[rgba(10,20,32,0.03)] text-center">
            <p className="text-[13px] text-[rgba(10,20,32,0.72)]">
              {loading ? 'Loading agencies…' : 'Could not load the agency list.'}
            </p>
            {!loading && (
              <>
                <p className="mt-2 text-[13px] text-[rgba(10,20,32,0.55)] leading-relaxed">
                  The list comes from TruProperty backend, never from this phone — so there is
                  nothing to pick until it answers. Check the connection, or ask
                  whoever runs the server to check <span className="font-mono text-[12px]">/api/agencies</span>.
                </p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-3 text-[13px] font-semibold text-[#0E9D98] underline underline-offset-4"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {stale && dealerships.length > 0 && (
        <p className="mt-3 text-[12px] text-center text-[rgba(10,20,32,0.55)]">
          Offline — showing the last known list.
        </p>
      )}

      <button
        type="button"
        disabled={!choice}
        onClick={confirm}
        className="mt-6 w-full py-4 rounded-2xl bg-[#0E9D98] text-white font-semibold text-[16px] disabled:opacity-40 transition-opacity"
      >
        Continue
      </button>
    </div>
  );
}
