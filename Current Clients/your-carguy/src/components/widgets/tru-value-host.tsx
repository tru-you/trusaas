"use client";

import TruWidgetInline from "@/components/widgets/tru-widget-inline";

/** Client wrapper so a server page can drop the real TruValue widget inline. */
export default function TruValueHost() {
  return <TruWidgetInline widget="tru-value" attrs={{ "data-margin": "15" }} />;
}
