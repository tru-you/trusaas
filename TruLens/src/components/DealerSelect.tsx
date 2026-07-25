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

export const DEALERSHIPS: { slug: string; name: string; location: string }[] = [
  // Real dealers first.
  { slug: 'cars-on-caledon', name: 'Cars on Caledon', location: 'Kariega, Eastern Cape' },
  { slug: 'mkr-autosales', name: 'MKR Auto Sales', location: 'Johannesburg' },
  // Sample dealers so the picker looks lived-in for demos and testing. These
  // slugs have no DMS mapping, so their stock scopes to nothing real.
  { slug: 'demo-motors', name: 'Demo Motors', location: 'Cape Town' },
  { slug: 'summit-auto', name: 'Summit Auto', location: 'Durban' },
  { slug: 'karoo-cars', name: 'Karoo Cars', location: 'Bloemfontein' },
];

export default function DealerSelect({ onSelected }: { onSelected: (slug: string, name: string) => void }) {
  const [choice, setChoice] = React.useState<string | null>(null);

  const confirm = () => {
    const d = DEALERSHIPS.find((x) => x.slug === choice);
    if (!d) return;
    onSelected(d.slug, d.name);
  };

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-10 bg-[#06080D] text-[#E8EAE6]">
      <img
        src={trulensLogo}
        alt="TruLens"
        className="h-9 w-auto object-contain mx-auto mb-8 [filter:brightness(2.1)_contrast(0.95)]"
      />

      <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-center">Which dealership?</h1>
      <p className="text-[13px] text-[rgba(232,234,230,0.55)] text-center mt-2 mb-6 leading-relaxed">
        Everything you photograph on this phone is filed to this dealership. Pick yours — you can
        change it later in Settings.
      </p>

      <div className="flex flex-col gap-3">
        {DEALERSHIPS.map((d) => {
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
      </div>

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
