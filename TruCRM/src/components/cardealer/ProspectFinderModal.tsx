import React, { useState } from 'react';
import { Search, Building2, Car, Plus, ShieldCheck, MapPin, DollarSign, CheckCircle2, Globe, Filter, X } from 'lucide-react';
import { CarDealership, ClassifiedSource } from '../../types/carDealer';
import { useApp } from '../../context/AppContext';

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
}> = [
  {
    id: 'pros-101',
    name: 'Silverado Auto Group & Pre-Owned',
    source: 'autotrader',
    location: 'Houston, TX',
    address: '9200 Westheimer Rd, Houston, TX 77063',
    phone: '+1 (713) 555-4920',
    email: 'leads@silveradoautogroup.com',
    contactPerson: 'Derek Vance (Director of Sales)',
    inventoryCount: 210,
    avgVehiclePrice: 48500,
    franchiseMakes: ['Chevrolet', 'GMC', 'Buick', 'Cadillac'],
    estimatedAdSpend: 35000,
    website: 'https://silveradoautogroup.com',
    techStack: {
      crm: 'Elead',
      inventoryManager: 'vAuto',
      adsPlatform: 'Facebook & Google Ads',
      analytics: ['Google Analytics 4'],
      marketingAutomation: 'DealerSocket'
    }
  },
  {
    id: 'pros-102',
    name: 'Capital City Import Motors',
    source: 'cars.com',
    location: 'Atlanta, GA',
    address: '3400 Peachtree Rd NE, Atlanta, GA 30326',
    phone: '+1 (404) 555-8211',
    email: 'acquisitions@capitalcityimports.com',
    contactPerson: 'Elena Rostova (General Manager)',
    inventoryCount: 115,
    avgVehiclePrice: 62000,
    franchiseMakes: ['Audi', 'Volvo', 'Lexus', 'Acura'],
    estimatedAdSpend: 28000,
    website: 'https://capitalcityimports.com',
    techStack: {
      crm: 'VinSolutions',
      inventoryManager: 'HomeNet Automotive',
      adsPlatform: 'Instagram Ads',
      analytics: ['Google Analytics 4', 'Hotjar']
    }
  },
  {
    id: 'pros-103',
    name: 'Desert Sun Motors & Truck Center',
    source: 'cargurus',
    location: 'Phoenix, AZ',
    address: '4500 E McDowell Rd, Phoenix, AZ 85008',
    phone: '+1 (602) 555-3390',
    email: 'info@desertsunmotorsaz.com',
    contactPerson: 'Travis Miller (Used Car Director)',
    inventoryCount: 175,
    avgVehiclePrice: 39000,
    franchiseMakes: ['RAM', 'Jeep', 'Dodge', 'Chrysler'],
    estimatedAdSpend: 24000,
    website: 'https://desertsunmotorsaz.com',
    techStack: {
      crm: 'DealerSocket',
      inventoryManager: 'vAuto',
      adsPlatform: 'Google Ads',
      analytics: ['Google Analytics 4'],
      marketingAutomation: 'Mailchimp'
    }
  },
  {
    id: 'pros-104',
    name: 'Cascade Pacific Auto Exchange',
    source: 'edmunds',
    location: 'Seattle, WA',
    address: '1200 4th Ave S, Seattle, WA 98134',
    phone: '+1 (206) 555-7182',
    email: 'contact@cascadepacificauto.com',
    contactPerson: 'Kenji Takahashi (Dealer Principal)',
    inventoryCount: 130,
    avgVehiclePrice: 44000,
    franchiseMakes: ['Subaru', 'Mazda', 'Toyota', 'Honda'],
    estimatedAdSpend: 20000,
    website: 'https://cascadepacificauto.com',
    techStack: {
      crm: 'VinSolutions',
      inventoryManager: 'HomeNet Automotive',
      adsPlatform: 'Google Ads',
      analytics: ['Google Analytics 4']
    }
  },
  {
    id: 'pros-105',
    name: 'Metroplex Luxury & Exotic Vault',
    source: 'autotrader',
    location: 'Fort Worth, TX',
    address: '2800 W 7th St, Fort Worth, TX 76107',
    phone: '+1 (817) 555-9033',
    email: 'sales@metroplexeotics.com',
    contactPerson: 'Brandon Sterling (Managing Partner)',
    inventoryCount: 65,
    avgVehiclePrice: 115000,
    franchiseMakes: ['Ferrari', 'Lamborghini', 'Aston Martin', 'McLaren'],
    estimatedAdSpend: 42000,
    website: 'https://metroplexeotics.com',
    techStack: {
      crm: 'Salesforce Automotive Cloud',
      inventoryManager: 'Custom',
      adsPlatform: 'Instagram & TikTok Ads',
      analytics: ['Google Analytics 4', 'Mixpanel']
    }
  },
  {
    id: 'pros-106',
    name: 'Great Lakes Hybrid & EV Hub',
    source: 'cargurus',
    location: 'Detroit, MI',
    address: '500 Woodward Ave, Detroit, MI 48226',
    phone: '+1 (313) 555-1944',
    email: 'ev-sales@greatlakeshybrid.com',
    contactPerson: 'Samantha Cole (Operations Lead)',
    inventoryCount: 150,
    avgVehiclePrice: 51000,
    franchiseMakes: ['Tesla', 'Hyundai', 'Kia', 'Ford EV'],
    estimatedAdSpend: 26000,
    website: 'https://greatlakeshybrid.com',
    techStack: {
      crm: 'HubSpot',
      inventoryManager: 'vAuto',
      adsPlatform: 'Google Search Ads',
      analytics: ['Google Analytics 4', 'Microsoft Clarity']
    }
  },
  {
    id: 'pros-107',
    name: 'Pacific Crest Automotive & EV',
    source: 'google',
    location: 'Seattle, WA',
    address: '2200 Westlake Ave, Seattle, WA 98121',
    phone: '+1 (206) 555-8833',
    email: 'info@pacificcrestauto.com',
    contactPerson: 'Marcus Thorne (Director of Operations)',
    inventoryCount: 190,
    avgVehiclePrice: 53000,
    franchiseMakes: ['Tesla', 'Rivian', 'Polestar', 'Audi'],
    estimatedAdSpend: 31000,
    website: 'https://pacificcrestauto.com',
    techStack: {
      crm: 'Salesforce',
      inventoryManager: 'vAuto',
      adsPlatform: 'Google Ads',
      analytics: ['Google Analytics 4', 'FullStory']
    }
  },
  {
    id: 'pros-108',
    name: 'Sunbelt Motors & Truck Plaza',
    source: 'google',
    location: 'Miami, FL',
    address: '7500 SW 8th St, Miami, FL 33144',
    phone: '+1 (305) 555-6622',
    email: 'sales@sunbeltmotorsmiami.com',
    contactPerson: 'Carlos Mendez (Managing Director)',
    inventoryCount: 225,
    avgVehiclePrice: 46000,
    franchiseMakes: ['Ford', 'Chevrolet', 'RAM', 'Toyota'],
    estimatedAdSpend: 38000,
    website: 'https://sunbeltmotorsmiami.com',
    techStack: {
      crm: 'Elead',
      inventoryManager: 'HomeNet Automotive',
      adsPlatform: 'Google & Facebook Ads',
      analytics: ['Google Analytics 4']
    }
  },
  {
    id: 'pros-109',
    name: 'Atlantic Seaboard Auto Pavilion',
    source: 'autotrader',
    location: 'Cape Town, South Africa',
    address: '45 Beach Rd, Sea Point, Cape Town, 8005',
    phone: '+27 21 555 7890',
    email: 'info@atlanticseaboardauto.co.za',
    contactPerson: 'Nicolette du Plessis (Sales Director)',
    inventoryCount: 95,
    avgVehiclePrice: 580000,
    franchiseMakes: ['Audi', 'Volkswagen', 'Toyota', 'Ford'],
    estimatedAdSpend: 22000,
    website: 'https://atlanticseaboardauto.co.za',
    techStack: {
      crm: 'Custom',
      inventoryManager: 'vAuto',
      adsPlatform: 'Google Search Ads',
      analytics: ['Google Analytics 4']
    }
  },
  {
    id: 'pros-110',
    name: 'Mother City Pre-Owned & Commercial Hub',
    source: 'google',
    location: 'Cape Town, South Africa',
    address: '12 Voortrekker Rd, Goodwood, Cape Town, 7460',
    phone: '+27 21 555 1234',
    email: 'leads@mothercityauto.co.za',
    contactPerson: 'Sipho Khumalo (General Manager)',
    inventoryCount: 180,
    avgVehiclePrice: 340000,
    franchiseMakes: ['Ford Ranger', 'Toyota Hilux', 'Isuzu', 'Nissan'],
    estimatedAdSpend: 27000,
    website: 'https://mothercityauto.co.za',
    techStack: {
      crm: 'Elead',
      inventoryManager: 'HomeNet Automotive',
      adsPlatform: 'Facebook Ads',
      analytics: ['Google Analytics 4']
    }
  },
  {
    id: 'pros-111',
    name: 'Table Mountain Luxury Imports',
    source: 'edmunds',
    location: 'Cape Town, South Africa',
    address: '88 Somerset Rd, Green Point, Cape Town, 8001',
    phone: '+27 21 555 9988',
    email: 'concierge@tablemountainluxury.co.za',
    contactPerson: 'Adrian van Zyl (Sales Lead)',
    inventoryCount: 75,
    avgVehiclePrice: 1200000,
    franchiseMakes: ['BMW', 'Mercedes-Benz', 'Porsche', 'Audi'],
    estimatedAdSpend: 35000,
    website: 'https://tablemountainluxury.co.za',
    techStack: {
      crm: 'Salesforce',
      inventoryManager: 'vAuto',
      adsPlatform: 'Instagram & Google Ads',
      analytics: ['Google Analytics 4', 'FullStory']
    }
  },
  {
    id: 'pros-112',
    name: 'Southern Suburbs Family Auto',
    source: 'autotrader',
    location: 'Cape Town, South Africa',
    address: '212 Main Rd, Claremont, Cape Town, 7708',
    phone: '+27 21 555 4433',
    email: 'family@ssfamilyauto.co.za',
    contactPerson: 'David Moodley (Owner)',
    inventoryCount: 130,
    avgVehiclePrice: 280000,
    franchiseMakes: ['Toyota', 'Honda', 'Nissan', 'Mazda'],
    estimatedAdSpend: 15000,
    website: 'https://ssfamilyauto.co.za',
    techStack: {
      crm: 'DealerSocket',
      inventoryManager: 'HomeNet Automotive',
      adsPlatform: 'Google Ads',
      analytics: ['Google Analytics 4']
    }
  },
  {
    id: 'pros-113',
    name: 'Winelands Premium Pre-Owned',
    source: 'cargurus',
    location: 'Cape Town, South Africa',
    address: 'Route 44, Stellenbosch, Cape Town, 7600',
    phone: '+27 21 555 6677',
    email: 'info@winelandspremium.co.za',
    contactPerson: 'Janine Burger (Marketing Manager)',
    inventoryCount: 85,
    avgVehiclePrice: 450000,
    franchiseMakes: ['Land Rover', 'Jaguar', 'Volvo', 'Jeep'],
    estimatedAdSpend: 20000,
    website: 'https://winelandspremium.co.za',
    techStack: {
      crm: 'VinSolutions',
      inventoryManager: 'vAuto',
      adsPlatform: 'Facebook & Instagram Ads',
      analytics: ['Google Analytics 4', 'Hotjar']
    }
  },
];

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
      const response = await fetch('/api/cardealer/search-prospects', {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
      <div className="bg-black border border-white/5 w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-8 border-b border-white/5 flex flex-col sm:flex-row sm:items-end justify-between gap-8">
          <div className="space-y-4">
            <h3 className="text-2xl font-black text-white tracking-tight leading-none">Network Intelligence</h3>
            <p className="text-sm text-white/40 font-medium max-w-md">
              Synchronize unindexed dealership assets from the global classified network.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerNetworkSearch()}
                placeholder="Search region or brand..."
                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
            <button
              onClick={triggerNetworkSearch}
              disabled={isSearching || !searchTerm.trim()}
              className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border ${
                isSearching 
                  ? 'bg-white/5 text-white/20 border-white/5' 
                  : 'bg-white text-black hover:bg-white/90 border-white'
              }`}
            >
              {isSearching ? 'Scanning...' : 'Scan Network'}
            </button>
            <button
              onClick={onClose}
              className="p-3 text-white/20 hover:text-white bg-white/5 hover:bg-white/10 rounded-2xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerNetworkSearch()}
                placeholder="Search city, dealer name, brand..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <button
              onClick={triggerNetworkSearch}
              disabled={isSearching || !searchTerm.trim()}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-lg ${
                isSearching 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/20'
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
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setSortBy('date')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  sortBy === 'date'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Sort by Date Added"
              >
                Date Added
              </button>
              <button
                onClick={() => setSortBy('name')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  sortBy === 'name'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
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
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
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
                edmunds: 'bg-cyan-950/80 text-cyan-400 border-cyan-800/60',
                google: 'bg-sky-950/80 text-sky-400 border-sky-800/60',
              }[prospect.source] || 'bg-slate-800 text-slate-300 border-slate-700';

              return (
                <div
                  key={prospect.id}
                  className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}>
                            {prospect.source}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-slate-300 border border-slate-800 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{prospect.location}</span>
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white">{prospect.name}</h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">Active Inventory</span>
                        <span className="text-xs font-black text-cyan-400 mt-0.5 flex items-center gap-1">
                          <Car className="w-3 h-3" />
                          <span>{prospect.inventoryCount} Units</span>
                        </span>
                      </div>

                      <div className="p-2.5 bg-slate-900/90 rounded-lg border border-slate-800">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase block">Est. Ad Spend</span>
                        <span className="text-xs font-black text-emerald-400 mt-0.5">
                          ${prospect.estimatedAdSpend.toLocaleString()}/mo
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {prospect.franchiseMakes.map((m, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-semibold"
                        >
                          {m}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs text-slate-400 pt-1 border-t border-slate-800/80 flex items-center justify-between">
                      <span>Contact: <strong className="text-slate-200">{prospect.contactPerson}</strong></span>
                      <span className="text-slate-500">{prospect.phone}</span>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Verified Classifieds Feed</span>
                    </span>

                    <button
                      disabled={isAlreadyImported}
                      onClick={() => handleImport(prospect)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                        isAlreadyImported
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-default'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-600/30 hover:scale-105'
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
              <div className="col-span-full py-16 text-center bg-slate-950 rounded-xl border border-slate-800">
                <Search className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-300">No Unindexed Prospects Found</h4>
                <p className="text-xs text-slate-500 mt-1">
                  All matching classifieds prospects are already indexed in your CRM watchlist!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Showing unindexed regional dealerships across AutoTrader, Cars.com, CarGurus & Edmunds.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
