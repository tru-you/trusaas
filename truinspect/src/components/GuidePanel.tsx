import React, { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Compass, Printer } from "lucide-react";
import { allGuides, guidesForSection, type Guide } from "../lib/guides";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );
}

function printGuides(guides: Guide[], heading: string) {
  const body = guides
    .map((g) => {
      const steps = g.steps
        .map(
          (s, i) =>
            `<li><span class="n">${i + 1}</span><div><p class="st">${esc(s.title)}</p><p class="sd">${esc(s.detail)}</p></div></li>`,
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
  .sd { margin: 0; color: #33475b; }
  footer { margin-top: 24px; color: #8494a3; font-size: 11px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>${esc(heading)}</h1>
  <p class="sub">TruInspect — how-to guide</p>
  ${body}
  <footer>Generated from TruInspect.</footer>
</body></html>`;

  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(doc);
  w.document.close();
  w.focus();
  w.setTimeout(() => w.print(), 250);
}

interface GuidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSection: string;
}

export default function GuidePanel({ open, onOpenChange, currentSection }: GuidePanelProps) {
  const [selected, setSelected] = useState<Guide | null>(null);

  useEffect(() => {
    if (!open) setSelected(null);
  }, [open]);

  if (!open) return null;

  const contextual = guidesForSection(currentSection);
  const all = allGuides();
  const listed = contextual.length ? contextual : all;
  const others = contextual.length ? all.filter((g) => !contextual.includes(g)) : [];

  return (
    <div className="fixed inset-0 z-[1100] font-sans">
      <button
        aria-label="Close guides"
        onClick={() => onOpenChange(false)}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] cursor-pointer"
      />

      <div className="absolute inset-0 flex flex-col bg-[color:var(--ink-2,#0B0F17)] border-l border-[rgba(232,234,230,0.14)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(232,234,230,0.14)] bg-[linear-gradient(90deg,rgba(20,102,224,0.1),rgba(21,199,192,0.05))]">
          <div className="flex items-center gap-2 min-w-0">
            {selected ? (
              <button
                onClick={() => setSelected(null)}
                aria-label="Back to all guides"
                className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1 -ml-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <ChevronLeft size={18} />
              </button>
            ) : (
              <Compass size={16} className="text-[#4FE3DC] shrink-0" />
            )}
            <span className="font-semibold text-[16px] text-[#E8EAE6] truncate">
              {selected ? selected.title : "How do I…?"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() =>
                selected
                  ? printGuides([selected], selected.title)
                  : printGuides(listed.concat(others), "TruInspect — How-to guides")
              }
              aria-label={selected ? "Print this guide" : "Print all guides"}
              title={selected ? "Print / Save as PDF" : "Print all / Save as PDF"}
              className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <Printer size={15} />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="text-[rgba(232,234,230,0.72)] hover:text-[#E8EAE6] p-1 rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!selected ? (
            <div className="p-3 flex flex-col gap-2">
              {contextual.length > 0 && (
                <p className="px-1 pt-1 pb-0.5 text-[12px] font-semibold tracking-wider text-neutral-500">
                  For this screen
                </p>
              )}
              {listed.map((g) => (
                <GuideRow key={g.id} guide={g} onClick={() => setSelected(g)} />
              ))}
              {others.length > 0 && (
                <>
                  <p className="px-1 pt-3 pb-0.5 text-[12px] font-semibold tracking-wider text-neutral-500">
                    Everything else
                  </p>
                  {others.map((g) => (
                    <GuideRow key={g.id} guide={g} onClick={() => setSelected(g)} />
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="p-4">
              <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed mb-4">
                {selected.goal}
              </p>
              <ol className="flex flex-col gap-0">
                {selected.steps.map((s, i) => {
                  const last = i === selected.steps.length - 1;
                  return (
                    <li key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="grid place-items-center h-7 w-7 shrink-0 rounded-full text-[13px] font-semibold text-[#4FE3DC] bg-[rgba(79,227,220,0.15)] border border-[rgba(79,227,220,0.4)]">
                          {i + 1}
                        </span>
                        {!last && <span className="w-px flex-1 my-1 bg-[rgba(232,234,230,0.14)]" />}
                      </div>
                      <div className={`min-w-0 flex-1 ${last ? "" : "pb-5"}`}>
                        <span className="font-semibold text-[15px] text-[#E8EAE6]">
                          {s.title}
                        </span>
                        <p className="text-[13px] text-[rgba(232,234,230,0.72)] leading-relaxed mt-1">
                          {s.detail}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[rgba(232,234,230,0.14)]">
          <a
            href="https://wa.me/447476995694"
            target="_blank"
            rel="noopener"
            className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-[rgba(79,227,220,0.08)] text-[#4FE3DC] border border-[rgba(79,227,220,0.25)] hover:bg-[rgba(79,227,220,0.18)] transition-colors text-[13px] font-semibold"
          >
            Still stuck? Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

function GuideRow({ guide, onClick }: { guide: Guide; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 text-left px-3 py-3 rounded-xl bg-[rgba(232,234,230,0.04)] border border-[rgba(232,234,230,0.14)] hover:border-[rgba(79,227,220,0.25)] hover:bg-[rgba(79,227,220,0.06)] transition-colors cursor-pointer"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[15px] text-[#E8EAE6] truncate">
            {guide.title}
          </span>
          {guide.spine && (
            <span className="shrink-0 text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded-full text-[#4FE3DC] bg-[rgba(79,227,220,0.08)] border border-[rgba(79,227,220,0.25)]">
              Start here
            </span>
          )}
        </div>
        <p className="text-[13px] text-[rgba(232,234,230,0.72)] truncate mt-0.5">{guide.blurb}</p>
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-neutral-500 group-hover:text-[#4FE3DC] transition-colors"
      />
    </button>
  );
}
