import React from 'react';
import { Check } from 'lucide-react';
import trulensLogo from '../assets/images/trulens-wordmark.png';

/**
 * "Which dealership are you?" — shown once, straight after the generic login,
 * before any capture.
 *
 * The access code is generic (one code for the whole TruLens app), so the app
 * has to learn which dealership this phone belongs to. This used to be buried
 * in Settings and *defaulted to MKR*, which is exactly how a new dealer's first
 * cars ended up tagged to the wrong yard. Now it's an explicit, unavoidable
 * choice with no default — you cannot capture until you've picked.
 */

type Dealership = { slug: string; name: string; location: string };

/**
 * The list comes from TruFlow, never from here.
 *
 * It used to be a hardcoded array, which meant onboarding a dealer needed a
 * TruLens release on top of a TruFlow one. Worse, a hand-maintained list
 * drifts: this one carried three sample dealerships — Demo Motors, Summit
 * Auto, Karoo Cars — whose slugs TruFlow did not know. A capture made under
 * one saved with no dealership, and the public feed reads untagged stock as
 * the pilot dealer, so picking the wrong row of five put a dealer's cars on
 * someone else's website with nothing to notice.
 *
 * Cached because this is a yard phone. If the DMS cannot be reached we show
 * the last known list and say it is offline — but we never fall back to a
 * built-in list, because a wrong list is what caused the problem.
 */
const CACHE_KEY = 'trulens_dealerships_v1';

function readCache(): Dealership[] {
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
  const [dealerships, setDealerships] = React.useState<Dealership[]>(() => readCache());
  const [loading, setLoading] = React.useState(true);
  const [stale, setStale] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dealerships', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const list = (await res.json()) as Dealership[];
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
    <div className="min-h-full flex flex-col justify-center px-6 py-10 bg-[#06080D] text-[#E8EAE6]">
      <img src="/icons/icon-512.png" alt="TruLens" className="h-16 w-16 object-contain mx-auto mb-6 drop-shadow-[0_4px_16px_rgba(79,227,220,0.35)]" />

      <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-center">Which dealership?</h1>
      <p className="text-[13px] text-[rgba(232,234,230,0.55)] text-center mt-2 mb-6 leading-relaxed">
        Everything you photograph on this phone is filed to this dealership. Pick yours — you can
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
                  ? 'bg-[#4FE3DC]/10 border-[#4FE3DC]/50'
                  : 'bg-white/[0.03] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[16px] font-semibold text-[#E8EAE6]">{d.name}</div>
                <div className="text-[13px] text-[rgba(232,234,230,0.55)]">{d.location}</div>
              </div>
              {active && <Check size={18} className="text-[#4FE3DC] shrink-0" />}
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
          <div className="px-4 py-6 rounded-2xl border border-white/10 bg-white/[0.03] text-center">
            <p className="text-[13px] text-[rgba(232,234,230,0.72)]">
              {loading ? 'Loading dealerships…' : 'Could not load the dealership list.'}
            </p>
            {!loading && (
              <>
                <p className="mt-2 text-[13px] text-[rgba(232,234,230,0.55)] leading-relaxed">
                  The list comes from TruFlow, never from this phone — so there is
                  nothing to pick until it answers. Check the connection, or ask
                  whoever runs the server to check <span className="font-mono text-[12px]">/api/dealerships</span>.
                </p>
                <button
                  type="button"
                  onClick={load}
                  className="mt-3 text-[13px] font-semibold text-[#4FE3DC] underline underline-offset-4"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {stale && dealerships.length > 0 && (
        <p className="mt-3 text-[12px] text-center text-[rgba(232,234,230,0.55)]">
          Offline — showing the last known list.
        </p>
      )}

      <button
        type="button"
        disabled={!choice}
        onClick={confirm}
        className="mt-6 w-full py-4 rounded-2xl bg-[#4FE3DC] text-[#06080D] font-semibold text-[16px] disabled:opacity-40 transition-opacity"
      >
        Continue
      </button>
    </div>
  );
}
