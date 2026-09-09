import React, { useState } from 'react';
import { X, Check, Camera, RotateCw, ShieldAlert, Sparkles, MessageSquare, DollarSign, Eye, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { Vehicle } from '../types';

interface VehicleModalProps {
  vehicle: Vehicle;
  onClose: () => void;
}

export default function VehicleModal({ vehicle, onClose }: VehicleModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'vir' | 'spin'>('overview');
  const [activeImage, setActiveImage] = useState(vehicle.img);
  const [spinIndex, setSpinIndex] = useState(0);

  // ZAR Currency formatting helper
  const formatZAR = (val: number) => {
    return 'R ' + val.toLocaleString('en-ZA');
  };

  // Pre-filled WhatsApp message
  const getWhatsAppLink = (type: 'enquiry' | 'video') => {
    const carName = `${vehicle.yr} ${vehicle.make} ${vehicle.name}`;
    let text = '';
    if (type === 'enquiry') {
      text = `Hi Lance, I am interested in the ${carName} (${formatZAR(vehicle.price)}) listed on your website. Is it still available for viewing?`;
    } else {
      text = `Hi Lance, I would like to book a Live Video Walkaround of the ${carName} (${formatZAR(vehicle.price)}). When is the best time for a video call?`;
    }
    return `https://wa.me/27618759389?text=${encodeURIComponent(text)}`;
  };

  // Simple dynamic monthly repayment formula for the embedded widget
  const getMonthlyEst = () => {
    const deposit = vehicle.price * 0.1;
    const fin = vehicle.price - deposit;
    const r = (11.75 / 100) / 12;
    const n = 72;
    const est = (fin * r) / (1 - Math.pow(1 + r, -n));
    return isNaN(est) ? 0 : Math.round(est);
  };

  // Simulated 360 images (we shift perspective or tint/zoom the gallery assets dynamically based on drag/slider)
  const spinImages = [
    vehicle.img,
    vehicle.gallery[1] || vehicle.img,
    vehicle.gallery[2] || vehicle.img,
    vehicle.gallery[1] || vehicle.img,
    vehicle.img
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
      {/* Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header bar */}
        <div className="bg-ink text-white px-6 py-4 flex justify-between items-center border-b border-white/5 shrink-0">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-brand-brand-gold uppercase font-semibold">
              VIR Certified Stock
            </span>
            <h2 className="font-disp font-extrabold text-lg sm:text-2xl tracking-tight mt-0.5">
              {vehicle.yr} {vehicle.make} {vehicle.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Visual Media Gallery */}
          <div className="lg:col-span-7 bg-paper p-4 sm:p-6 border-r border-line space-y-4">
            {/* Tab Selection for Media */}
            <div className="flex gap-2 border-b border-line pb-3">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'overview'
                    ? 'bg-ink text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                Photos ({vehicle.gallery.length})
              </button>
              <button
                onClick={() => setActiveTab('spin')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'spin'
                    ? 'bg-ink text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                360° Walkaround
              </button>
              <button
                onClick={() => setActiveTab('vir')}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'vir'
                    ? 'bg-ink text-white'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                VIR™ Report
              </button>
            </div>

            {/* Tab Content 1: Main Photo View */}
            {activeTab === 'overview' && (
              <div className="space-y-3">
                <div className="aspect-video bg-ink rounded-2xl overflow-hidden relative group">
                  <img
                    src={activeImage}
                    alt={vehicle.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute top-4 left-4 bg-ink/75 backdrop-blur-md text-white font-mono text-[9px] tracking-wider uppercase px-2.5 py-1 rounded-full">
                    Condition: {vehicle.grade}
                  </span>
                </div>
                {/* Thumbnails */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {vehicle.gallery.map((imgUrl, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(imgUrl)}
                      className={`w-20 sm:w-24 aspect-[16/10] rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                        activeImage === imgUrl ? 'border-brand-brand-gold scale-95' : 'border-transparent opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={imgUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tab Content 2: 360 Simulated Spin */}
            {activeTab === 'spin' && (
              <div className="space-y-4 text-center">
                <div className="aspect-video bg-ink rounded-2xl overflow-hidden relative flex items-center justify-center">
                  <img
                    src={spinImages[spinIndex]}
                    alt="360 rotation view"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {/* Overlay indicators */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-ink/75 backdrop-blur-md text-white font-mono text-[9.5px] tracking-wider px-3 py-1.5 rounded-full">
                    <RotateCw className="w-3.5 h-3.5 animate-spin-slow text-brand-blue" />
                    <span>DRAG SLIDER TO ROTATE VEHICLE</span>
                  </div>
                </div>

                <div className="px-6">
                  <input
                    type="range"
                    min={0}
                    max={4}
                    step={1}
                    value={spinIndex}
                    onChange={(e) => setSpinIndex(Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-gray-400 mt-2">
                    <span>FRONT ANGLE</span>
                    <span>SIDE PROFILE</span>
                    <span>REAR ANGLE</span>
                    <span>INTERIOR PROFILE</span>
                    <span>FULL SHIELD</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 3: Detailed VIR Condition Check */}
            {activeTab === 'vir' && (
              <div className="space-y-4">
                <div className="bg-ink-2 text-white p-5 rounded-2xl flex justify-between items-center">
                  <div>
                    <span className="font-mono text-[9px] tracking-wider text-gray-400 uppercase">VIR™ Audit Score</span>
                    <div className="font-disp font-black text-3xl text-emerald-400 mt-0.5 flex items-baseline gap-1">
                      {vehicle.grade}
                      <span className="text-xs font-normal text-gray-400 font-sans">/ Certified A+ Match</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono block text-brand-blue uppercase font-semibold">Diagnostic Run</span>
                    <span className="text-xs text-gray-300">Passed (No Errors)</span>
                  </div>
                </div>

                {/* Checklist parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-white border border-line rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-semibold text-gray-700">OBD-II Electronics Diagnostics</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">CLEAR</span>
                  </div>
                  <div className="p-3 bg-white border border-line rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-semibold text-gray-700">Paint Depth Thickness Scan</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">FACTORY</span>
                  </div>
                  <div className="p-3 bg-white border border-line rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-semibold text-gray-700">Engine Oil &amp; Coolant Seals</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">100% PASS</span>
                  </div>
                  <div className="p-3 bg-white border border-line rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-semibold text-gray-700">Gearbox Clutch Engagement</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">OPTIMAL</span>
                  </div>
                  <div className="p-3 bg-white border border-line rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-semibold text-gray-700">Braking Discs &amp; Calipers</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">90% NEW</span>
                  </div>
                  <div className="p-3 bg-white border border-line rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span className="text-xs font-semibold text-gray-700">Tyre Tread Depth Audit</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">PASS</span>
                  </div>
                </div>

                <p className="text-[10.5px] text-gray-400 font-mono text-center leading-normal">
                  VIR™ (Vehicle Inspection Report) is a bank-audited condition standard utilized to guarantee clean trade history, non-collision origin status, and structural safety benchmarks. Download complete certification on request.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Spec Sheet & Enquiries */}
          <div className="lg:col-span-5 p-6 space-y-6 flex flex-col justify-between h-full bg-white">
            <div className="space-y-5">
              {/* Price Row */}
              <div className="border-b border-line pb-4 flex justify-between items-baseline">
                <div>
                  <span className="text-xs text-gray-500 font-mono tracking-wide">Dealership Price</span>
                  <div className="font-disp font-black text-3xl sm:text-4xl text-ink mt-0.5 tracking-tight">
                    {formatZAR(vehicle.price)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 font-mono tracking-wide block">Est. Repayments</span>
                  <span className="text-sm font-bold text-brand-blue block mt-1">
                    from {formatZAR(getMonthlyEst())}/pm
                  </span>
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="space-y-3">
                <h4 className="font-mono text-xs tracking-widest text-gray-400 uppercase font-bold">
                  Technical Overview
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:text-sm border border-line rounded-2xl p-4 bg-paper">
                  <div>
                    <span className="text-gray-400 text-xs block">Mileage</span>
                    <span className="font-bold text-ink">{vehicle.km.toLocaleString('en-ZA')} km</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Gearbox</span>
                    <span className="font-bold text-ink">{vehicle.tr}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Fuel Type</span>
                    <span className="font-bold text-ink">{vehicle.fuel}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs block">Body Shape</span>
                    <span className="font-bold text-ink">{vehicle.body}</span>
                  </div>
                  <div className="col-span-2 border-t border-line/50 pt-2">
                    <span className="text-gray-400 text-xs block">Engine Block</span>
                    <span className="font-semibold text-ink text-xs">{vehicle.engine}</span>
                  </div>
                  <div className="col-span-2 border-t border-line/50 pt-2">
                    <span className="text-gray-400 text-xs block">Power Output</span>
                    <span className="font-semibold text-ink text-xs">{vehicle.power}</span>
                  </div>
                  <div className="border-t border-line/50 pt-2">
                    <span className="text-gray-400 text-xs block">Color Variant</span>
                    <span className="font-semibold text-ink">{vehicle.color}</span>
                  </div>
                  <div className="border-t border-line/50 pt-2">
                    <span className="text-gray-400 text-xs block">Owner Count</span>
                    <span className="font-semibold text-ink">{vehicle.owners} Owner{vehicle.owners > 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {/* Added Comfort & Safety Features Checklist */}
              <div className="space-y-3">
                <h4 className="font-mono text-xs tracking-widest text-gray-400 uppercase font-bold">
                  Premium Standard Comforts
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {vehicle.features.map((feat, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 bg-paper border border-line text-ink text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                    >
                      <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      {feat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions CTA */}
            <div className="border-t border-line pt-5 mt-6 space-y-3 shrink-0">
              <a
                href={getWhatsAppLink('enquiry')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-wa hover:bg-emerald-600 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2.5"
              >
                <MessageSquare className="w-4.5 h-4.5 fill-white" />
                WhatsApp Dealership Enquiry
              </a>
              <a
                href={getWhatsAppLink('video')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-ink hover:bg-ink-3 text-white font-semibold text-xs py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-brand-blue" />
                Book Live Video Walkaround
              </a>
              <div className="text-center">
                <span className="text-[10px] font-mono text-gray-400 uppercase">
                  Located at: 257 Caledon St, Kariega
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
