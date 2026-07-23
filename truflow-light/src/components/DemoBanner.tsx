import React from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { TRUE_CARS_URL, TRUESAAS_URL } from "../lib/ecosystem";

const DISMISS_KEY = "truflow_demo_banner_dismissed";

export default function DemoBanner({ productName = "TruFlow Lite" }: { productName?: string }) {
  const [open, setOpen] = React.useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) !== "1";
    } catch {
      return true;
    }
  });

  if (!open) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] md:left-[240px] px-3 pt-2 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-4xl flex items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-950/95 backdrop-blur px-3 py-2 shadow-lg shadow-black/40">
        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold tracking-normal text-amber-200">
            {productName} · Demo / pilot session
          </p>
          <p className="text-[13px] text-amber-100/80 leading-snug mt-0.5">
            Lite = stock, leads, tasks &amp; light costs. Shoot photos in <b>TruLens</b> only.{" "}
            <a href={TRUE_CARS_URL} target="_blank" rel="noopener noreferrer" className="text-amber-100 underline underline-offset-2 font-bold inline-flex items-center gap-0.5">
              true-cars.co.za <ExternalLink size={10} />
            </a>
            {" · "}
            <a href={TRUESAAS_URL} target="_blank" rel="noopener noreferrer" className="text-cyan-200 underline underline-offset-2 font-bold">
              TruSaas platform
            </a>
          </p>
        </div>
        <button
          type="button"
          className="text-amber-300/80 hover:text-[#E8EAE6] p-0.5 shrink-0"
          aria-label="Dismiss"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch { /* ignore */ }
            setOpen(false);
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
