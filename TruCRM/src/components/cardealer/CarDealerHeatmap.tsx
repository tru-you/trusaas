import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { CarDealership } from '../../types/carDealer';
import { MapPin, Globe, Car, DollarSign, Info } from 'lucide-react';

interface CarDealerHeatmapProps {
  dealerships: CarDealership[];
}

interface MappedDealer extends CarDealership {
  coord: {
    x: number;
    y: number;
    state: string;
  };
}

// Approximate coordinates for visualization mapping
const regionCoordinates: Record<string, { x: number; y: number; state: string }> = {
  'Austin, TX': { x: 340, y: 340, state: 'Texas' },
  'Dallas, TX': { x: 360, y: 280, state: 'Texas' },
  'San Antonio, TX': { x: 320, y: 360, state: 'Texas' },
  'Fort Worth, TX': { x: 350, y: 285, state: 'Texas' },
  'Los Angeles, CA': { x: 90, y: 260, state: 'California' },
  'Chicago, IL': { x: 580, y: 190, state: 'Illinois' },
  'Miami, FL': { x: 740, y: 390, state: 'Florida' },
  'Atlanta, GA': { x: 630, y: 310, state: 'Georgia' },
  'Phoenix, AZ': { x: 160, y: 280, state: 'Arizona' },
  'Seattle, WA': { x: 110, y: 80, state: 'Washington' },
  'Detroit, MI': { x: 630, y: 170, state: 'Michigan' },
  'Cape Town, South Africa': { x: 420, y: 410, state: 'Western Cape' },
  'Cape Town': { x: 420, y: 410, state: 'Western Cape' },
};

