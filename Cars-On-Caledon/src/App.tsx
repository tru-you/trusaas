import React, { useState, useMemo } from 'react';
import { 
  Car, 
  Search, 
  ArrowRight, 
  Sparkles, 
  CheckCircle2, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  MessageCircle, 
  Award, 
  RotateCw, 
  Video, 
  TrendingUp, 
  Heart,
  ExternalLink
} from 'lucide-react';
import Navbar from './components/Navbar';
import FinanceCalculator from './components/FinanceCalculator';
import TradeInForm from './components/TradeInForm';
import VehicleModal from './components/VehicleModal';
import Footer from './components/Footer';
import { VEHICLES, TESTIMONIALS } from './data';
import { Vehicle, FilterState } from './types';

export default function App() {
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [activeTab, setActiveTab] = useState<string>(''); // For filtering vehicles by body-shape or 'perf'
  
  // Search state
  const [searchMake, setSearchMake] = useState<string>('');
  const [searchBody, setSearchBody] = useState<string>('');
  const [searchPrice, setSearchPrice] = useState<string>('');
  const [searchSort, setSearchSort] = useState<string>('featured');

  // Currency utility
  const formatZAR = (val: number) => {
    return 'R ' + val.toLocaleString('en-ZA');
  };

  const monthlyEst = (p: number) => {
    const deposit = p * 0.1;
    const fin = p - deposit;
    const r = (11.75 / 100) / 12;
    const n = 72;
    const est = (fin * r) / (1 - Math.pow(1 + r, -n));
    return isNaN(est) ? 0 : Math.round(est);
  };

  // Filter & Sort computation
  const filteredVehicles = useMemo(() => {
    let result = [...VEHICLES];

    // Filter by quick category tab
    if (activeTab === 'perf') {
      result = result.filter(v => v.perf);
    } else if (activeTab) {
      result = result.filter(v => v.body === activeTab);
    }

    // Filter by quick search fields
    if (searchMake) {
      result = result.filter(v => v.make === searchMake);
    }
    if (searchBody) {
      result = result.filter(v => v.body === searchBody);
    }
    if (searchPrice) {
      result = result.filter(v => v.price <= Number(searchPrice));
    }

    // Apply sorting
    if (searchSort === 'lo') {
      result.sort((a, b) => a.price - b.price);
    } else if (searchSort === 'hi') {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [activeTab, searchMake, searchBody, searchPrice, searchSort]);

  // Handler for quick search form submit
  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Scroll to the inventory section smoothly
    const invSec = document.getElementById('inventory');
    if (invSec) {
      invSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handler to filter when clicking body types tiles
  const handleBodyTileClick = (bodyType: string) => {
    setActiveTab(bodyType);
    const invSec = document.getElementById('inventory');
    if (invSec) {
      invSec.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="top" className="min-h-screen bg-paper text-ink relative">
      
      {/* Navigation */}
      <Navbar />

      {/* Hero Header */}
      <section className="relative min-h-[92vh] flex items-end justify-center text-white overflow-hidden bg-ink">
        {/* Background photo & overlay gradients */}
        <div 
          className="absolute inset-0 bg-cover bg-center mix-blend-luminosity opacity-40 scale-105"
          style={{ 
            backgroundImage: "linear-gradient(180deg, rgba(20,23,26,0.35) 0%, rgba(20,23,26,0.95) 90%), url('https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=2000&q=80')" 
          }}
        ></div>

        {/* Diagonal Light Beam Gradient overlay */}
        <div className="absolute inset-0 bg-radial-at-t from-zinc-800/20 via-transparent to-transparent pointer-events-none"></div>

        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 z-10">
          <div className="max-w-4xl space-y-6">
            <span className="inline-flex items-center gap-3 font-mono text-[11px] font-bold text-brand-brand-gold tracking-[0.32em] uppercase">
              <span className="w-6 h-px bg-brand-brand-gold"></span>
              Kariega · Gqeberha · Eastern Cape
            </span>

            <h1 className="font-disp font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.04]">
              Driven by quality.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-gray-500 italic font-normal">Priced with honesty.</span>
            </h1>

            <p className="text-gray-300 font-sans text-base sm:text-lg max-w-2xl leading-relaxed">
              The Eastern Cape's home of premium, hand-picked pre-owned vehicles. Every vehicle is thoroughly audited, certified with an official condition grade, and tailored with bank-integrated financing.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <a 
                href="#inventory" 
                className="inline-flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue-deep text-white font-bold text-sm px-8 py-4 rounded-full transition-all duration-300 shadow-lg shadow-brand-blue/20 hover:scale-[1.02]"
              >
                Browse Showroom Floor
                <ArrowRight className="w-4.5 h-4.5" />
              </a>
              <a 
                href="#sell" 
                className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white text-white font-bold text-sm px-8 py-4 rounded-full transition-colors"
              >
                Estimate My Trade-In
              </a>
            </div>
          </div>

          {/* Quick Search Widget */}
          <form 
            onSubmit={handleQuickSearch}
            className="mt-12 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-2.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 shadow-2xl"
          >
            <div className="bg-ink/50 border border-white/5 rounded-xl p-2.5 relative flex flex-col justify-center">
              <label className="font-mono text-[9px] tracking-wider text-gray-400 uppercase">Make</label>
              <select 
                value={searchMake}
                onChange={(e) => setSearchMake(e.target.value)}
                className="w-full bg-transparent border-0 text-white font-semibold text-sm outline-none cursor-pointer mt-0.5 appearance-none pr-6"
              >
                <option value="" className="text-ink">Any Brand</option>
                <option value="Volkswagen" className="text-ink">Volkswagen</option>
                <option value="Toyota" className="text-ink">Toyota</option>
                <option value="Ford" className="text-ink">Ford</option>
                <option value="BMW" className="text-ink">BMW</option>
                <option value="Mercedes-AMG" className="text-ink">Mercedes-AMG</option>
                <option value="Audi" className="text-ink">Audi</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">▼</span>
            </div>

            <div className="bg-ink/50 border border-white/5 rounded-xl p-2.5 relative flex flex-col justify-center">
              <label className="font-mono text-[9px] tracking-wider text-gray-400 uppercase">Body Shape</label>
              <select 
                value={searchBody}
                onChange={(e) => setSearchBody(e.target.value)}
                className="w-full bg-transparent border-0 text-white font-semibold text-sm outline-none cursor-pointer mt-0.5 appearance-none pr-6"
              >
                <option value="" className="text-ink">Any Shape</option>
                <option value="Hatchback" className="text-ink">Hatchback</option>
                <option value="SUV" className="text-ink">SUV</option>
                <option value="Bakkie" className="text-ink">Bakkie</option>
                <option value="Coupe" className="text-ink">Coupe</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">▼</span>
            </div>

            <div className="bg-ink/50 border border-white/5 rounded-xl p-2.5 relative flex flex-col justify-center">
              <label className="font-mono text-[9px] tracking-wider text-gray-400 uppercase">Budget Cap</label>
              <select 
                value={searchPrice}
                onChange={(e) => setSearchPrice(e.target.value)}
                className="w-full bg-transparent border-0 text-white font-semibold text-sm outline-none cursor-pointer mt-0.5 appearance-none pr-6"
              >
                <option value="" className="text-ink">No Limit</option>
                <option value="300000" className="text-ink">Under R300k</option>
                <option value="450000" className="text-ink">Under R450k</option>
                <option value="600000" className="text-ink">Under R600k</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">▼</span>
            </div>

            <div className="bg-ink/50 border border-white/5 rounded-xl p-2.5 relative flex flex-col justify-center">
              <label className="font-mono text-[9px] tracking-wider text-gray-400 uppercase">Sort By</label>
              <select 
                value={searchSort}
                onChange={(e) => setSearchSort(e.target.value)}
                className="w-full bg-transparent border-0 text-white font-semibold text-sm outline-none cursor-pointer mt-0.5 appearance-none pr-6"
              >
                <option value="featured" className="text-ink">Featured Stock</option>
                <option value="lo" className="text-ink">Price: Low to High</option>
                <option value="hi" className="text-ink">Price: High to Low</option>
              </select>
              <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-xs text-gray-400">▼</span>
            </div>

            <button 
              type="submit"
              className="bg-brand-blue hover:bg-brand-blue-deep text-white font-bold text-sm px-6 py-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              <Search className="w-4 h-4" />
              Apply Filter
            </button>
          </form>

          {/* Quick stats overlay */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/10 text-gray-400 font-sans text-xs">
            <div>
              <span className="block font-disp font-extrabold text-2xl sm:text-3xl text-white">40+</span>
              <span className="font-mono text-[9.5px] uppercase tracking-wider block mt-1">Verified Showroom Cars</span>
            </div>
            <div>
              <span className="block font-disp font-extrabold text-2xl sm:text-3xl text-white">100%</span>
              <span className="font-mono text-[9.5px] uppercase tracking-wider block mt-1">Inspection Graded</span>
            </div>
            <div>
              <span className="block font-disp font-extrabold text-2xl sm:text-3xl text-white">24h</span>
              <span className="font-mono text-[9.5px] uppercase tracking-wider block mt-1">Finance Approvals</span>
            </div>
            <div>
              <span className="block font-disp font-extrabold text-2xl sm:text-3xl text-white">R 0</span>
              <span className="font-mono text-[9.5px] uppercase tracking-wider block mt-1">Zero Fee Park &amp; Sell</span>
            </div>
          </div>
        </div>
      </section>

      {/* Ticker / Scrolling Ribbon */}
      <div className="bg-brand-blue text-white py-3.5 overflow-hidden border-y border-white/10 select-none pointer-events-none">
        <div className="flex gap-14 whitespace-nowrap animate-[marquee_45s_linear_infinite] w-max font-mono text-[11px] tracking-widest uppercase">
          <span>◆ TRADE-INS WELCOME</span>
          <span>◆ PARK &amp; SELL — ZERO COMMISSIONS</span>
          <span>◆ FINANCE FACILITATED VIA ALL MAJOR SOUTH AFRICAN BANKS</span>
          <span>◆ COMPREHENSIVE CONDITION INSPECTION REPORTS</span>
          <span>◆ NATIONWIDE DELIVERY CONVENIENTLY ARRANGED</span>
          <span>◆ OUTRIGHT PURCHASES OF QUALITY VEHICLES</span>
          <span>◆ TRADE-INS WELCOME</span>
          <span>◆ PARK &amp; SELL — ZERO COMMISSIONS</span>
          <span>◆ FINANCE FACILITATED VIA ALL MAJOR SOUTH AFRICAN BANKS</span>
        </div>
      </div>

      {/* Showroom Catalog Section */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="inventory">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-12">
          <div>
            <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-bold text-brand-blue tracking-widest uppercase">
              <span className="w-4 h-px bg-brand-blue"></span>
              Showroom Catalog
            </span>
            <h2 className="font-disp font-extrabold text-3xl sm:text-5xl text-ink tracking-tight mt-2.5">
              Inspected stock,<br />graded and prepared.
            </h2>
          </div>
          <p className="text-gray-500 text-sm sm:text-base max-w-md leading-relaxed lg:mb-2">
            Each vehicle includes a dynamic, downloadable paint-depth and diagnostic report. What you see online matches what you find on our showroom floor.
          </p>
        </div>

        {/* Filter categories pills */}
        <div className="flex flex-wrap items-center gap-2 mb-8 border-b border-line pb-4">
          <button 
            onClick={() => setActiveTab('')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === '' 
                ? 'bg-ink text-white shadow-md' 
                : 'bg-white border border-line text-gray-500 hover:border-gray-400'
            }`}
          >
            All Stock
          </button>
          <button 
            onClick={() => setActiveTab('Hatchback')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'Hatchback' 
                ? 'bg-ink text-white shadow-md' 
                : 'bg-white border border-line text-gray-500 hover:border-gray-400'
            }`}
          >
            Hatchbacks
          </button>
          <button 
            onClick={() => setActiveTab('SUV')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'SUV' 
                ? 'bg-ink text-white shadow-md' 
                : 'bg-white border border-line text-gray-500 hover:border-gray-400'
            }`}
          >
            SUVs
          </button>
          <button 
            onClick={() => setActiveTab('Bakkie')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'Bakkie' 
                ? 'bg-ink text-white shadow-md' 
                : 'bg-white border border-line text-gray-500 hover:border-gray-400'
            }`}
          >
            Bakkies
          </button>
          <button 
            onClick={() => setActiveTab('Coupe')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'Coupe' 
                ? 'bg-ink text-white shadow-md' 
                : 'bg-white border border-line text-gray-500 hover:border-gray-400'
            }`}
          >
            Coupes
          </button>
          <button 
            onClick={() => setActiveTab('perf')}
            className={`px-5 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'perf' 
                ? 'bg-ink text-white shadow-md' 
                : 'bg-white border border-line text-gray-500 hover:border-gray-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-brand-blue fill-brand-blue" />
            Performance Meta
          </button>
        </div>

        {/* Catalog Grid */}
        {filteredVehicles.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((car) => (
              <div 
                key={car.id}
                onClick={() => setSelectedVehicle(car)}
                className="bg-white border border-line rounded-2xl overflow-hidden cursor-pointer hover:shadow-2xl hover:border-transparent hover:-translate-y-1.5 transition-all duration-300 group"
              >
                {/* Photo space */}
                <div className="aspect-[16/10.4] bg-zinc-900 relative overflow-hidden">
                  <img 
                    src={car.img} 
                    alt={car.name}
                    className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"></div>
                  
                  {/* Badge tags */}
                  <span className={`absolute top-4 left-4 text-[9.5px] font-mono font-bold tracking-wider uppercase px-3 py-1 rounded-full text-white bg-ink/75 backdrop-blur-md`}>
                    {car.tag}
                  </span>

                  <span className="absolute bottom-4 right-4 bg-white/95 text-ink font-mono font-bold text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-full flex items-center gap-1 shadow">
                    <span className="w-1.5 h-1.5 rounded-full bg-wa"></span>
                    VIR™ GRADED
                  </span>
                </div>

                {/* Info block */}
                <div className="p-6">
                  <div className="font-mono text-[10px] tracking-widest text-gray-400 uppercase">
                    {car.yr} · {car.make}
                  </div>
                  <h3 className="font-disp font-extrabold text-xl text-ink tracking-tight mt-1.5 mb-1">
                    {car.name}
                  </h3>
                  <div className="text-gray-400 text-xs font-sans line-clamp-1">
                    {car.variant}
                  </div>

                  {/* Specs pill badges */}
                  <div className="flex flex-wrap gap-1.5 mt-4 mb-5">
                    <span className="bg-paper text-gray-600 font-mono text-[10px] px-2.5 py-1 rounded-md">
                      {car.km.toLocaleString('en-ZA')} km
                    </span>
                    <span className="bg-paper text-gray-600 font-mono text-[10px] px-2.5 py-1 rounded-md">
                      {car.tr}
                    </span>
                    <span className="bg-paper text-gray-600 font-mono text-[10px] px-2.5 py-1 rounded-md">
                      {car.fuel}
                    </span>
                    <span className="bg-paper text-gray-600 font-mono text-[10px] px-2.5 py-1 rounded-md">
                      {car.body}
                    </span>
                  </div>

                  {/* Pricing row footer */}
                  <div className="border-t border-line pt-4 flex justify-between items-end">
                    <div>
                      <div className="font-disp font-extrabold text-2xl text-ink tracking-tight">
                        {formatZAR(car.price)}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400 mt-0.5">
                        Est: from <strong className="text-brand-blue">{formatZAR(monthlyEst(car.price))}</strong>/pm
                      </div>
                    </div>
                    
                    {/* Action circle */}
                    <div className="w-10 h-10 rounded-full border border-line bg-white flex items-center justify-center text-ink group-hover:bg-brand-blue group-hover:border-brand-blue group-hover:text-white transition-all duration-300">
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-paper border border-line rounded-2xl p-8 text-center max-w-lg mx-auto">
            <Car className="w-12 h-12 text-brand-blue mx-auto mb-3" />
            <p className="font-mono text-xs tracking-wider text-gray-500 uppercase">
              No matching vehicles on floor
            </p>
            <p className="text-gray-400 text-xs mt-2 leading-relaxed">
              We update our catalog daily. Contact Lance directly on WhatsApp to specify your vehicle requirements; we source vehicles on demand!
            </p>
            <button 
              onClick={() => {
                setActiveTab('');
                setSearchMake('');
                setSearchBody('');
                setSearchPrice('');
              }}
              className="mt-4 text-xs font-bold text-brand-blue hover:underline"
            >
              Reset Search Parameters
            </button>
          </div>
        )}
      </section>

      {/* Body types grid segment */}
      <section className="py-12 bg-paper border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center sm:text-left">
            <span className="font-mono text-[10px] tracking-widest text-brand-blue uppercase font-semibold">
              Browse categories
            </span>
            <h2 className="font-disp font-extrabold text-2xl sm:text-4xl tracking-tight mt-1">
              Select your vehicle footprint.
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div 
              onClick={() => handleBodyTileClick('Hatchback')}
              className="bg-white border border-line hover:border-ink rounded-2xl p-6 text-center cursor-pointer transition-all hover:-translate-y-1"
            >
              <div className="h-10 w-fit mx-auto flex items-center justify-center text-brand-blue mb-2">
                <span className="font-disp font-black text-2xl italic">HB</span>
              </div>
              <span className="font-bold text-sm block text-ink">Hatchbacks</span>
              <span className="font-mono text-[10px] text-gray-400 mt-1 block">12 in stock</span>
            </div>

            <div 
              onClick={() => handleBodyTileClick('SUV')}
              className="bg-white border border-line hover:border-ink rounded-2xl p-6 text-center cursor-pointer transition-all hover:-translate-y-1"
            >
              <div className="h-10 w-fit mx-auto flex items-center justify-center text-brand-blue mb-2">
                <span className="font-disp font-black text-2xl italic">SUV</span>
              </div>
              <span className="font-bold text-sm block text-ink">SUVs</span>
              <span className="font-mono text-[10px] text-gray-400 mt-1 block">9 in stock</span>
            </div>

            <div 
              onClick={() => handleBodyTileClick('Bakkie')}
              className="bg-white border border-line hover:border-ink rounded-2xl p-6 text-center cursor-pointer transition-all hover:-translate-y-1"
            >
              <div className="h-10 w-fit mx-auto flex items-center justify-center text-brand-blue mb-2">
                <span className="font-disp font-black text-2xl italic">BK</span>
              </div>
              <span className="font-bold text-sm block text-ink">Bakkies</span>
              <span className="font-mono text-[10px] text-gray-400 mt-1 block">8 in stock</span>
            </div>

            <div 
              onClick={() => handleBodyTileClick('Coupe')}
              className="bg-white border border-line hover:border-ink rounded-2xl p-6 text-center cursor-pointer transition-all hover:-translate-y-1"
            >
              <div className="h-10 w-fit mx-auto flex items-center justify-center text-brand-blue mb-2">
                <span className="font-disp font-black text-2xl italic">CP</span>
              </div>
              <span className="font-bold text-sm block text-ink">Coupes</span>
              <span className="font-mono text-[10px] text-gray-400 mt-1 block">4 in stock</span>
            </div>

            <div 
              onClick={() => handleBodyTileClick('')}
              className="bg-white border border-line hover:border-ink rounded-2xl p-6 text-center cursor-pointer transition-all hover:-translate-y-1 col-span-2 sm:col-span-1"
            >
              <div className="h-10 w-fit mx-auto flex items-center justify-center text-brand-blue mb-2">
                <span className="font-disp font-black text-2xl italic">ALL</span>
              </div>
              <span className="font-bold text-sm block text-ink">All Vehicles</span>
              <span className="font-mono text-[10px] text-gray-400 mt-1 block">40+ stock</span>
            </div>
          </div>
        </div>
      </section>

      {/* Finance Calculator & Details Section */}
      <section className="bg-ink dark py-24 text-white relative overflow-hidden" id="finance">
        {/* Decorative subtle light aura */}
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-brand-blue/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            
            {/* Info details column */}
            <div className="space-y-6">
              <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-bold text-brand-blue tracking-widest uppercase">
                <span className="w-4 h-px bg-brand-blue"></span>
                Vehicle Asset Financing
              </span>
              <h2 className="font-disp font-extrabold text-3xl sm:text-5xl tracking-tight leading-tight">
                Financing shaped<br />around your life.
              </h2>
              <p className="text-gray-400 leading-relaxed text-sm sm:text-base">
                We motivate and represent every financial submission personally to the country's major banking providers simultaneously, securing the absolute best linked interest rate match for your score.
              </p>

              {/* Steps/Features of finance */}
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex gap-4 items-start">
                  <div className="font-mono text-xs text-brand-blue font-bold pt-1">01</div>
                  <div>
                    <h4 className="font-disp font-semibold text-base text-white">Pre-qualify in under 5 minutes</h4>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mt-0.5">Know exactly what you qualify for before allocating on-site test viewings. Minimal paperwork to start.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start border-t border-white/5 pt-4">
                  <div className="font-mono text-xs text-brand-blue font-bold pt-1">02</div>
                  <div>
                    <h4 className="font-disp font-semibold text-base text-white">All major banks, single application</h4>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mt-0.5">We submit to WesBank, MFC / Nedbank, Absa, Standard Bank, and Capitec on your behalf.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start border-t border-white/5 pt-4">
                  <div className="font-mono text-xs text-brand-blue font-bold pt-1">03</div>
                  <div>
                    <h4 className="font-disp font-semibold text-base text-white">Bespoke customized configurations</h4>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed mt-0.5">Adjust deposits, select terms, or choose structured options that accommodate your cash-flow.</p>
                  </div>
                </div>
              </div>

              {/* Supported bank badges */}
              <div className="flex flex-wrap gap-2 pt-6">
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 border border-white/10 px-3.5 py-1.5 rounded-full bg-white/5">WesBank</span>
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 border border-white/10 px-3.5 py-1.5 rounded-full bg-white/5">MFC / Nedbank</span>
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 border border-white/10 px-3.5 py-1.5 rounded-full bg-white/5">Absa Bank</span>
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 border border-white/10 px-3.5 py-1.5 rounded-full bg-white/5">Standard Bank</span>
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 border border-white/10 px-3.5 py-1.5 rounded-full bg-white/5">Capitec</span>
              </div>
            </div>

            {/* Interactive Calculator column */}
            <div>
              <FinanceCalculator />
            </div>

          </div>
        </div>
      </section>

      {/* Trade-In Digital Appraiser & Sell Segment */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="sell">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Visual element on left/right */}
          <div className="lg:col-span-5 relative order-last lg:order-first">
            <div className="aspect-[4/5] rounded-3xl overflow-hidden relative shadow-2xl bg-zinc-900 border border-line">
              <img 
                src="https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80" 
                alt="Detail inspection visual"
                className="w-full h-full object-cover brightness-[0.82]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
              
              {/* Overlay card */}
              <div className="absolute top-6 left-6 bg-white rounded-xl p-4 shadow-lg max-w-xs border border-line">
                <span className="font-mono text-[9px] tracking-wider text-gray-500 uppercase block">Valuation turnaround</span>
                <span className="font-disp font-extrabold text-lg text-ink block mt-0.5">Under 24 hours</span>
              </div>

              {/* Overlay quote */}
              <div className="absolute bottom-6 left-6 right-6 text-white space-y-2">
                <p className="font-disp font-bold text-lg leading-snug">
                  "Lance sold my Polo in nine days — I didn't have to deal with annoying phone calls or scammers once."
                </p>
                <span className="font-mono text-[10px] tracking-widest text-brand-blue block uppercase font-bold">
                  — Park &amp; Sell Client, Kariega
                </span>
              </div>
            </div>
          </div>

          {/* Details & Interactive submission card */}
          <div className="lg:col-span-7 space-y-6">
            <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-bold text-brand-blue tracking-widest uppercase">
              <span className="w-4 h-px bg-brand-blue"></span>
              Sell / Outright Purchase / Trade-In
            </span>
            <h2 className="font-disp font-extrabold text-3xl sm:text-5xl text-ink tracking-tight mt-1">
              Your car, sold properly.<br />Zero commission.
            </h2>
            <p className="text-gray-500 leading-relaxed text-sm sm:text-base">
              Ready for an upgrade? Outright cash purchase, simple trade-in options, or zero-fee commission-free representation in our <strong>Park &amp; Sell</strong> service — we market your car across all major SA online platforms for you.
            </p>

            {/* Steps overview */}
            <div className="space-y-4 py-4">
              <div className="flex gap-4 items-start">
                <div className="font-disp font-black text-2xl text-brand-blue line-height-none">1</div>
                <div>
                  <h4 className="font-semibold text-sm sm:text-base text-ink">Enter your vehicle profile</h4>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Use our digital appraisal estimator to retrieve an instant regional wholesale trade range.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start border-t border-line pt-4">
                <div className="font-disp font-black text-2xl text-brand-blue line-height-none">2</div>
                <div>
                  <h4 className="font-semibold text-sm sm:text-base text-ink">Schedule on-floor verification</h4>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Bring the car in for a 20-minute physical appraisal, electronic diagnosis scan, and paint test.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start border-t border-line pt-4">
                <div className="font-disp font-black text-2xl text-brand-blue line-height-none">3</div>
                <div>
                  <h4 className="font-semibold text-sm sm:text-base text-ink">Select transaction model</h4>
                  <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Choose an instant outright bank payout, a high-value trade credit, or commission-free floor space.</p>
                </div>
              </div>
            </div>

            {/* Interactive Form Component */}
            <div className="pt-2">
              <TradeInForm />
            </div>
          </div>

        </div>
      </section>

      {/* Why Us section: VIR Details, Virtual Tours */}
      <section className="bg-ink dark py-24 text-white relative overflow-hidden" id="why">
        {/* Watermark brand text behind */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-white/[0.02] font-disp font-black text-[120px] sm:text-[220px] tracking-tighter select-none pointer-events-none">
          CALEDON
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto space-y-4">
            <span className="inline-flex items-center gap-2 font-mono text-[10.5px] font-bold text-brand-blue tracking-widest uppercase justify-center">
              <span className="w-4 h-px bg-brand-blue"></span>
              Why Cars On Caledon
            </span>
            <h2 className="font-disp font-extrabold text-3xl sm:text-5xl tracking-tight text-white leading-tight">
              See everything. Before<br />you drive anywhere.
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm max-w-lg mx-auto">
              We provide deep transparency standards so you can inspect and audit details from the comfort of your home.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="bg-ink-2 border border-white/10 rounded-2xl p-8 hover:border-brand-brand-gold/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-brand-blue/10 border border-brand-brand-gold/20 flex items-center justify-center text-brand-blue mb-6">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="font-disp font-bold text-lg text-white mb-2">
                VIR™ Graded Condition Audits
              </h3>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                We perform an intensive diagnostic run, paint-depth check, and undercarriage check on every car. Download full report logs as transparent PDFs.
              </p>
              <span className="font-mono text-[9px] tracking-wider uppercase text-brand-gold block mt-6 font-semibold">
                ★ CERTIFIED AUDIT TRAIL
              </span>
            </div>

            <div className="bg-ink-2 border border-white/10 rounded-2xl p-8 hover:border-brand-blue/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue mb-6">
                <RotateCw className="w-6 h-6" />
              </div>
              <h3 className="font-disp font-bold text-lg text-white mb-2">
                Interactive 360° Walkarounds
              </h3>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                Click any catalog vehicle to launch our 360-degree spin simulator. Spin and check exact paint profiles, panel seams, and interior details.
              </p>
              <span className="font-mono text-[9px] tracking-wider uppercase text-brand-gold block mt-6 font-semibold">
                ★ COMPLETE DIGITAL DISCLOSURE
              </span>
            </div>

            <div className="bg-ink-2 border border-white/10 rounded-2xl p-8 hover:border-brand-blue/50 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue mb-6">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-disp font-bold text-lg text-white mb-2">
                Live Interactive Video Calls
              </h3>
              <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                Can't make it to our physical location on Caledon Street? Book a video tour; we'll perform a cold start, engine check, and show every dial live.
              </p>
              <span className="font-mono text-[9px] tracking-wider uppercase text-brand-gold block mt-6 font-semibold">
                ★ BOOK VIA WHATSAPP IN 30 SECONDS
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Segment */}
      <section className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12">
          <span className="font-mono text-[10.5px] font-bold text-brand-blue tracking-widest uppercase block">
            Word on the street
          </span>
          <h2 className="font-disp font-extrabold text-3xl sm:text-5xl text-ink tracking-tight mt-2">
            Uitenhage &amp; Kariega trust Caledon.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((testi) => (
            <div 
              key={testi.id}
              className="bg-white border border-line rounded-2xl p-6 sm:p-8 space-y-4 hover:shadow-xl transition-shadow"
            >
              <div className="text-brand-gold font-bold tracking-widest text-sm">
                {'★'.repeat(testi.stars)}
              </div>
              <p className="text-gray-600 text-xs sm:text-sm leading-relaxed italic">
                "{testi.quote}"
              </p>
              <div className="flex items-center gap-3 pt-2">
                <div className="w-10 h-10 rounded-full bg-ink text-white font-disp font-extrabold text-xs flex items-center justify-center uppercase shrink-0">
                  {testi.initials}
                </div>
                <div>
                  <span className="block font-bold text-sm text-ink">{testi.author}</span>
                  <span className="block text-[10px] text-gray-400 font-mono tracking-wide mt-0.5">{testi.vehicleModel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Come Say Hello Location & Hours */}
      <section className="py-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" id="visit">
        <div className="bg-ink text-white rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-2xl">
          
          {/* Left information column */}
          <div className="p-8 sm:p-12 lg:col-span-7 space-y-6">
            <span className="font-mono text-[10px] tracking-widest text-brand-blue uppercase font-bold">
              COME SAY HELLO
            </span>
            <h2 className="font-disp font-extrabold text-3xl sm:text-4xl tracking-tight text-white leading-tight">
              The showroom floor is open.<br />
              <span className="text-brand-blue">The coffee is always fresh.</span>
            </h2>
            <p className="text-gray-400 text-sm max-w-lg leading-relaxed">
              We are conveniently located in the center of Caledon Street, Kariega (Uitenhage) — exactly ten minutes off the N2 highway. Drop by for a viewing, a fair on-site vehicle trade evaluation, or just a chat about cars.
            </p>

            <div className="space-y-3.5 pt-4 border-t border-white/10 text-xs sm:text-sm font-sans text-gray-300">
              <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-2.5">
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 mt-1">Showroom Address</span>
                <span className="text-right font-medium text-white text-xs sm:text-sm">257 Caledon Street, Kariega (Uitenhage), 6229</span>
              </div>
              <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-2.5">
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 mt-1">Direct Phone</span>
                <a href="tel:+27618759389" className="text-right font-mono text-brand-blue hover:underline text-xs sm:text-sm">+27 61 875 9389</a>
              </div>
              <div className="flex justify-between items-start gap-4 border-b border-white/5 pb-2.5">
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 mt-1">Direct Email</span>
                <a href="mailto:lance@carsoncaledon.co.za" className="text-right hover:underline text-xs sm:text-sm">lance@carsoncaledon.co.za</a>
              </div>
              <div className="flex justify-between items-start gap-4 pb-1">
                <span className="font-mono text-[10px] tracking-wider uppercase text-gray-400 mt-1">Trading Hours</span>
                <span className="text-right text-xs sm:text-sm">Mon–Fri: 08:00–17:30 · Saturday: 08:00–13:00</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <a 
                href="https://maps.google.com/?q=257+Caledon+Street+Kariega+6229" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-brand-blue hover:bg-brand-blue-deep text-white font-bold text-xs px-6 py-3.5 rounded-full inline-flex items-center gap-1.5 shadow"
              >
                <MapPin className="w-4 h-4" />
                Navigate to Showroom
              </a>
              <a 
                href="https://wa.me/27618759389" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-white/5 hover:bg-white/10 border border-white/20 hover:border-white text-white font-bold text-xs px-6 py-3.5 rounded-full inline-flex items-center gap-1.5"
              >
                Book a Physical Viewing
              </a>
            </div>
          </div>

          {/* Right simulated map column */}
          <div className="lg:col-span-5 min-h-[340px] bg-zinc-900 relative">
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-70"
              style={{ backgroundImage: "linear-gradient(135deg, rgba(20,23,26,0.3) 0%, rgba(20,23,26,0.7) 100%), url('https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1200&q=80')" }}
            ></div>
            
            {/* Animated Pin */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="relative">
                <div className="w-5 h-5 bg-brand-blue rounded-full mx-auto relative z-10 shadow-lg shadow-brand-blue/50"></div>
                <div className="absolute top-0 left-0 w-5 h-5 bg-brand-blue rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="inline-block mt-3 bg-ink/90 border border-white/10 backdrop-blur-md text-[10px] font-mono font-bold tracking-widest text-white uppercase px-3.5 py-1.5 rounded-full whitespace-nowrap shadow-xl">
                257 Caledon St · Kariega
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* Footer component */}
      <Footer />

      {/* Floating Sticky Actions */}
      <a 
        href="https://wa.me/27618759389" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-wa text-white flex items-center justify-center shadow-2xl hover:scale-110 transition-transform duration-300 animate-bounce group"
        aria-label="Connect on WhatsApp"
      >
        <MessageCircle className="w-7 h-7 fill-white" />
        <span className="absolute -top-1 -right-1 bg-brand-blue w-3.5 h-3.5 rounded-full border border-white"></span>
      </a>

      {/* Bottom Mockup note notification ribbon */}
      <div className="fixed bottom-6 left-6 z-40 bg-ink/90 border border-white/10 backdrop-blur-md rounded-full px-4 py-2 font-mono text-[9px] text-gray-400 tracking-wider uppercase flex items-center gap-1.5 shadow-xl select-none">
        <span className="w-2 h-2 bg-brand-blue rounded-full"></span>
        Interactive Design Mockup
      </div>

      {/* Modal detail render */}
      {selectedVehicle && (
        <VehicleModal 
          vehicle={selectedVehicle} 
          onClose={() => setSelectedVehicle(null)} 
        />
      )}

    </div>
  );
}
