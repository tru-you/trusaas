import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Link2,
  MessageCircle,
  Mail,
  Loader2,
  PenLine,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { EsigShareTarget, publishEsig, fetchEsigStatus, EsigSigned } from '../../lib/esig';
import { waHref, openMailTo } from '../../lib/contact';
import { useApp } from '../../context/AppContext';

interface SignatureShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: EsigShareTarget | null;
}

export const SignatureShareModal: React.FC<SignatureShareModalProps> = ({ isOpen, onClose, target }) => {
  const { profile, addNotification } = useApp();
  const [url, setUrl] = useState<string>('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string>('');
  const [signed, setSigned] = useState<EsigSigned | null>(null);
  const [copied, setCopied] = useState(false);
  const reported = useRef(false);

  const publish = useCallback(async () => {
    if (!target) return;
    setPublishing(true);
    setError('');
    setSigned(null);
    reported.current = false;
    try {
      const u = await publishEsig(target);
      setUrl(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish the signing link.');
    } finally {
      setPublishing(false);
    }
  }, [target]);

  useEffect(() => {
    if (isOpen && target) {
      setCopied(false);
      setUrl('');
      publish();
    }
  }, [isOpen, target, publish]);

  // Poll for the client's signature while the modal is open.
  useEffect(() => {
    if (!isOpen || !target || !url || signed) return;
    const timer = setInterval(async () => {
      const status = await fetchEsigStatus(target.id);
      if (status.signed && status.signature && status.name && status.signedAt) {
        const s: EsigSigned = { name: status.name, signature: status.signature, signedAt: status.signedAt };
        setSigned(s);
        if (!reported.current) {
          reported.current = true;
          target.onSigned(s);
          addNotification(
            'Document Signed',
            `${target.title} was signed by ${s.name} — signature saved to the record.`,
            'success'
          );
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [isOpen, target, url, signed, addNotification]);

  if (!isOpen || !target) return null;

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addNotification('Link Copied', 'Signing link copied to clipboard.', 'info');
  };

  const shareWhatsApp = () => {
    window.open(
      waHref(
        target.clientPhone || '',
        `Hi ${target.clientName}, please sign your ${target.title} here: ${url}`
      ),
      '_blank'
    );
  };

  const shareEmail = () => {
    openMailTo(
      target.clientEmail,
      `Please sign your ${target.title} — ${profile.companyName}`,
      `Hi ${target.clientName},\n\nPlease review and sign your ${target.title} here:\n\n${url}\n\nIt only takes a minute on any phone or computer.\n\nBest regards,\n${profile.companyName}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,20,32,0.40)] backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-[rgba(10,20,32,0.08)] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-[rgba(10,20,32,0.06)] bg-[#FAFAF8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[rgba(14,157,152,0.08)] border border-[rgba(14,157,152,0.20)] flex items-center justify-center text-[#0E9D98]">
              <PenLine className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1A2332]">Client Signing Link</h3>
              <p className="text-xs text-[#6B7685]">
                {target.title} · for {target.clientName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#6B7685] hover:text-[#1A2332] bg-[#EFEDE8] hover:bg-[#F5F4F1] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {publishing && (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-[#6B7685]">
              <Loader2 className="w-8 h-8 animate-spin text-[#0E9D98]" />
              <p className="text-sm font-medium">Preparing a frozen copy of the document…</p>
            </div>
          )}

          {error && !publishing && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-[#9F1239]">
              <p>{error}</p>
              <button
                onClick={publish}
                className="mt-3 px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-white rounded-lg text-xs font-semibold"
              >
                Try again
              </button>
            </div>
          )}

          {!publishing && !error && !signed && (
            <>
              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1.5">Signing link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 bg-[#FAFAF8] border border-[rgba(10,20,32,0.08)] rounded-xl px-3 py-2.5 text-xs text-[#1A2332] font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3.5 py-2.5 bg-[#0E9D98] hover:bg-[#14B8A6] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7685] block mb-1.5">Send to the client</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={shareWhatsApp}
                    disabled={!target.clientPhone}
                    className="px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-default"
                  >
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp
                  </button>
                  <button
                    onClick={shareEmail}
                    className="px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-4 h-4" />
                    Email
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1A2332]">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0E9D98] opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0E9D98]" />
                  </span>
                  Waiting for {target.clientName} to sign
                </div>
                <p className="text-xs text-[#6B7685] mt-1.5 leading-relaxed">
                  This window refreshes automatically — the moment your client draws their signature on
                  their phone, it appears here and is saved to the {target.kind}.
                </p>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-[#334155]">
                  <Link2 className="w-3.5 h-3.5 text-[#0E9D98]" />
                  <span>{target.title} published as a frozen document</span>
                </div>
              </div>
            </>
          )}

          {signed && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                  <ShieldCheck className="w-4 h-4" />
                  Signed by {signed.name}
                </div>
                <p className="text-xs text-[#334155] mt-1">
                  {target.title} was signed on{' '}
                  {new Date(signed.signedAt).toLocaleString('en-ZA', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  and the signature is saved to the record.
                </p>
              </div>
              <div className="p-4 bg-white rounded-xl border border-[rgba(10,20,32,0.08)]">
                <span className="text-[10px] font-semibold text-[rgba(10,20,32,0.50)] uppercase block mb-1">
                  Signature
                </span>
                <img src={signed.signature} alt="Client signature" className="h-16 w-auto max-w-[240px]" />
                <div className="border-t border-[rgba(10,20,32,0.10)] mt-2 pt-2">
                  <p className="text-sm font-bold text-[#1A2332]">{signed.name}</p>
                  <p className="text-[11px] text-[#6B7685]">Signed via client link</p>
                </div>
              </div>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FAFAF8] hover:bg-[#EFEDE8] text-[#0E9D98] rounded-xl text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open the signed page
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
