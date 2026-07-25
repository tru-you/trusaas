import React from "react";
import { DMSState } from "../types";

/**
 * Where the deals come from.
 *
 * Every lead already records a source — Website, Walk-in, Facebook, AutoTrader.
 * It was shown on each lead and aggregated nowhere, so a dealer renewing an
 * AutoTrader subscription had no way to tell whether it had ever produced a
 * sale. Leads join to agreements and invoices by leadId, and those join to a
 * vehicle with a costPrice, so the whole picture is already in the data: no
 * integration, no import, nothing new to capture.
 *
 * Gross is real money — sale price less what the car cost and what was spent
 * preparing it. A source that brings volume but no gross is a subscription
 * worth cancelling, and that is the decision this panel exists to inform.
 */

const fmtR = (n: number) => "R " + Math.round(n).toLocaleString("en-ZA");

interface Row {
  source: string;
  leads: number;
  sold: number;
  gross: number;
  conversion: number;
}

export default function LeadSourcePerformance({ state }: { state: DMSState }) {
  const leads = state.leads || [];
  const agreements = state.agreements || [];
  const invoices = state.invoices || [];
  const vehicles = state.vehicles || [];

  /** What the dealership actually made on a car: sale price, less what it cost
   *  to buy, less recon. Falls back through agreement then invoice, since a
   *  cash deal may only ever produce an invoice. */
  const grossForLead = (leadId: string): number => {
    const agr = agreements.find((a) => a.leadId === leadId);
    const inv = invoices.find((i) => i.leadId === leadId);
    const salePrice = agr?.purchasePrice ?? inv?.amount ?? 0;
    if (!salePrice) return 0;

    const vehicleId = agr?.vehicleId || inv?.vehicleId;
    const v = vehicles.find((x) => x.id === vehicleId);
    if (!v) return 0;

    const recon = (v.reconTasks || []).reduce((s, t) => s + (t.cost || 0), 0);
    return salePrice - (v.costPrice || 0) - recon;
  };

  // A lead counts as sold once it is Closed Won, or once paper exists against it.
  const isSold = (leadId: string, status: string) =>
    status === "Closed Won" ||
    agreements.some((a) => a.leadId === leadId) ||
    invoices.some((i) => i.leadId === leadId);

  const bySource = new Map<string, Row>();
  for (const l of leads) {
    const key = (l.source || "Unknown").trim() || "Unknown";
    const row = bySource.get(key) || { source: key, leads: 0, sold: 0, gross: 0, conversion: 0 };
    row.leads += 1;
    if (isSold(l.id, l.status)) {
      row.sold += 1;
      row.gross += grossForLead(l.id);
    }
    bySource.set(key, row);
  }

  const rows = [...bySource.values()]
    .map((r) => ({ ...r, conversion: r.leads ? (r.sold / r.leads) * 100 : 0 }))
    .sort((a, b) => b.gross - a.gross || b.leads - a.leads);

  const totalGross = rows.reduce((s, r) => s + r.gross, 0);
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0);
  const totalSold = rows.reduce((s, r) => s + r.sold, 0);
  const best = rows.find((r) => r.gross > 0);
  // Volume without sales is the finding worth surfacing — that is the spend to question.
  const deadWeight = rows
    .filter((r) => r.sold === 0 && r.leads >= 3)
    .sort((a, b) => b.leads - a.leads)[0];

  if (!rows.length) {
    return (
      <div className="lg:col-span-6 card p-5 flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-white/5 pb-2">
          <h3 className="font-bold text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal">
            Where the deals come from
          </h3>
        </div>
        <p className="text-[13px] text-[rgba(232,234,230,0.55)]">
          No leads captured yet. Once leads come in with a source, this shows which
          ones actually turn into sales.
        </p>
      </div>
    );
  }

  return (
    <div className="lg:col-span-6 card p-5 flex flex-col gap-4">
      <div className="flex justify-between items-center border-b border-white/5 pb-2">
        <h3 className="font-bold text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal">
          Where the deals come from
        </h3>
        <span className="text-[13px] text-[rgba(232,234,230,0.55)] font-mono">
          {totalSold} of {totalLeads} leads sold
        </span>
      </div>

      {/* Table */}
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-2 pb-1 text-[13px] text-[rgba(232,234,230,0.45)]">
          <span>Source</span>
          <span className="text-right w-14">Leads</span>
          <span className="text-right w-12">Sold</span>
          <span className="text-right w-24">Gross</span>
        </div>

        {rows.map((r) => {
          // Bar is share of the best-performing source, so the ranking is legible
          // at a glance without needing to read every number.
          const share = totalGross > 0 ? Math.max(0, r.gross) / Math.max(...rows.map((x) => Math.max(x.gross, 0)) , 1) : 0;
          return (
            <div key={r.source} className="relative px-2 py-2 rounded-lg overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-[color:var(--cyan-faint)] rounded-lg pointer-events-none"
                style={{ width: `${Math.round(share * 100)}%` }}
              />
              <div className="relative grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center text-[13px]">
                <span className="text-[color:var(--white)] truncate">{r.source}</span>
                <span className="text-right w-14 text-[rgba(232,234,230,0.72)] font-mono">{r.leads}</span>
                <span className="text-right w-12 text-[rgba(232,234,230,0.72)] font-mono">{r.sold}</span>
                <span
                  className={`text-right w-24 font-mono ${
                    r.gross > 0 ? "text-[color:var(--cyan)]" : "text-[rgba(232,234,230,0.45)]"
                  }`}
                >
                  {r.gross > 0 ? fmtR(r.gross) : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* The read, in a sentence — this is the part a dealer acts on. */}
      <div className="border-t border-white/5 pt-3 text-[13px] leading-relaxed text-[rgba(232,234,230,0.72)]">
        {best ? (
          <>
            <span className="text-[color:var(--white)]">{best.source}</span> has brought the
            most gross at {fmtR(best.gross)} from {best.sold} sale{best.sold === 1 ? "" : "s"}
            {best.leads > 0 && ` (${Math.round(best.conversion)}% of its leads)`}.
          </>
        ) : (
          "No sales recorded against a lead source yet."
        )}
        {deadWeight && (
          <>
            {" "}
            <span className="text-[color:var(--white)]">{deadWeight.source}</span> has brought{" "}
            {deadWeight.leads} leads and no sales — worth asking what you pay for it.
          </>
        )}
      </div>
    </div>
  );
}
