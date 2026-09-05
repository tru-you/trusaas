"use client";

import { useEffect } from "react";
import { YCG } from "@/lib/truwidgets";

/**
 * Injects the canonical TruLoader once per page load — exactly what the
 * TruWidgets WordPress plugin does server-side (packages/truwidgets-wp).
 * It self-mounts: TruForm + TruAfford launchers, and exposes
 * window.TruDealer.open() / window.TruShare.open() for trigger buttons.
 */
export default function TruLoader() {
  useEffect(() => {
    // next/script can be inconsistent with data-* forwarding; inject manually.
    if (document.querySelector("script[data-tru-loader]")) return;

    const s = document.createElement("script");
    s.src = `${YCG.cdn}/tru-loader/tru-loader.js`;
    s.async = true;
    s.setAttribute("data-tru-loader", "1");
    s.setAttribute("data-dealer", YCG.dealer);
    s.setAttribute("data-accent", YCG.accent);
    s.setAttribute("data-wa", YCG.wa);
    s.setAttribute("data-theme", YCG.theme);
    s.setAttribute("data-widgets", "afford,form,book,share");
    s.setAttribute("data-webhook", YCG.webhook);
    // Clear the mobile bottom-nav (64px) + a gap so launchers don't fight it.
    s.setAttribute("data-afford-position", "left");
    s.setAttribute("data-afford-bottom", "84px");
    s.setAttribute("data-form-position", "right");
    s.setAttribute("data-form-bottom", "84px");
    s.setAttribute("data-book-address", YCG.bookAddress);
    s.setAttribute("data-share-site", YCG.shareSite);
    s.setAttribute("data-share-vehicle-path", YCG.shareVehiclePath);
    document.body.appendChild(s);
    // Loader + widgets persist across SPA navigations — leave mounted.
  }, []);

  return null;
}
