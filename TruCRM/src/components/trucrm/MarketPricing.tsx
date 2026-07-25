import React from 'react';
import { TrendingUp, TrendingDown, Minus, MapPin, Clock } from 'lucide-react';
import { VehicleOfInterest } from '../../types/trucrm';
import { pricePosition } from '../../lib/pricing';
import { money } from './shared';

/**
 * Prices a unit against comparable competitor listings. The comp-matching and
 * stats are real; the underlying feed is a labelled sample until a live
 * AutoTrader / Cars.co.za scrape is wired in.
 */
export const MarketPricing: React.FC<{ vehicle: VehicleOfInterest; currency: string }> = ({
  vehicle,
  currency,
}) => {
  const pos = pricePosition({
    year: vehicle.year,
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant,
    mileage: vehicle.mileage,
    askingPrice: vehicle.askingPrice,
  });

  const cur = currency;
  const over = pos.deltaToMedian !== null && pos.deltaToMedian > 0;
  const under = pos.deltaToMedian !== null && pos.deltaToMedian < 0;

  if (pos.count === 0) {
    return (
      <div className="tru-card p-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[length:var(--t-micro)] text-[color:var(--muted)]">Market position</h4>
          <span className="text-[length:var(--t-micro)] px-1.5 py-0.5 rounded bg-[color:var(--glass)] text-[color:var(--faint)] border border-[color:var(--glass-line)]">
            sample feed
          </span>
        </div>
        <p className="text-[length:var(--t-small)] text-[color:var(--muted)]">{pos.verdict}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Headline position */}
      <div className="tru-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[length:var(--t-micro)] text-[color:var(--muted)]">
            Market position · your {money(vehicle.askingPrice, cur)}
          </h4>
          <span
            className="text-[length:var(--t-micro)] px-1.5 py-0.5 rounded bg-[color:var(--glass)] text-[color:var(--faint)] border border-[color:var(--glass-line)]"
            title="Illustrative listings — replace with a live AutoTrader / Cars.co.za feed"
          >
            sample feed
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          {over ? (
            <TrendingUp className="w-5 h-5 text-[color:var(--danger)] self-center" />
          ) : under ? (
            <TrendingDown className="w-5 h-5 text-[color:var(--cyan)] self-center" />
          ) : (
            <Minus className="w-5 h-5 text-[color:var(--muted)] self-center" />
          )}
          <span
            className={`text-[28px] leading-none font-semibold tracking-[-0.015em] tru-mono ${
              over ? 'text-[color:var(--danger)]' : under ? 'text-[color:var(--cyan)]' : 'text-[color:var(--white)]'
            }`}
          >
            {over ? '+' : ''}
            {money(pos.deltaToMedian || 0, cur)}
          </span>
          <span className="text-[length:var(--t-small)] text-[color:var(--muted)]">
            vs comp median {money(pos.median || 0, cur)}
          </span>
        </div>

        <p className="text-[length:var(--t-small)] text-[color:var(--white-dim)]">{pos.verdict}</p>

        <div className="grid grid-cols-4 gap-2 pt-1">
          {[
            ['Comparable', `${pos.count}`],
            ['Your rank', `${pos.rank} of ${pos.total}`],
            ['Cheapest→dearest', `${money(pos.low || 0, cur)}–${money(pos.high || 0, cur)}`],
            ['Median days listed', `${pos.avgDaysListed}d`],
          ].map(([k, v]) => (
            <div key={k} className="bg-[color:var(--ink)] border border-[color:var(--glass-line)] rounded-[8px] p-2">
              <span className="block text-[length:var(--t-micro)] text-[color:var(--faint)]">{k}</span>
              <span className="text-[length:var(--t-small)] text-[color:var(--white)] tru-mono">{v}</span>
            </div>
          ))}
        </div>

        {/* Suggested band */}
        <div className="flex items-center justify-between pt-2 border-t border-[color:var(--glass-line)] text-[length:var(--t-small)]">
          <span className="text-[color:var(--muted)]">To sit competitively</span>
          <span className="text-[color:var(--cyan)] tru-mono font-medium">
            {money(pos.suggestLow || 0, cur)} – {money(pos.suggestHigh || 0, cur)}
          </span>
        </div>
      </div>

      {/* Comparable listings */}
      <div>
        <h4 className="text-[length:var(--t-micro)] text-[color:var(--muted)] mb-2 px-1">
          Comparable listings ({pos.count})
        </h4>
        <div className="tru-card overflow-hidden [&>div:last-child]:border-b-0">
          {pos.comps.map((c) => (
            <div
              key={c.id}
              className="px-4 py-3 border-b border-[color:var(--glass-line)] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-[length:var(--t-small)] text-[color:var(--white)] truncate">
                  {c.year} {c.make} {c.model} {c.variant}
                </p>
                <p className="text-[length:var(--t-micro)] text-[color:var(--faint)] flex items-center gap-2 mt-0.5">
                  <span>{c.mileage.toLocaleString('en-ZA')} km</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-3 h-3" /> {c.town}
                  </span>
                  <span>{c.source}</span>
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[length:var(--t-small)] text-[color:var(--white)] tru-mono">
                  {money(c.price, cur)}
                </p>
                <p className="text-[length:var(--t-micro)] text-[color:var(--faint)] flex items-center gap-1 justify-end mt-0.5">
                  <Clock className="w-3 h-3" /> {c.daysListed}d listed
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[length:var(--t-micro)] text-[color:var(--faint)] mt-2 px-1">
          Sample listings — swap in a scheduled AutoTrader / Cars.co.za feed and this prices off live stock.
        </p>
      </div>
    </div>
  );
};
