import React, { useRef } from 'react';
import { ExternalLink, Printer } from 'lucide-react';

interface DocFrameProps {
  title: string;
  subtitle: string;
  src: string;
}

const DocFrame: React.FC<DocFrameProps> = ({ title, subtitle, src }) => {
  const frameRef = useRef<HTMLIFrameElement>(null);

  return (
    <div className="h-full flex flex-col bg-[#F5F1E8]">
      <div className="px-4 md:px-6 py-3 bg-white border-b border-[rgba(10,20,32,0.08)] flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[#1A2332] tracking-tight">{title}</h1>
          <p className="text-xs text-[#6B7685] truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => frameRef.current?.contentWindow?.print()}
            className="px-3 py-1.5 bg-[#0E9D98] hover:bg-[#0B8A85] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Print the document — then Save as PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 bg-[#EFEDE8] hover:bg-[#E4E0D8] text-[#334155] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Open in a full browser tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            New tab
          </a>
        </div>
      </div>
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        className="flex-1 w-full min-h-0 bg-[#F5F1E8]"
      />
    </div>
  );
};

export const TruDocsView: React.FC = () => (
  <DocFrame
    title="TruDocs — Quotes, Invoices & SLAs"
    subtitle="Editable branded documents · draw signatures · Print / PDF · Export HTML · autosaves in this browser"
    src="/tru-docs.html"
  />
);

export const OnboardingView: React.FC = () => (
  <DocFrame
    title="Client Onboarding Questionnaire"
    subtitle="Capture dealership details before going live · editable, signable, Print / PDF · autosaves in this browser"
    src="/tru-onboarding.html"
  />
);
