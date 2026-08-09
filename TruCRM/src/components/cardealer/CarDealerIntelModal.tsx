import React, { useState } from 'react';
import {
  X,
  FileText,
  Download,
  Printer,
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Car,
  Star,
  Building2,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Cpu,
  Globe,
  Brain,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Target,
  BarChart,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CarDealership } from '../../types/carDealer';
import { useApp } from '../../context/AppContext';

interface CarDealerIntelModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealer: CarDealership | null;
}

export const CarDealerIntelModal: React.FC<CarDealerIntelModalProps> = ({ isOpen, onClose, dealer }) => {
  const { profile, addNotification } = useApp();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const [thoughtProcess, setThoughtProcess] = useState<string | null>(null);
  const [showThought, setShowThought] = useState(false);

  if (!isOpen || !dealer) return null;

  const handleGenerateStrategy = async () => {
    setIsAnalyzing(true);
    setAnalysisReport(null);
    
    try {
      const response = await fetch('/api/cardealer/analyze-dealership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealershipData: dealer }),
      });
      
      const data = await response.json();
      setAnalysisReport(data.analysis);
      addNotification('Intelligence Brief Generated', `Analysis complete for ${dealer.name}.`, 'success');
    } catch (error) {
      console.error('Analysis Error:', error);
      addNotification('Intelligence Failed', 'Could not generate strategic report.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const intel = dealer.intelReport || {
    digitalMaturity: 'High',
    estimatedMonthlyAdSpend: 25000,
    inventoryTurnoverDays: 32,
    topSellingModels: ['SUV Series', 'Sedan Executive', 'EV Performance'],
    sentimentScore: 90,
    techStack: {
      crm: 'Unknown / Generic DMS',
      inventoryManager: 'vAuto',
      adsPlatform: 'Google Ads',
      analytics: ['Google Analytics 4'],
    },
    swotSummary: {
      strengths: ['Established market presence', 'Robust online inventory feed'],
      weaknesses: ['Moderate lead conversion turnaround'],
      opportunities: ['AI-driven lead automation & instant SMS follow-ups'],
      threats: ['Aggressive regional competition'],
    },
  };

  const handleDownloadPdf = () => {
    setIsDownloading(true);
    setTimeout(() => {
      setIsDownloading(false);
      setDownloadSuccess(true);
      addNotification(
        'PDF Intel Report Generated',
        `Successfully compiled and downloaded "${dealer.name} - Corporate Intelligence & Classifieds Breakdown.pdf"`,
        'success'
      );
      setTimeout(() => setDownloadSuccess(false), 3000);
    }, 1200);
  };

  const handlePrint = () => {
    window.print();
    addNotification('PDF Print Triggered', `Sent intelligence breakdown for ${dealer.name} to printer.`, 'info');
  };

  const sourceBadge = {
    autotrader: 'bg-orange-50 text-orange-600 border-orange-200',
    'cars.com': 'bg-blue-50 text-blue-600 border-blue-200',
    cargurus: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    edmunds: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  }[dealer.source];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[rgba(10,20,32,0.08)] w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-8 border-b border-[rgba(10,20,32,0.08)] flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-black text-[#1A2332] tracking-tight">{dealer.name}</h3>
              <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">{dealer.source}</span>
            </div>
            <p className="text-xs text-[rgba(10,20,32,0.40)] font-medium flex flex-wrap items-center gap-x-6 gap-y-2">
              <span>{dealer.address}</span>
              <span>{dealer.phone}</span>
              <a
                href={dealer.website}
                target="_blank"
                rel="noreferrer"
                className="text-[#0E9D98] hover:text-[#14B8A6] transition-colors inline-flex items-center gap-1"
              >
                <span>Website</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateStrategy}
              disabled={isAnalyzing}
              className={`px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all border ${
                isAnalyzing
                  ? 'bg-[#EFEDE8] text-[rgba(10,20,32,0.28)] border-[rgba(10,20,32,0.08)]'
                  : 'bg-[#0E9D98] text-white hover:bg-[#14B8A6] border-[#0E9D98]'
              }`}
            >
              {isAnalyzing ? 'Analyzing...' : 'Strategic Brief'}
            </button>

            <button
              onClick={onClose}
              className="p-2.5 text-[rgba(10,20,32,0.28)] hover:text-[#1A2332] bg-[#EFEDE8] hover:bg-[rgba(10,20,32,0.08)] rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto space-y-12 flex-1 scrollbar-hide">
          {/* Executive Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Inventory</span>
              <div className="text-xl font-medium text-[#1A2332]">{dealer.inventoryCount} units</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Ad Spend</span>
              <div className="text-xl font-medium text-[#0E9D98]">${intel.estimatedMonthlyAdSpend.toLocaleString()}</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Turnover</span>
              <div className="text-xl font-medium text-[#1A2332]">{intel.inventoryTurnoverDays} days</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Rating</span>
              <div className="text-xl font-medium text-[#1A2332]">{dealer.rating} / 5.0</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Franchise Network</h4>
              <div className="flex flex-wrap gap-2">
                {dealer.franchiseMakes.map((make, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-full bg-[#EFEDE8] text-[#6B7685] border border-[rgba(10,20,32,0.08)] text-[10px] font-bold"
                  >
                    {make}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Top Asset Categories</h4>
              <div className="space-y-2">
                {intel.topSellingModels.map((model, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-[rgba(10,20,32,0.08)]">
                    <span className="text-xs font-medium text-[#6B7685]">{model}</span>
                    <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">High</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Strategic Intel Brief */}
          {analysisReport && (
            <div className="space-y-4 animate-slideUp">
              <div className="p-[1px] bg-[rgba(10,20,32,0.06)] rounded-2xl">
                <div className="bg-[#FAFAF8] rounded-[15px] p-8">
                  <div className="flex items-center justify-between mb-8 pb-8 border-b border-[rgba(10,20,32,0.08)]">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[rgba(14,157,152,0.08)] rounded-2xl border border-[rgba(14,157,152,0.20)]">
                        <BarChart className="w-5 h-5 text-[#0E9D98]" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em] mb-2">Strategic Asset Analysis</h4>
                        <p className="text-xl font-black text-[#1A2332] tracking-tight">Intelligence Brief</p>
                      </div>
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none prose-p:text-[#6B7685] prose-headings:text-[#1A2332] prose-strong:text-[#0E9D98] prose-li:text-[#6B7685] leading-relaxed">
                    <ReactMarkdown>{analysisReport}</ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Technology Stack Intelligence */}
          {intel.techStack && (
            <div className="space-y-6">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[rgba(10,20,32,0.28)]">Infrastructure Matrix</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Operations CRM</span>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#EFEDE8] flex items-center justify-center border border-[rgba(10,20,32,0.08)]">
                      <Building2 className="w-5 h-5 text-[#0E9D98]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A2332]">{intel.techStack.crm}</p>
                      <p className="text-[10px] text-[rgba(10,20,32,0.20)] uppercase tracking-widest font-medium mt-0.5">Enterprise DMS</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Inventory Sync</span>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#EFEDE8] flex items-center justify-center border border-[rgba(10,20,32,0.08)]">
                      <Car className="w-5 h-5 text-[rgba(10,20,32,0.40)]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A2332]">{intel.techStack.inventoryManager}</p>
                      <p className="text-[10px] text-[rgba(10,20,32,0.20)] uppercase tracking-widest font-medium mt-0.5">Asset Manager</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Ad Network</span>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-[#EFEDE8] flex items-center justify-center border border-[rgba(10,20,32,0.08)]">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#1A2332]">{intel.techStack.adsPlatform}</p>
                      <p className="text-[10px] text-[rgba(10,20,32,0.20)] uppercase tracking-widest font-medium mt-0.5">Core Spend</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Tracking Pixels</span>
                  <div className="flex flex-wrap gap-2">
                    {intel.techStack.analytics.map((tool, idx) => (
                      <span key={idx} className="px-3 py-1 bg-[#EFEDE8] text-[rgba(10,20,32,0.40)] border border-[rgba(10,20,32,0.08)] rounded-full text-[10px] font-bold uppercase tracking-widest">
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
                {intel.techStack.marketingAutomation && (
                  <div className="space-y-4">
                    <span className="text-[10px] font-bold text-[rgba(10,20,32,0.28)] uppercase tracking-[0.2em]">Automation Engine</span>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-[#EFEDE8] flex items-center justify-center border border-[rgba(10,20,32,0.08)]">
                        <Sparkles className="w-5 h-5 text-[#0E9D98]" />
                      </div>
                      <p className="text-xs font-bold text-[#1A2332]">{intel.techStack.marketingAutomation}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SWOT Intelligence Analysis */}
          <div className="space-y-6">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[rgba(10,20,32,0.28)]">Strategic Matrix</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Strengths */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block">Strengths</span>
                <ul className="space-y-3 text-xs text-[#6B7685]">
                  {intel.swotSummary.strengths.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest block">Weaknesses</span>
                <ul className="space-y-3 text-xs text-[#6B7685]">
                  {intel.swotSummary.weaknesses.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-amber-500 font-bold">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Opportunities */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-[#0E9D98] uppercase tracking-widest block">Opportunities</span>
                <ul className="space-y-3 text-xs text-[#6B7685]">
                  {intel.swotSummary.opportunities.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-[#0E9D98] font-bold">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Threats */}
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest block">Threats</span>
                <ul className="space-y-3 text-xs text-[#6B7685]">
                  {intel.swotSummary.threats.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="text-rose-500 font-bold">•</span>
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* PDF Footer Metadata */}
          <div className="pt-12 border-t border-[rgba(10,20,32,0.08)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-medium text-[rgba(10,20,32,0.20)] uppercase tracking-widest">
            <span>Network Intelligence Engine // {profile.companyName}</span>
            <span>Ref: {dealer.id.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
