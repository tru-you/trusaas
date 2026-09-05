"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Vehicle } from "@/data/mock-stock";
import { toast } from "sonner";

type WidgetAction = "form" | "book" | "share" | "afford";

/**
 * The widget registry keeps instances forever (stale entries from inline
 * mounts on previous SPA pages). Open the LAST instance whose DOM root is
 * still in the document; fall back to the global loader API.
 */
function openLiveWidget(name: "TruForm", payload?: Record<string, unknown>): boolean {
  const reg = window[name] as unknown as
    | { instances?: { open: (p?: Record<string, unknown>) => void; root?: Element | null }[] }
    | undefined;
  const live = reg?.instances?.filter((i) => i.root && document.body.contains(i.root));
  const target = live?.length ? live[live.length - 1] : reg?.instances?.[reg.instances.length - 1];
  if (target) {
    target.open(payload);
    return true;
  }
  return false;
}

interface TruTriggerProps {
  action: WidgetAction;
  vehicle?: Vehicle;
  /** Explicit widget payload (source, message, interest...). Vehicle-derived defaults apply when omitted. */
  payload?: Record<string, unknown>;
  children: ReactNode;
  variant?: "brand" | "outline" | "ghost";
  className?: string;
  size?: "default" | "sm" | "lg";
}

/**
 * Fires a real TruSaaS widget through the loader's public API
 * (window.TruDealer.open / window.TruShare.open). No local reimplementation —
 * the widget code is served from cdn.tru-saas.com and renders its own UI.
 */
export default function TruTrigger({
  action,
  vehicle,
  payload: payloadProp,
  children,
  variant = "brand",
  className,
  size,
}: TruTriggerProps) {
  const click = () => {
    if (typeof window === "undefined") return;

    if (action === "share" && vehicle) {
      if (window.TruShare?.open) {
        window.TruShare.open({
          year: String(vehicle.year),
          make: vehicle.make,
          name: `${vehicle.model} ${vehicle.variant ?? ""}`.trim(),
          price: vehicle.price,
          img: vehicle.images[0],
        });
        return;
      }
      toast.error("Share widget still loading — try again in a second.");
      return;
    }

    // Build the widget payload: explicit prop wins, vehicle context fills the rest.
    const payload: Record<string, unknown> | undefined =
      payloadProp ??
      (action === "form" && vehicle
        ? {
            vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
            source: "YCG Vehicle Enquiry",
            message: `Hi, I'd like to enquire about the ${vehicle.year} ${vehicle.make} ${vehicle.model} (${vehicle.stockNo}). Is it still available?`,
          }
        : undefined);

    // Prefer a live widget instance directly (works even before the loader API exists)
    if (action === "form" && openLiveWidget("TruForm", payload)) return;

    if (window.TruDealer?.open) {
      window.TruDealer.open(action, payload);
      return;
    }
    toast.error("Widget still loading — try again in a second.");
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={click} type="button">
      {children}
    </Button>
  );
}
