import React from "react";
import { X, ExternalLink } from "lucide-react";
import { TRUE_CARS_URL, TRUESAAS_URL } from "../lib/ecosystem";

const DISMISS_KEY = "truflow_info_strip_dismissed";

/**
 * Quiet footer strip linking out to the public showroom and the platform page.
 *
 * This was a warning banner reading "Password login is for demos" — true when
 * the login was a hardcoded password checked in the browser, and misleading now
 * that each dealership has its own server-verified code. It also sat pinned
 * across the top in amber, which is a lot of urgency for two links.
 */
export default function DemoBanner({ productName = "TruFlow" }: { productName?: string }) {
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
      <div className="pointer-events-auto mx-auto max-w-4xl flex items-center gap-3 rounded-full border border-[rgba(232,234,230,0.14)] bg-[rgba(232,234,230,0.055)] px-4 py-2">
        <span className="text-[13px] text-[rgba(232,234,230,0.55)] shrink-0">{productName}</span>
        <p className="text-[13px] text-[rgba(232,234,230,0.55)] leading-snug min-w-0 truncate">
          Vehicle photos are captured in <span className="text-[rgba(232,234,230,0.72)]">TruLens</span>.
          {" "}
          <a href={TRUE_CARS_URL} target="_blank" rel="noopener noreferrer" className="text-[#8AA2B8] hover:text-[#7DB0F9] inline-flex items-center gap-0.5">
            Showroom <ExternalLink size={10} />
          </a>
          {" · "}
          <a href={TRUESAAS_URL} target="_blank" rel="noopener noreferrer" className="text-[#8AA2B8] hover:text-[#7DB0F9]">
            TruSaaS
          </a>
        </p>
        <button
          type="button"
          className="text-[rgba(232,234,230,0.45)] hover:text-[#E8EAE6] p-0.5 shrink-0 ml-auto"
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
