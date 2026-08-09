import React, { useState } from 'react';
import {
  Car,
  Search,
  Building2,
  Phone,
  Mail,
  MessageCircle,
  ExternalLink,
  Plus,
  Filter,
  Star,
  DollarSign,
  TrendingUp,
  FileText,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Globe,
  MapPin,
  Download,
  Cpu,
  LayoutGrid,
  Columns,
  ChevronRight,
  GripVertical,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CarDealership, ClassifiedSource, DealershipStatus } from '../../types/carDealer';
import { initialCarDealerships } from '../../data/carDealerData';
import { useApp } from '../../context/AppContext';
import { CarDealerIntelModal } from './CarDealerIntelModal';
import { ProspectFinderModal } from './ProspectFinderModal';
import { WebsiteScraperModal } from './WebsiteScraperModal';
import { CarDealerHeatmap } from './CarDealerHeatmap';
import { CommunicationBar } from '../common/CommunicationBar';
import { CommunicationModal, CommunicationTarget } from '../common/CommunicationModal';

interface SortableDealerCardProps {
  dealer: CarDealership;
  onIntelOpen: (dealer: CarDealership) => void;
  onCommOpen: (target: any, type: any) => void;
  onUpdateStatus: (id: string, status: DealershipStatus) => void;
  isOverlay?: boolean;
}

const SortableDealerCard: React.FC<SortableDealerCardProps> = ({ 
  dealer, 
  onIntelOpen, 
  onCommOpen, 
  onUpdateStatus,
  isOverlay = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: dealer.id,
    data: {
      type: 'Dealer',
      dealer,
    },
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  };

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[140px] bg-slate-950/50 border-2 border-dashed border-slate-800 rounded-xl"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg hover:border-slate-700 transition-all cursor-default ${
        isOverlay ? 'shadow-2xl shadow-cyan-600/30 ring-2 ring-cyan-500' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="p-1 -ml-1 text-slate-700 hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <h4 className="text-xs font-bold text-white line-clamp-1">{dealer.name}</h4>
        </div>
        <button
          onClick={() => onIntelOpen(dealer)}
          className="p-1 text-slate-500 hover:text-cyan-400 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>
      
      <div className="flex items-center gap-2 mb-3 ml-4.5 pl-1">
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
          {dealer.inventoryCount} Units
        </span>
        <span className="text-[10px] font-bold text-emerald-400">
          R{(dealer.avgVehiclePrice / 1000).toFixed(0)}k avg
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-800/50 ml-4.5 pl-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onCommOpen({
              name: dealer.contactPerson,
              company: dealer.name,
              email: dealer.email,
              phone: dealer.phone
            }, 'call')}
            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onCommOpen({
              name: dealer.contactPerson,
              company: dealer.name,
              email: dealer.email,
              phone: dealer.phone
            }, 'email')}
            className="p-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 font-medium italic">
            Drag to move
          </span>
        </div>
      </div>
    </div>
  );
};

