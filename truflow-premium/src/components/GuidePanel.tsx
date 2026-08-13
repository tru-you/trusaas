import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, ExternalLink, Sparkles, Compass, Printer } from "lucide-react";
import {
  availableGuides,
  guidesForSection,
  GUIDE_APPS,
  type Guide,
  type GuideApp,
} from "../lib/guides";

/** Escape user-facing strings before dropping them into the print document. */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

/**
 * The "hardcopy": open a clean, self-contained print document and hand it to the
 * browser's print dialog — which is also "Save as PDF" on every platform. No
 * library, no server. One guide, or the whole set as a printed manual.
 */
function printGuides(guides: Guide[], heading: string) {
  const body = guides
    .map((g) => {
      const steps = g.steps
        .map(
          (s, i) =>
            `<li><span class="n">${i + 1}</span><div><p class="st">${esc(s.title)} <em>${esc(
              GUIDE_APPS[s.app].label,
            )}</em></p><p class="sd">${esc(s.detail)}</p></div></li>`,
        )
        .join("");
      return `<section><h2>${esc(g.title)}</h2><p class="goal">${esc(g.goal)}</p><ol>${steps}</ol></section>`;
    })
    .join("");

  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(heading)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #16324f; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #5c6b7a; margin: 0 0 24px; font-size: 13px; }
  section { break-inside: avoid; margin: 0 0 22px; padding: 0 0 18px; border-bottom: 1px solid #e6ebf1; }
  h2 { font-size: 17px; margin: 0 0 4px; }
  .goal { color: #5c6b7a; margin: 0 0 12px; }
  ol { list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: 12px; margin: 0 0 12px; }
  .n { display: grid; place-items: center; width: 24px; height: 24px; flex: none; border-radius: 50%;
       background: #e9f2fd; color: #0b63ce; font-weight: 700; font-size: 12px; }
  .st { font-weight: 700; margin: 2px 0 2px; }
  .st em { font-style: normal; font-weight: 600; font-size: 11px; color: #0b63ce; background: #e9f2fd;
           padding: 1px 7px; border-radius: 20px; margin-left: 4px; }
  .sd { margin: 0; color: #33475b; }
  footer { margin-top: 24px; color: #8494a3; font-size: 11px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>${esc(heading)}</h1>
  <p class="sub">TruFlow Premium · how-to guide</p>
  ${body}
  <footer>Generated from TruFlow Premium.</footer>
</body></html>`;

  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return; // popup blocked — nothing we can do silently
  w.document.write(doc);
  w.document.close();
  w.focus();
  // Give the new document a tick to lay out before the print dialog.
  w.setTimeout(() => w.print(), 250);
}

interface GuidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The dealer's current screen — lets the panel lead with relevant guides. */
  currentSection: string;
  /** Product gate, passed through from App so gated guides stay hidden. */
  hasProduct: (p: string) => boolean;
  /** Hand off to Dealer Assist when a written guide isn't enough. */
  onAskAssist: () => void;
}

/** Small coloured chip naming which app a step happens in. */
function AppBadge({ app }: { app: GuideApp }) {
  const meta = GUIDE_APPS[app];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ color: meta.tone, background: "color-mix(in srgb, " + meta.tone + " 15%, transparent)", border: "1px solid color-mix(in srgb, " + meta.tone + " 40%, transparent)" }}
    >
      {meta.label}
    </span>
  );
}

export default function GuidePanel({
  open,
  onOpenChange,
  currentSection,
  hasProduct,
  onAskAssist,
}: GuidePanelProps) {
  const [selected, setSelected] = useState<Guide | null>(null);

  // Reset to the list each time the panel closes, so it always reopens clean.
  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  if (!open) return null;

  // Lead with guides for the screen the dealer is on; fall back to everything.
  const contextual = guidesForSection(currentSection, hasProduct);
  const all = availableGuides(hasProduct);
  const listed = contextual.length ? contextual : all;
  const others = contextual.length ? all.filter((g) => !contextual.includes(g)) : [];

  return (
    <div className="fixed inset-0 z-[1100] font-sans">
      {/* Backdrop */}
      <button
        aria-label="Close guides"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer"
      />

      {/* Panel — full-screen on phones, right rail on desktop. */}
      <div className="absolute inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-[420px] flex flex-col bg-[color:var(--ink-2)] border-l border-[color:var(--glass-line)] shadow-2xl animate-in fade-in slide-in-from-right-5 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--glass-line)] bg-[linear-gradient(90deg,rgba(20,102,224,0.1),rgba(21,199,192,0.05))]">
          <div className="flex items-center gap-2 min-w-0">
            {selected ? (
              <button
                onClick={() => setSelected(null)}
                aria-label="Back to all guides"
                className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] p-1 -ml-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <Compass size={16} className="text-[color:var(--cyan)] shrink-0" />
            )}
            <span className="font-semibold text-[16px] text-[color:var(--white)] truncate">
              {selected ? selected.title : "How do I…?"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                selected
                  ? printGuides([selected], selected.title)
                  : printGuides(listed.concat(others), "TruFlow Premium — How-to guides")
              }
              aria-label={selected ? "Print this guide" : "Print all guides"}
              title={selected ? "Print / Save as PDF" : "Print all / Save as PDF"}
              className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <Printer size={15} />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="text-[rgba(232,234,230,0.72)] hover:text-[color:var(--white)] p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!selected ? (
            /* ── List of jobs ── */
            <div className="p-3 flex flex-col gap-2">
              {contextual.length > 0 && (
                <p className="px-1 pt-1 pb-0.5 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                  For this screen
                </p>
              )}
              {listed.map((g) => (
                <GuideRow key={g.id} guide={g} onClick={() => setSelected(g)} />
              ))}

              {others.length > 0 && (
                <>
                  <p className="px-1 pt-3 pb-0.5 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                    Everything else
                  </p>
                  {others.map((g) => (
                    <GuideRow key={g.id} guide={g} onClick={() => setSelected(g)} />
                  ))}
                </>
              )}
            </div>
          ) : (
            /* ── One guide, step by step ── */
            <div className="p-4">
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed mb-4">
                {selected.goal}
              </p>
              <ol className="flex flex-col gap-0">
                {selected.steps.map((s, i) => {
                  const meta = GUIDE_APPS[s.app];
                  const last = i === selected.steps.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      {/* Rail: number + connector line */}
                      <div className="flex flex-col items-center">
                        <span
                          className="grid place-items-center h-7 w-7 shrink-0 rounded-full text-[13px] font-semibold"
                          style={{ color: meta.tone, background: "color-mix(in srgb, " + meta.tone + " 15%, transparent)", border: "1px solid color-mix(in srgb, " + meta.tone + " 40%, transparent)" }}
                        >
                          {i + 1}
                        </span>
                        {!last && <span className="w-px flex-1 my-1 bg-[color:var(--glass-line)]" />}
                      </div>
                      {/* Step content */}
                      <div className={`min-w-0 flex-1 ${last ? "" : "pb-5"}`}>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-[15px] text-[color:var(--white)]">
                            {s.title}
                          </span>
                          <AppBadge app={s.app} />
                        </div>
                        <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed">
                          {s.detail}
                        </p>
                        {meta.url && (
                          <a
                            href={meta.url}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 mt-1.5 text-[13px] font-semibold text-[color:var(--cyan)] hover:underline"
                          >
                            Open {meta.label} <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        {/* Footer — the deep-reference fallback: ask, don't read. */}
        <div className="p-3 border-t border-[color:var(--glass-line)]">
          <button
            onClick={() => {
              onOpenChange(false);
              onAskAssist();
            }}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[color:var(--cyan-faint)] text-[color:var(--cyan)] border border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-soft)] hover:text-[color:var(--ink)] transition-colors cursor-pointer text-[13px] font-semibold"
          >
            <Sparkles size={14} />
            Still stuck? Ask Dealer Assist
          </button>
        </div>
      </div>
    </div>
  );
}

function GuideRow({ guide, onClick }: { guide: Guide; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 text-left px-3 py-3 rounded-xl bg-[color:var(--glass)] border border-[color:var(--glass-line)] hover:border-[color:var(--cyan-soft)] hover:bg-[color:var(--cyan-faint)] transition-colors cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[15px] text-[color:var(--white)] truncate">
            {guide.title}
          </span>
          {guide.spine && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-[color:var(--cyan)] bg-[color:var(--cyan-faint)] border border-[color:var(--cyan-soft)]">
              Start here
            </span>
          )}
        </div>
        <p className="text-[13px] text-[rgba(232,234,230,0.72)] truncate mt-0.5">{guide.blurb}</p>
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-[color:var(--muted)] group-hover:text-[color:var(--cyan)] transition-colors"
      />
    </button>
  );
}