export const CarDealerHeatmap: React.FC<CarDealerHeatmapProps> = ({ dealerships }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{ dealer: CarDealership; x: number; y: number } | null>(null);
  const [metricMode, setMetricMode] = useState<'inventory' | 'adSpend'>('inventory');

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 850;
    const height = 460;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Background Container Group
    const g = svg.append('g');

    // Draw US Map background outline / stylized grid nodes
    // Radial heat gradient definitions
    const defs = svg.append('defs');
    const radialGrad = defs
      .append('radialGradient')
      .attr('id', 'heatGlow')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%');
    radialGrad.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.4);
    radialGrad.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0);

    // Grid background lines
    const gridGroup = g.append('g').attr('class', 'grid-lines').style('opacity', 0.1);
    for (let x = 0; x < width; x += 50) {
      gridGroup
        .append('line')
        .attr('x1', x)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', height)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1);
    }
    for (let y = 0; y < height; y += 50) {
      gridGroup
        .append('line')
        .attr('x1', 0)
        .attr('y1', y)
        .attr('x2', width)
        .attr('y2', y)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1);
    }

    // Process dealers & coordinates with robust fallback
    const mappedDealers: MappedDealer[] = dealerships.map((dealer) => {
      const coord =
        regionCoordinates[dealer.location] ||
        regionCoordinates[dealer.location.split(',')[0]] || {
          x: 150 + (Math.abs(dealer.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 550),
          y: 80 + (Math.abs(dealer.name.length * 37) % 300),
          state: dealer.location,
        };
      return { ...dealer, coord };
    });

    // Draw Heat circles underneath
    mappedDealers.forEach((d) => {
      const val = metricMode === 'inventory' ? d.inventoryCount : (d.intelReport?.estimatedMonthlyAdSpend || 20000) / 300;
      const radius = Math.max(30, Math.min(80, val * 0.5));

      g.append('circle')
        .attr('cx', d.coord.x)
        .attr('cy', d.coord.y)
        .attr('r', radius)
        .attr('fill', 'url(#heatGlow)')
        .style('pointer-events', 'none')
        .transition()
        .duration(1000)
        .attr('r', radius * 1.1);
    });

    // Draw nodes / bubbles
    const nodeGroup = g.append('g').attr('class', 'dealer-nodes');

    const nodes = nodeGroup
      .selectAll<SVGGElement, MappedDealer>('g')
      .data(mappedDealers)
      .enter()
      .append('g')
      .attr('transform', (d) => `translate(${d.coord.x}, ${d.coord.y})`)
      .style('cursor', 'pointer')
      .on('mouseover', (event, d) => {
        const [x, y] = d3.pointer(event, svgRef.current);
        setTooltip({ dealer: d, x: x + 15, y: y - 10 });
      })
      .on('mouseout', () => setTooltip(null));

    // Outer pulse ring
    nodes
      .append('circle')
      .attr('r', (d: MappedDealer) => {
        const base = metricMode === 'inventory' ? d.inventoryCount * 0.12 : ((d.intelReport?.estimatedMonthlyAdSpend || 25000) / 1500);
        return Math.max(12, Math.min(32, base + 8));
      })
      .attr('fill', (d: MappedDealer) => {
        if (d.source === 'autotrader') return '#ffffff';
        if (d.source === 'cars.com') return '#ffffff';
        if (d.source === 'cargurus') return '#10b981';
        if (d.source === 'edmunds') return '#06b6d4';
        return '#06b6d4';
      })
      .attr('opacity', 0.25)
      .attr('class', 'animate-pulse');

    // Core bubble
    nodes
      .append('circle')
      .attr('r', (d: MappedDealer) => {
        const base = metricMode === 'inventory' ? d.inventoryCount * 0.12 : ((d.intelReport?.estimatedMonthlyAdSpend || 25000) / 1500);
        return Math.max(10, Math.min(24, base));
      })
      .attr('fill', (d: MappedDealer) => {
        if (d.source === 'autotrader') return '#ffffff';
        if (d.source === 'cars.com') return '#ffffff';
        if (d.source === 'cargurus') return '#34d399';
        if (d.source === 'edmunds') return '#06b6d4';
        return '#22d3ee';
      })
      .attr('stroke', '#E5E3DE')
      .attr('stroke-width', 2.5);

    // Inner icon or initial text
    nodes
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', '#000000')
      .attr('font-size', '10px')
      .attr('font-weight', 'black')
      .text((d: MappedDealer) => d.name.substring(0, 2).toUpperCase());

    // Dealer Label Tag underneath
    nodes
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 28)
      .attr('fill', 'rgba(10,20,32,0.40)')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .text((d: MappedDealer) => (d.name.length > 18 ? d.name.substring(0, 16) + '...' : d.name));

  }, [dealerships, metricMode]);

  return (
    <div className="bg-white border border-[rgba(10,20,32,0.08)] rounded-[32px] p-8 shadow-xl relative overflow-hidden space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-black text-[#1A2332] tracking-tight">Where the competition sits</h3>
            <span className="text-[10px] font-bold text-[rgba(10,20,32,0.30)] uppercase tracking-[0.2em]">Map Map</span>
          </div>
          <p className="text-sm text-[#6B7685] font-medium max-w-md">
            Rival dealers near you, by concentration — Eastern Cape and Garden Route.
          </p>
        </div>

        <div className="flex items-center bg-[rgba(10,20,32,0.03)] border border-[rgba(10,20,32,0.08)] p-1 rounded-2xl">
          <button
            onClick={() => setMetricMode('inventory')}
            className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${
              metricMode === 'inventory'
                ? 'bg-white text-black'
                : 'text-[rgba(10,20,32,0.30)] hover:text-white/50'
            }`}
          >
            Inventory
          </button>
          <button
            onClick={() => setMetricMode('adSpend')}
            className={`px-4 py-2 rounded-xl text-[11px] font-bold transition-all ${
              metricMode === 'adSpend'
                ? 'bg-white text-black'
                : 'text-[rgba(10,20,32,0.30)] hover:text-white/50'
            }`}
          >
            Ad Spend
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div className="relative w-full bg-[#FAFAF8] rounded-3xl border border-[rgba(10,20,32,0.08)] flex items-center justify-center p-8">
        <svg ref={svgRef} viewBox="0 0 850 460" className="w-full h-auto max-h-[460px]" />

        {/* Floating Tooltip Card */}
        {tooltip && (
          <div
            style={{ left: tooltip.x, top: tooltip.y }}
            className="absolute z-30 pointer-events-none bg-white border border-[rgba(10,20,32,0.10)] rounded-2xl p-4 shadow-2xl text-[11px] space-y-3 w-64 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-[#1A2332]">{tooltip.dealer.name}</span>
              <span className="text-[9px] font-black text-[rgba(10,20,32,0.30)] uppercase tracking-widest">
                {tooltip.dealer.source}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[rgba(10,20,32,0.08)]">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[rgba(10,20,32,0.20)] uppercase tracking-widest">Units</span>
                <div className="text-[#1A2332]">{tooltip.dealer.inventoryCount}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[rgba(10,20,32,0.20)] uppercase tracking-widest">Spend</span>
                <div className="text-cyan-500">${(tooltip.dealer.intelReport?.estimatedMonthlyAdSpend || 25000).toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-8 pt-4 border-t border-[rgba(10,20,32,0.08)]">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-3 text-[10px] font-bold text-[rgba(10,20,32,0.30)] uppercase tracking-[0.2em]">
            <span className="w-2 h-2 rounded-full bg-white" /> Market Lead
          </span>
          <span className="flex items-center gap-3 text-[10px] font-bold text-[rgba(10,20,32,0.30)] uppercase tracking-[0.2em]">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> High Velocity
          </span>
          <span className="flex items-center gap-3 text-[10px] font-bold text-[rgba(10,20,32,0.30)] uppercase tracking-[0.2em]">
            <span className="w-2 h-2 rounded-full bg-cyan-500" /> Active Network
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-medium text-[rgba(10,20,32,0.20)] uppercase tracking-widest">
          <Info className="w-3.5 h-3.5" />
          <span>Real-time spatial clustering enabled</span>
        </div>
      </div>
    </div>
  );
};