export const CarDealerSuite: React.FC = () => {
  const { profile, addNotification, addDeal } = useApp();

  const [dealerships, setDealerships] = useState<CarDealership[]>(initialCarDealerships);
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('grid');
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [activeSourceFilter, setActiveSourceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMakeFilter, setSelectedMakeFilter] = useState<string>('all');

  // Intel Modal State
  const [intelDealer, setIntelDealer] = useState<CarDealership | null>(null);
  const [isIntelOpen, setIsIntelOpen] = useState<boolean>(false);

  // Prospect Finder Modal State
  const [showProspectFinder, setShowProspectFinder] = useState<boolean>(false);
  const [showScraper, setShowScraper] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('date');

  // Communication Modal State (Call, Email, WhatsApp)
  const [commTarget, setCommTarget] = useState<CommunicationTarget | null>(null);
  const [commChannel, setCommChannel] = useState<'call' | 'email' | 'whatsapp'>('email');
  const [isCommOpen, setIsCommOpen] = useState<boolean>(false);

  // Add Dealership Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newSource, setNewSource] = useState<ClassifiedSource>('autotrader');
  const [newLocation, setNewLocation] = useState<string>('Gqeberha, EC');
  const [newPhone, setNewPhone] = useState<string>('+27 41 000 0000');
  const [newEmail, setNewEmail] = useState<string>('sales@rivaldealer.co.za');
  const [newContactPerson, setNewContactPerson] = useState<string>('Dealer contact');
  const [newInventory, setNewInventory] = useState<string>('80');
  const [newPrice, setNewPrice] = useState<string>('320000');
  const [newMakes, setNewMakes] = useState<string>('Toyota, VW, Ford');

  const openCommunication = (
    target: { name: string; company?: string; email: string; phone?: string; dealTitle?: string },
    channel: 'call' | 'email' | 'whatsapp'
  ) => {
    setCommTarget({
      name: target.name,
      company: target.company,
      email: target.email,
      phone: target.phone || '+1 (555) 234-8901',
      dealTitle: target.dealTitle,
    });
    setCommChannel(channel);
    setIsCommOpen(true);
  };

  const handleAddDealership = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const newDealer: CarDealership = {
      id: `cd-${Date.now()}`,
      name: newName,
      source: newSource,
      location: newLocation,
      address: `${newLocation} Auto Corridor`,
      phone: newPhone,
      email: newEmail,
      contactPerson: newContactPerson,
      inventoryCount: Number(newInventory) || 100,
      avgVehiclePrice: Number(newPrice) || 40000,
      rating: 4.7,
      reviewsCount: 150,
      website: `https://${newName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      franchiseMakes: newMakes.split(',').map((s) => s.trim()).filter(Boolean),
      status: 'identified',
      notes: `Discovered via ${newSource.toUpperCase()} classifieds search.`,
      intelReport: {
        digitalMaturity: 'High',
        estimatedMonthlyAdSpend: 22000,
        inventoryTurnoverDays: 30,
        topSellingModels: ['Crossover SUV', 'Full-Size Truck', 'Compact Sedan'],
        sentimentScore: 89,
        swotSummary: {
          strengths: ['Active classifieds syndication', 'Good local inventory selection'],
          weaknesses: ['Manual lead routing across desks'],
          opportunities: ['Automated AI lead qualification and pricing sync'],
          threats: ['Local franchise competition'],
        },
      },
    };

    setDealerships([newDealer, ...dealerships]);
    setShowAddModal(false);
    addNotification('Car Dealership Added', `Successfully indexed ${newName} from ${newSource.toUpperCase()}.`, 'success');

    // Reset form
    setNewName('');
  };

  const handleConvertToCrmDeal = (dealer: CarDealership) => {
    addDeal({
      title: `${dealer.name} - Inventory SaaS Partnership`,
      company: dealer.name,
      contactName: dealer.contactPerson,
      contactEmail: dealer.email,
      contactPhone: dealer.phone,
      value: dealer.inventoryCount * 350, // estimated deal size
      stage: 'lead',
      probability: 40,
      closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: `Imported from Car Dealer Classifieds Suite (${dealer.source.toUpperCase()}). ${dealer.inventoryCount} units.`,
      tags: ['Car Dealer', dealer.source, 'Classifieds'],
    });

    addNotification(
      'Deal Created in CRM',
      `Converted ${dealer.name} into an active CRM deal (R{(dealer.inventoryCount * 350).toLocaleString()}).`,
      'success'
    );
  };

  const handleUpdateDealerNote = (id: string, notes: string) => {
    setDealerships(
      dealerships.map((d) => (d.id === id ? { ...d, notes } : d))
    );
    addNotification('Note Saved', 'Quick comment updated successfully.', 'success');
  };
  
  const handleUpdateStatus = (id: string, status: DealershipStatus) => {
    setDealerships(
      dealerships.map((d) => (d.id === id ? { ...d, status } : d))
    );
    addNotification('Status Updated', `Dealership moved to ${status.replace('_', ' ')}.`, 'success');
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping into a column
    const columns = ['identified', 'contacted', 'meeting_scheduled', 'partnered'];
    if (columns.includes(overId)) {
      handleUpdateStatus(activeId, overId as DealershipStatus);
      return;
    }

    // Check if dropping onto another item
    const overItem = dealerships.find((d) => d.id === overId);
    if (overItem && activeId !== overId) {
      const activeItem = dealerships.find((d) => d.id === activeId);
      if (activeItem && activeItem.status !== overItem.status) {
        handleUpdateStatus(activeId, overItem.status);
      }
    }
  };

  const activeDealer = activeId ? dealerships.find((d) => d.id === activeId) : null;

  const handleDeleteDealer = (id: string) => {
    setDealerships(dealerships.filter((d) => d.id !== id));
    addNotification('Dealership Removed', 'Successfully removed dealership from watchlist.', 'info');
  };

  // Filter & Sort logic
  const filteredDealers = dealerships.filter((dealer) => {
    const matchesSource = activeSourceFilter === 'all' || dealer.source === activeSourceFilter;
    const matchesSearch =
      dealer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dealer.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dealer.franchiseMakes.some((m) => m.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesMake =
      selectedMakeFilter === 'all' ||
      dealer.franchiseMakes.some((m) => m.toLowerCase() === selectedMakeFilter.toLowerCase());
    return matchesSource && matchesSearch && matchesMake;
  }).sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      return b.id.localeCompare(a.id);
    }
  });

  const totalInventory = dealerships.reduce((acc, d) => acc + d.inventoryCount, 0);
  const totalAdSpend = dealerships.reduce((acc, d) => acc + (d.intelReport?.estimatedMonthlyAdSpend || 20000), 0);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-black p-6 rounded-2xl border border-zinc-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-zinc-900 text-cyan-400 border border-zinc-700 rounded-xl shadow-lg">
              <Car className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Competitor Classifieds — Market Intel
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Assess rival dealers in your area: who is advertising what, at what price, on which platform. Market
                analysis only — your own leads and deals live in TruCRM.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowScraper(true)}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold rounded-xl text-xs border border-zinc-700 flex items-center gap-2 shadow-md transition-all"
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>Scrape a website</span>
          </button>
          <button
            onClick={() => setShowProspectFinder(true)}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 font-bold rounded-xl text-xs border border-zinc-700 flex items-center gap-2 shadow-md transition-all"
          >
            <Search className="w-4 h-4 text-cyan-400" />
            <span>Find more competitors</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-white text-black hover:bg-zinc-200 font-bold rounded-xl text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4 text-cyan-600" />
            <span>Index New Dealership</span>
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-black rounded-xl border border-zinc-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Competitors tracked</span>
            <div className="text-2xl font-black text-white mt-1">{dealerships.length} Active</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-cyan-400 border border-zinc-700 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-cyan-400" />
          </div>
        </div>

        <div className="p-4 bg-black rounded-xl border border-zinc-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Their stock on sale</span>
            <div className="text-2xl font-black text-white mt-1">{totalInventory.toLocaleString()} Units</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-cyan-400 border border-zinc-700 flex items-center justify-center">
            <Car className="w-5 h-5 text-cyan-400" />
          </div>
        </div>

        <div className="p-4 bg-black rounded-xl border border-zinc-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Est. their ad spend</span>
            <div className="text-2xl font-black text-zinc-200 mt-1">R{totalAdSpend.toLocaleString()}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-zinc-900 text-cyan-400 border border-zinc-700 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-cyan-400" />
          </div>
        </div>

        <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Classified Sources</span>
            <div className="text-2xl font-black text-amber-400 mt-1">4 Platforms</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950 text-amber-400 border border-amber-800 flex items-center justify-center">
            <Globe className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* D3 Geographic Heatmap & Classifieds Concentration */}
      <CarDealerHeatmap dealerships={dealerships} />

      {/* Classified Platform Tabs & Search Filters */}
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          {/* Source Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Assets', count: dealerships.length },
              { id: 'autotrader', label: 'AutoTrader', count: dealerships.filter((d) => d.source === 'autotrader').length },
              { id: 'cars.com', label: 'Cars.co.za', count: dealerships.filter((d) => d.source === 'cars.com').length },
              { id: 'cargurus', label: 'Gumtree', count: dealerships.filter((d) => d.source === 'cargurus').length },
              { id: 'edmunds', label: 'Facebook', count: dealerships.filter((d) => d.source === 'edmunds').length },
              { id: 'google', label: 'Network', count: dealerships.filter((d) => d.source === 'google').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSourceFilter(tab.id)}
                className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all border ${
                  activeSourceFilter === tab.id
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-white/40 hover:text-white/60 border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input & Sort Toggle */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            {/* View Toggle */}
            <div className="flex items-center bg-white/5 border border-white/5 rounded-2xl p-1 w-full sm:w-auto">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-2 justify-center ${
                  viewMode === 'grid'
                    ? 'bg-white/10 text-white'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Grid</span>
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center gap-2 justify-center ${
                  viewMode === 'kanban'
                    ? 'bg-white/10 text-white'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Kanban</span>
              </button>
            </div>

            <div className="relative w-full sm:min-w-[300px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search network assets..."
                className="w-full bg-white/5 border border-white/5 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dealership Cards Grid / Kanban View */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div 
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredDealers.map((dealer) => (
              <div
                key={dealer.id}
                className="bg-[#0a0a0a] rounded-3xl border border-white/5 overflow-hidden flex flex-col transition-all hover:border-white/10"
              >
                {/* Card Header */}
                <div className="p-8 space-y-8">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{dealer.source}</span>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">{dealer.location}</span>
                      </div>
                      <h3 className="text-xl font-black text-white leading-tight tracking-tight">{dealer.name}</h3>
                    </div>
                    <button
                      onClick={() => handleDeleteDealer(dealer.id)}
                      className="p-2 text-white/10 hover:text-white/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.1em]">Inventory</span>
                      <div className="text-base font-medium text-white/80">{dealer.inventoryCount} units</div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.1em]">Avg Price</span>
                      <div className="text-base font-medium text-cyan-500/80">${(dealer.avgVehiclePrice / 1000).toFixed(0)}k</div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button 
                        onClick={() => { setIntelDealer(dealer); setIsIntelOpen(true); }}
                        className="text-[11px] font-black text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                      >
                        Briefing
                      </button>
                      <button 
                         onClick={() => handleConvertToCrmDeal(dealer)}
                         className="text-[11px] font-black text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                      >
                        Capture
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-3">
                       <button
                        onClick={() => openCommunication({
                          name: dealer.contactPerson,
                          company: dealer.name,
                          email: dealer.email,
                          phone: dealer.phone
                        }, 'call')}
                        className="p-2 bg-white/5 text-white/30 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openCommunication({
                          name: dealer.contactPerson,
                          company: dealer.name,
                          email: dealer.email,
                          phone: dealer.phone
                        }, 'email')}
                        className="p-2 bg-white/5 text-white/30 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {filteredDealers.length === 0 && (
              <div className="col-span-full py-24 text-center border border-dashed border-white/5 rounded-3xl">
                <p className="text-sm font-medium text-white/20 uppercase tracking-widest">No matching network assets</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="kanban"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-8 overflow-x-auto pb-8 -mx-6 px-6 lg:mx-0 lg:px-0 scrollbar-hide"
          >
            {[
              { id: 'identified', label: 'Identified' },
              { id: 'contacted', label: 'Contacted' },
              { id: 'meeting_scheduled', label: 'Briefed' },
              { id: 'partnered', label: 'Partnered' },
            ].map((column) => {
              const dealersInColumn = filteredDealers.filter(d => d.status === column.id);
              
              return (
                <div key={column.id} className="flex-shrink-0 w-80 flex flex-col gap-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                      <h3 className="text-[11px] font-black text-white/40 uppercase tracking-[0.2em]">{column.label}</h3>
                    </div>
                    <span className="text-[11px] font-medium text-white/20">
                      {dealersInColumn.length}
                    </span>
                  </div>

                  <SortableContext
                    id={column.id}
                    items={dealersInColumn.map(d => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div 
                      className="flex-1 space-y-4 min-h-[500px] p-2 bg-white/[0.02] rounded-3xl border border-white/5"
                    >
                      {dealersInColumn.map((dealer) => (
                        <SortableDealerCard
                          key={dealer.id}
                          dealer={dealer}
                          onIntelOpen={(d) => {
                            setIntelDealer(d);
                            setIsIntelOpen(true);
                          }}
                          onCommOpen={openCommunication}
                          onUpdateStatus={handleUpdateStatus}
                        />
                      ))}
                      {dealersInColumn.length === 0 && (
                        <div className="h-32 flex items-center justify-center border border-dashed border-white/5 rounded-2xl">
                          <span className="text-[10px] font-black text-white/10 uppercase tracking-widest italic">Empty</span>
                        </div>
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
          styles: {
            active: {
              opacity: '0.5',
            },
          },
        }),
      }}>
        {activeDealer ? (
          <SortableDealerCard
            dealer={activeDealer}
            onIntelOpen={() => {}}
            onCommOpen={() => {}}
            onUpdateStatus={() => {}}
            isOverlay
          />
        ) : null}
      </DragOverlay>

      {/* Add Dealership Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-black border border-white/5 w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-xl font-black text-white tracking-tight">Index Asset</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2.5 text-white/20 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDealership} className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Dealership Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Sunset Premier Motors"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Source</label>
                  <select
                    value={newSource}
                    onChange={(e) => setNewSource(e.target.value as ClassifiedSource)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-white/20 transition-all capitalize"
                  >
                    <option value="autotrader">AutoTrader</option>
                    <option value="cars.com">Cars.co.za</option>
                    <option value="cargurus">Gumtree</option>
                    <option value="edmunds">Facebook</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Location</label>
                  <input
                    type="text"
                    required
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Miami, FL"
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Contact</label>
                  <input
                    type="text"
                    required
                    value={newContactPerson}
                    onChange={(e) => setNewContactPerson(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-6">
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Phone</label>
                  <input
                    type="text"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Units</label>
                  <input
                    type="number"
                    required
                    value={newInventory}
                    onChange={(e) => setNewInventory(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Avg $</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] block mb-2">Brands</label>
                <input
                  type="text"
                  required
                  value={newMakes}
                  onChange={(e) => setNewMakes(e.target.value)}
                  placeholder="BMW, Mercedes-Benz, Audi"
                  className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/20 transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-8 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-3 text-[11px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-white text-black hover:bg-white/90 rounded-2xl text-[11px] font-bold transition-all"
                >
                  Capture Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Intel Modal */}
      <CarDealerIntelModal isOpen={isIntelOpen} onClose={() => setIsIntelOpen(false)} dealer={intelDealer} />

      {/* Prospect Finder Modal */}
      <ProspectFinderModal
        isOpen={showProspectFinder}
        onClose={() => setShowProspectFinder(false)}
        onImportDealer={(newDealer) => setDealerships([newDealer, ...dealerships])}
        existingDealerNames={dealerships.map((d) => d.name)}
      />

      {/* Website Scraper Modal */}
      <WebsiteScraperModal
        isOpen={showScraper}
        onClose={() => setShowScraper(false)}
        onImportDealer={(newDealer) => setDealerships([newDealer, ...dealerships])}
        existingDealerNames={dealerships.map((d) => d.name)}
      />

      {/* Global Communication Modal */}
      <CommunicationModal
        isOpen={isCommOpen}
        onClose={() => setIsCommOpen(false)}
        target={commTarget}
        defaultChannel={commChannel}
      />
      </div>
    </DndContext>
  );
};
