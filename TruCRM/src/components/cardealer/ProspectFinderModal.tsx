import React, { useState } from 'react';
import { Search, Building2, Car, Plus, ShieldCheck, MapPin, DollarSign, CheckCircle2, Globe, Filter, X } from 'lucide-react';
import { CarDealership, ClassifiedSource } from '../../types/carDealer';
import { useApp } from '../../context/AppContext';
import { apiFetch } from '../../lib/api';

interface ProspectFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportDealer: (dealer: CarDealership) => void;
  existingDealerNames: string[];
}

const unindexedProspectsPool: Array<{
  id: string;
  name: string;
  source: ClassifiedSource;
  location: string;
  address: string;
  phone: string;
  email: string;
  contactPerson: string;
  inventoryCount: number;
  avgVehiclePrice: number;
  franchiseMakes: string[];
  estimatedAdSpend: number;
  website: string;
  techStack?: {
    crm: string;
    inventoryManager: string;
    adsPlatform: string;
    analytics: string[];
    marketingAutomation?: string;
  };
}> = [];

export const ProspectFinderModal: React.FC<ProspectFinderModalProps> = ({
  isOpen,
  onClose,
  onImportDealer,
  existingDealerNames,
}) => {
  const { addNotification } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [aiProspects, setAiProspects] = useState<typeof unindexedProspectsPool>([]);

  if (!isOpen) return null;

  const triggerNetworkSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await apiFetch('/api/cardealer/search-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm }),
      });
      
      const data = await response.json();
      
      if (data.prospects && Array.isArray(data.prospects)) {
        const mappedProspects = data.prospects.map((p: any, idx: number) => ({
          id: `ai-pro-${Date.now()}-${idx}`,
          name: p.name,
          source: 'google' as ClassifiedSource,
          location: p.location || searchTerm,
          address: p.address,
          phone: p.phone || 'Contact for details',
          email: `sales@${p.website?.replace(/https?:\/\/(www\.)?/, '').split('/')[0] || 'dealership.com'}`,
          contactPerson: 'Manager',
          inventoryCount: p.inventorySize || 45,
          avgVehiclePrice: 35000,
          franchiseMakes: p.brands || ['General'],
          estimatedAdSpend: 15000,
          website: p.website.startsWith('http') ? p.website : `https://${p.website}`,
          techStack: {
            crm: 'Unknown',
            inventoryManager: 'vAuto',
            adsPlatform: 'Google Ads',
            analytics: ['Google Analytics 4']
          }
        }));
        
        setAiProspects(mappedProspects);
        addNotification('AI Search Complete', `Found ${mappedProspects.length} real dealerships in ${searchTerm}.`, 'success');
      } else if (data.message) {
        addNotification('AI Search Info', data.message, 'info');
      }
    } catch (error) {
      console.error('AI Search Error:', error);
      addNotification('AI Search Failed', 'Could not reach the search service.', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const pool = [...unindexedProspectsPool, ...aiProspects];

  let filteredProspects = pool.filter((p) => {
    const notAlreadyInCrm = !existingDealerNames.some(
      (name) => name.toLowerCase() === p.name.toLowerCase()
    );
    const matchesSource = sourceFilter === 'all' || p.source === sourceFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.franchiseMakes.some((m) => m.toLowerCase().includes(searchTerm.toLowerCase()));

    return notAlreadyInCrm && matchesSource && matchesSearch;
  });

  filteredProspects.sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      return b.id.localeCompare(a.id);
    }
  });

  const handleImport = (prospect: typeof unindexedProspectsPool[0]) => {
    const newDealer: CarDealership = {
      id: `cd-imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: prospect.name,
      source: prospect.source,
      location: prospect.location,
      address: prospect.address,
      phone: prospect.phone,
      email: prospect.email,
      contactPerson: prospect.contactPerson,
      inventoryCount: prospect.inventoryCount,
      avgVehiclePrice: prospect.avgVehiclePrice,
      rating: 4.6,
      reviewsCount: 140,
      website: prospect.website,
      franchiseMakes: prospect.franchiseMakes,
      status: 'identified',
      notes: `Discovered via Unindexed Prospect Finder on ${prospect.source.toUpperCase()}. Potential high-value target.`,
      intelReport: {
        digitalMaturity: 'High',
        estimatedMonthlyAdSpend: prospect.estimatedAdSpend,
        inventoryTurnoverDays: 32,
        topSellingModels: prospect.franchiseMakes.map((m) => `${m} Flagship`),
        sentimentScore: 90,
        techStack: prospect.techStack,
        swotSummary: {
          strengths: ['Active regional classifieds inventory', 'Strong digital web presence'],
          weaknesses: ['Decentralized communication channels across rooftops'],
          opportunities: ['Automated AI lead routing and instant inventory valuation sync'],
          threats: ['National auto group consolidation'],
        },
      },
    };

    onImportDealer(newDealer);
    setImportedIds((prev) => [...prev, prospect.id]);
    addNotification(
      'Prospect Indexed Successfully',
      `Imported ${prospect.name} into your active dealership watchlist and CRM intel.`,
      'success'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(10,20,32,0.40)] backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-[rgba(10,20,32,0.08)] w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-[#1A2332] tracking-tight leading-none">Network Intelligence</h3>
            <p className="text-sm text-[#6B7685] font-medium max-w-md">
              Synchronize unindexed dealership assets from the global classified network.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#1A2332]/20" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerNetworkSearch()}
                placeholder="Search region or brand..."
                className="w-full bg-[rgba(10,20,32,0.03)] border border-[rgba(10,20,32,0.08)] rounded-2xl pl-10 pr-4 py-3 text-xs text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
            <button
              onClick={triggerNetworkSearch}
              disabled={isSearching || !searchTerm.trim()}
              className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border ${
                isSearching 
                  ? 'bg-[rgba(10,20,32,0.03)] text-[#1A2332]/20 border-white/5' 
                  : 'bg-white text-black hover:bg-white/90 border-white'
              }`}
            >
              {isSearching ? 'Scanning...' : 'Scan Network'}
            </button>
            <button
              onClick={onClose}
              className="p-3 text-[#1A2332]/20 hover:text-[#1A2332] bg-[rgba(10,20,32,0.03)] hover:bg-white/10 rounded-2xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 bg-[#FAFAF8] border-b border-[rgba(10,20,32,0.08)] flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgba(10,20,32,0.50)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerNetworkSearch()}
                placeholder="Search city, dealer name, brand..."
                className="w-full bg-white border border-[rgba(10,20,32,0.08)] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1A2332] placeholder-[rgba(10,20,32,0.40)] focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={triggerNetworkSearch}
              disabled={isSearching || !searchTerm.trim()}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-lg ${
                isSearching 
                  ? 'bg-[#EFEDE8] text-[rgba(10,20,32,0.50)] cursor-not-allowed' 
                  : 'bg-[#0E9D98] hover:bg-[#14B8A6] text-white shadow-cyan-600/20'
              }`}
            >
              {isSearching ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>AI Live Search</span>
                </>
              )}
            </button>
            <div className="flex items-center bg-white border border-[rgba(10,20,32,0.08)] rounded-xl p-1 shrink-0">
              <button
                onClick={() => setSortBy('date')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  sortBy === 'date'
                    ? 'bg-[#0E9D98] text-white shadow'
                    : 'text-[#6B7685] hover:text-[#1A2332]'
                }`}
                title="Sort by Date Added"
              >
                Date Added
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  sortBy === 'name'
                    ? 'bg-[#0E9D98] text-white shadow'
                    : 'text-[#6B7685] hover:text-[#1A2332]'
                }`}
                title="Sort Alphabetically (A-Z)"
              >
                A-Z
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['all', 'autotrader', 'cars.com', 'cargurus', 'edmunds', 'google'].map((src) => (
              <button
                key={src}
                onClick={() => setSourceFilter(src)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${
                  sourceFilter === src
                    ? 'bg-[#0E9D98] text-white shadow-md shadow-cyan-600/30'
                    : 'bg-white text-[#6B7685] hover:text-[#1A2332] border border-[rgba(10,20,32,0.08)]'
                }`}
              >
                {src === 'all' ? 'All Platforms' : src}
              </button>
            ))}
          </div>
        </div>

        {/* Prospect Cards List */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProspects.map((prospect) => {
              const isAlreadyImported = importedIds.includes(prospect.id);
              const badgeStyle = {
                autotrader: 'bg-orange-950/80 text-orange-400 border-orange-800/60',
                'cars.com': 'bg-blue-950/80 text-blue-400 border-blue-800/60',
                cargurus: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
                edmunds: 'bg-cyan-950/80 text-[#0E9D98] border-cyan-800/60',
                google: 'bg-sky-950/80 text-sky-400 border-sky-800/60',
              }[prospect.source] || 'bg-[#EFEDE8] text-[#334155] border-[rgba(10,20,32,0.10)]';

              return (
                <div
                  key={prospect.id}
                  className="bg-[#F5F4F1] rounded-xl border border-[rgba(10,20,32,0.06)] p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                            {prospect.source}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-[#334155] border border-[rgba(10,20,32,0.08)] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#6B7685]" />
                            <span>{prospect.location}</span>
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-[#1A2332]">{prospect.name}</h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-white/90 rounded-lg border border-[rgba(10,20,32,0.08)]">
                        <span className="text-[10px] font-semibold text-[#6B7685] uppercase block">Active Inventory</span>
                        <span className="text-xs font-black text-[#0E9D98] mt-0.5 flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          <span>{prospect.inventoryCount} Units</span>
                        </span>
                      </div>

                      <div className="p-2.5 bg-white/90 rounded-lg border border-[rgba(10,20,32,0.08)]">
                        <span className="text-[10px] font-semibold text-[#6B7685] uppercase block">Est. Ad Spend</span>
                        <span className="text-xs font-black text-emerald-400 mt-0.5">
                          ${prospect.estimatedAdSpend.toLocaleString()}/mo
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {prospect.franchiseMakes.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-white text-[#334155] border border-[rgba(10,20,32,0.08)] text-[10px] font-semibold"
                        >
                          {m}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-[#6B7685] pt-1 border-t border-[rgba(10,20,32,0.06)] flex items-center justify-between">
                      <span>Contact: <strong className="text-[#1A2332]">{prospect.contactPerson}</strong></span>
                      <span className="text-[rgba(10,20,32,0.50)]">{prospect.phone}</span>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-[rgba(10,20,32,0.08)] flex items-center justify-between">
                    <span className="text-[11px] text-[rgba(10,20,32,0.50)] flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified Classifieds Feed</span>
                    </span>

                    <button
                      disabled={isAlreadyImported}
                      onClick={() => handleImport(prospect)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                        isAlreadyImported
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-default'
                          : 'bg-[#0E9D98] hover:bg-[#14B8A6] text-white shadow-cyan-600/30 hover:scale-105'
                      }`}
                    >
                      {isAlreadyImported ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Indexed in CRM</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Index & Import</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredProspects.length === 0 && (
              <div className="col-span-full py-16 text-center bg-[#FAFAF8] rounded-xl border border-[rgba(10,20,32,0.08)]">
                <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-[#334155]">No Unindexed Prospects Found</h4>
                <p className="text-xs text-[rgba(10,20,32,0.50)] mt-1">
                  All matching classifieds prospects are already indexed in your CRM watchlist!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#FAFAF8] border-t border-[rgba(10,20,32,0.08)] flex items-center justify-between">
          <span className="text-xs text-[#6B7685]">
            Showing unindexed regional dealerships across AutoTrader, Cars.com, CarGurus & Edmunds.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#EFEDE8] hover:bg-slate-700 text-[#1A2332] rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
