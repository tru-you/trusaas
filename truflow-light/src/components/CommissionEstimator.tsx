import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Award, TrendingUp, Users, DollarSign, 
  ChevronDown, ChevronUp, Briefcase, Percent, 
  Layers, Sliders, CheckCircle2, Info
} from 'lucide-react';
import { Vehicle, Lead, User } from '../types';

interface CommissionEstimatorProps {
  users: User[];
  leads: Lead[];
  vehicles: Vehicle[];
}

type EstModel = 'flat' | 'volume' | 'marginTier';

export const CommissionEstimator: React.FC<CommissionEstimatorProps> = ({ users, leads, vehicles }) => {
  const [model, setModel] = useState<EstModel>('flat');
  const [flatRate, setFlatRate] = useState<number>(10); // default 10%
  const [expandedRep, setExpandedRep] = useState<string | null>(null);

  // Filter only salespeople
  const salespeople = users.filter(u => u.role === 'salesperson' && u.isActive);

  // Helper to format South African Rand (ZAR)
  const formatZAR = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Helper to calculate deals and margin for a user
  const getUserDealsData = (userId: string) => {
    const closedWonLeads = leads.filter(l => l.assignedUserId === userId && l.status === 'Closed Won');
    
    let totalRevenue = 0;
    let totalMargin = 0;
    const items: { lead: Lead; vehicle: Vehicle; margin: number; commission: number }[] = [];

    closedWonLeads.forEach(l => {
      const v = vehicles.find(veh => veh.id === l.vehicleId);
      if (v) {
        const revenue = v.retailPrice;
        const margin = Math.max(0, v.retailPrice - v.costPrice);
        totalRevenue += revenue;
        totalMargin += margin;

        // Calculate commission for this specific vehicle based on selected model
        let commission = 0;
        if (model === 'flat') {
          commission = margin * (flatRate / 100);
        } else if (model === 'volume') {
          // Sliding scale based on total volume of deals
          const volume = closedWonLeads.length;
          let rate = 8; // 1-2 deals: 8%
          if (volume >= 3 && volume <= 4) rate = 10;
          if (volume >= 5) rate = 12;
          commission = margin * (rate / 100);
        } else if (model === 'marginTier') {
          // Tiered commission by vehicle margin
          if (margin < 20000) {
            commission = 1500; // Flat fee
          } else if (margin >= 20000 && margin <= 50000) {
            commission = margin * 0.10; // 10% of margin
          } else {
            commission = margin * 0.12; // 12% of margin
          }
        }

        items.push({ lead: l, vehicle: v, margin, commission });
      }
    });

    // Re-sum commissions based on model to ensure accurate total
    let finalCommission = 0;
    if (model === 'flat') {
      finalCommission = totalMargin * (flatRate / 100);
    } else if (model === 'volume') {
      const volume = closedWonLeads.length;
      let rate = 8;
      if (volume >= 3 && volume <= 4) rate = 10;
      if (volume >= 5) rate = 12;
      finalCommission = totalMargin * (rate / 100);
    } else {
      finalCommission = items.reduce((sum, item) => sum + item.commission, 0);
    }

    return {
      closedWonLeads,
      totalRevenue,
      totalMargin,
      commission: finalCommission,
      items
    };
  };

  // Aggregated data
  const repsData = salespeople.map(rep => {
    const data = getUserDealsData(rep.id);
    return {
      rep,
      ...data
    };
  });

  const totalDealershipRevenue = repsData.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalDealershipMargin = repsData.reduce((sum, r) => sum + r.totalMargin, 0);
  const totalDealershipCommission = repsData.reduce((sum, r) => sum + r.commission, 0);
  const totalUnitsSold = repsData.reduce((sum, r) => sum + r.closedWonLeads.length, 0);

  return (
    <div className="card border border-white/5 bg-[#070d15]/40 backdrop-blur-md p-6 flex flex-col gap-6 rounded-2xl shadow-xl">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/20">
              <Award size={16} />
            </div>
            <h3 className="font-serif text-lg font-black text-[#E8EEF6]">Commission Estimation Engine</h3>
          </div>
          <p className="text-[11px] text-[#9DB0C6] mt-1">
            Real-time projection of sales representative commission pool based on finalized deal ledger margins.
          </p>
        </div>

        {/* Structure Selector */}
        <div className="flex items-center gap-1.5 bg-[#0f1826]/2 border border-white/5 rounded-xl p-1 w-full lg:w-auto">
          <button
            onClick={() => setModel('flat')}
            className={`flex-1 lg:flex-none px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              model === 'flat' 
                ? 'bg-[#1466E0] text-white shadow-lg' 
                : 'text-[#9DB0C6] hover:text-[#E8EEF6]'
            }`}
          >
            Flat %
          </button>
          <button
            onClick={() => setModel('volume')}
            className={`flex-1 lg:flex-none px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              model === 'volume' 
                ? 'bg-[#1466E0] text-white shadow-lg' 
                : 'text-[#9DB0C6] hover:text-[#E8EEF6]'
            }`}
          >
            Volume-Based
          </button>
          <button
            onClick={() => setModel('marginTier')}
            className={`flex-1 lg:flex-none px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              model === 'marginTier' 
                ? 'bg-[#1466E0] text-white shadow-lg' 
                : 'text-[#9DB0C6] hover:text-[#E8EEF6]'
            }`}
          >
            Margin-Tiered
          </button>
        </div>
      </div>

      {/* Model Parameter Controls */}
      <div className="p-4 rounded-xl bg-[#0f1826]/2 border border-white/5">
        {model === 'flat' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 max-w-md">
              <div className="p-1.5 rounded-lg bg-[#1466E0]/10 text-[#4D9BFF] mt-0.5">
                <Percent size={14} />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">Flat Percentage of Gross Margin</span>
                <span className="text-[10px] text-[#9DB0C6] leading-relaxed block">
                  Commission is calculated as a fixed percentage of the gross profit margin (Retail Price - Cost Price) of each unit sold.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4 bg-[#070d15] px-4 py-2.5 rounded-xl border border-white/5 self-end md:self-auto min-w-[200px]">
              <span className="text-[10px] font-bold text-[#9DB0C6] uppercase">Rate:</span>
              <input 
                type="range" 
                min="5" 
                max="20" 
                value={flatRate} 
                onChange={(e) => setFlatRate(Number(e.target.value))}
                className="w-full accent-[#1466E0]"
              />
              <span className="text-xs font-black text-white min-w-[32px] text-right">{flatRate}%</span>
            </div>
          </div>
        )}

        {model === 'volume' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 max-w-lg">
              <div className="p-1.5 rounded-lg bg-[#15C7C0]/10 text-[#15C7C0] mt-0.5">
                <Layers size={14} />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">Sliding Scale by Deal Volume</span>
                <span className="text-[10px] text-[#9DB0C6] leading-relaxed block">
                  Encourage volume. Commision rates scale dynamically as sales reps close more units in the active period.
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold tracking-tight uppercase min-w-[260px]">
              <div className="bg-[#070d15] border border-white/5 rounded-lg p-2 flex flex-col gap-0.5">
                <span className="text-[#9DB0C6] text-[8px] tracking-widest">1-2 units</span>
                <span className="text-[#4D9BFF]">8% Rate</span>
              </div>
              <div className="bg-[#070d15] border border-white/5 rounded-lg p-2 flex flex-col gap-0.5">
                <span className="text-[#9DB0C6] text-[8px] tracking-widest">3-4 units</span>
                <span className="text-[#15C7C0]">10% Rate</span>
              </div>
              <div className="bg-[#070d15] border border-white/5 rounded-lg p-2 flex flex-col gap-0.5">
                <span className="text-[#9DB0C6] text-[8px] tracking-widest">5+ units</span>
                <span className="text-[#A78BFA]">12% Rate</span>
              </div>
            </div>
          </div>
        )}

        {model === 'marginTier' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3 max-w-lg">
              <div className="p-1.5 rounded-lg bg-[#C9A24B]/10 text-[#C9A24B] mt-0.5">
                <Sliders size={14} />
              </div>
              <div>
                <span className="font-bold text-xs text-white block">High-Margin Performance Tiers</span>
                <span className="text-[10px] text-[#9DB0C6] leading-relaxed block">
                  Protect dealership profits. Low-margin units receive a flat R1,500, while high-margin vehicles yield scaling percentages.
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold tracking-tight uppercase min-w-[260px]">
              <div className="bg-[#070d15] border border-white/5 rounded-lg p-2 flex flex-col gap-0.5">
                <span className="text-[#9DB0C6] text-[8px] tracking-widest">&lt; R20k margin</span>
                <span className="text-white">R1,500 Flat</span>
              </div>
              <div className="bg-[#070d15] border border-white/5 rounded-lg p-2 flex flex-col gap-0.5">
                <span className="text-[#9DB0C6] text-[8px] tracking-widest">R20k - R50k</span>
                <span className="text-[#C9A24B]">10% margin</span>
              </div>
              <div className="bg-[#070d15] border border-white/5 rounded-lg p-2 flex flex-col gap-0.5">
                <span className="text-[#9DB0C6] text-[8px] tracking-widest">&gt; R50k margin</span>
                <span className="text-[#35C46B]">12% margin</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dealership Aggregate Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#070d15] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[8px] font-bold text-[#9DB0C6] uppercase tracking-wider">Total Showroom Sales</span>
          <span className="text-lg font-black text-white">{totalUnitsSold} Units</span>
        </div>
        <div className="bg-[#070d15] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[8px] font-bold text-[#9DB0C6] uppercase tracking-wider">Gross Sales Revenue</span>
          <span className="text-lg font-black text-white">{formatZAR(totalDealershipRevenue)}</span>
        </div>
        <div className="bg-[#070d15] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
          <span className="text-[8px] font-bold text-[#9DB0C6] uppercase tracking-wider">Gross Profit Margin</span>
          <span className="text-lg font-black text-[#15C7C0]">{formatZAR(totalDealershipMargin)}</span>
        </div>
        <div className="bg-[#1466E0]/10 border border-[#1466E0]/20 rounded-xl p-3 flex flex-col gap-1 shadow-lg shadow-[#1466E0]/5">
          <span className="text-[8px] font-bold text-[#4D9BFF] uppercase tracking-wider">Estimated Comm. Pool</span>
          <span className="text-lg font-black text-[#8B5CF6]">{formatZAR(totalDealershipCommission)}</span>
        </div>
      </div>

      {/* Salesperson List & Roster details */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-black uppercase text-[#9DB0C6] tracking-wider mb-1 px-1">Specialist Commission Breakdown</span>
        <div className="space-y-2">
          {repsData.map(({ rep, closedWonLeads, totalRevenue, totalMargin, commission, items }) => (
            <div 
              key={rep.id} 
              className="bg-[#070d15]/60 border border-white/5 rounded-xl overflow-hidden transition-all hover:border-white/10"
            >
              {/* Roster Row */}
              <div 
                onClick={() => setExpandedRep(expandedRep === rep.id ? null : rep.id)}
                className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:bg-[#0f1826]/1 transition-all select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#1466E0] flex items-center justify-center font-bold text-xs text-white">
                    {rep.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-white block">{rep.name}</span>
                    <span className="text-[9px] text-[#9DB0C6] font-mono uppercase mt-0.5 block">
                      {closedWonLeads.length} {closedWonLeads.length === 1 ? 'deal' : 'deals'} finalized
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-6 self-stretch sm:self-auto justify-between sm:justify-start">
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-[#9DB0C6] uppercase tracking-wider block">Margin Generated</span>
                    <span className="text-xs font-bold text-[#E8EEF6]">{formatZAR(totalMargin)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] font-bold text-[#A78BFA] uppercase tracking-wider block">Est. Commission</span>
                    <span className="text-xs font-black text-[#A78BFA]">{formatZAR(commission)}</span>
                  </div>
                  <div className="text-[#9DB0C6] hover:text-[#E8EEF6] transition-colors p-1 rounded">
                    {expandedRep === rep.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </div>
              </div>

              {/* Collapsible item details */}
              <AnimatePresence initial={false}>
                {expandedRep === rep.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "auto" }}
                    exit={{ height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-white/5 bg-[#070d15]/50"
                  >
                    <div className="p-4 flex flex-col gap-2">
                      {items.length === 0 ? (
                        <div className="text-center py-4 text-[10px] text-[#9DB0C6] italic">
                          No Closed Won deals recorded for this rep in the current state.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[10px] border-collapse">
                            <thead>
                              <tr className="text-[#9DB0C6] uppercase tracking-widest text-[8px] border-b border-white/5">
                                <th className="py-2 px-3">Vehicle Details</th>
                                <th className="py-2 px-3 text-right">Retail Price</th>
                                <th className="py-2 px-3 text-right">Cost Price</th>
                                <th className="py-2 px-3 text-right">Gross profit</th>
                                <th className="py-2 px-3 text-right text-[#A78BFA]">Est. Commission</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, idx) => (
                                <tr key={idx} className="border-b border-white/3 last:border-0 hover:bg-[#0f1826]/1">
                                  <td className="py-2.5 px-3 font-semibold text-white">
                                    {item.vehicle.year} {item.vehicle.make} {item.vehicle.model}
                                    <span className="text-[8px] text-[#9DB0C6] font-mono ml-2">({item.vehicle.stockNumber})</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-[#9DB0C6]">{formatZAR(item.vehicle.retailPrice)}</td>
                                  <td className="py-2.5 px-3 text-right text-[#9DB0C6]">{formatZAR(item.vehicle.costPrice)}</td>
                                  <td className="py-2.5 px-3 text-right text-[#15C7C0] font-bold">{formatZAR(item.margin)}</td>
                                  <td className="py-2.5 px-3 text-right text-[#A78BFA] font-black">{formatZAR(item.commission)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
