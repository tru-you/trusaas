"use client";

import { useEffect, useId, useRef } from "react";
import { YCG } from "@/lib/truwidgets";

type WidgetName = "tru-afford" | "tru-repay" | "tru-value" | "tru-form";

interface TruWidgetInlineProps {
  widget: WidgetName;
  /** Extra data-* attrs forwarded to the widget script (price, vehicle, mount, etc.) */
  attrs?: Record<string, string | number | undefined>;
  className?: string;
}

/**
 * Mounts a real TruSaaS widget script inline. The widget renders inside a
 * Shadow DOM host — we only provide the mount element + config. One script
 * per (widget, id) pair; React strict-mode double-invoke is guarded.
 */
export default function TruWidgetInline({ widget, attrs = {}, className }: TruWidgetInlineProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountId = useId().replace(/:/g, "");
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current || !hostRef.current) return;
    mounted.current = true;

    const mountSelector = `#${mountId}`;
    const s = document.createElement("script");
    s.src = `${YCG.cdn}/${widget}/${widget}.js`;
    s.async = true;
    // Give every inline widget the shared dealer/brand/webhook config...
    s.setAttribute("data-dealer", YCG.dealer);
    s.setAttribute("data-accent", YCG.accent);
    s.setAttribute("data-wa", YCG.wa);
    s.setAttribute("data-theme", YCG.theme);
    s.setAttribute("data-webhook", YCG.webhook);
    // ...then let the caller override / add per-instance data (price, mount...).
    const merged: Record<string, string | number> = {
      "data-mount": mountSelector,
      // tru-repay uses data-target for its inline mount selector:
      "data-target": mountSelector,
      "data-mode": "inline",
      ...attrs,
    } as Record<string, string | number>;
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "") s.setAttribute(k, String(v));
    }
    document.body.appendChild(s);
  }, [widget, mountId, attrs]);

  return <div id={mountId} ref={hostRef} className={className} />;
}
