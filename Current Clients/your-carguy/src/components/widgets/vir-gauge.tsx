"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface VIRGaugeProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export default function VIRGauge({ 
  score, 
  size = 120, 
  strokeWidth = 8,
  label = "Overall"
}: VIRGaugeProps) {
  const ref = useRef<SVGSVGElement>(null);
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  // Color based on score
  const getColor = () => {
    if (score >= 80) return "#059669"; // green
    if (score >= 50) return "#D97706"; // amber
    return "#DC2626"; // red
  };

  const color = getColor();

  useEffect(() => {
    if (!ref.current) return;
    
    const ring = ref.current.querySelector("circle:last-child") as SVGCircleElement;
    if (ring) {
      ring.style.setProperty("--gauge-max", String(circumference));
      ring.style.setProperty("--gauge-target", String(targetOffset));
      ring.classList.add("gauge-ring-animated");
      ring.style.strokeDasharray = String(circumference);
      ring.style.strokeDashoffset = String(circumference);
      
      // Animate to target after mount
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = String(targetOffset);
      });
    }
  }, [score, circumference, targetOffset]);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        {/* Animated progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: circumference,
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
      {/* Score text overlay center */}
      <div className="absolute" style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        marginTop: `-${size}px`, 
        marginBottom: `${size * 0.1}px` 
      }}>
        <div className="text-center">
          <div className="text-2xl font-display font-bold" style={{ color }}>
            {score}<span className="text-sm text-ink-muted">/100</span>
          </div>
        </div>
      </div>
      <span className="text-xs text-ink-muted uppercase tracking-wider">{label}</span>
    </div>
  );
}

// Standalone usage component that combines with inline positioning
export function VIRScoreDisplay({ score, title }: { score: number; title?: string }) {
  return (
    <div className="relative w-[120px] h-[120px] mx-auto">
      <svg viewBox="0 0 120 120" className="transform -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={score >= 80 ? "#059669" : score >= 50 ? "#D97706" : "#DC2626"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 52}`}
          strokeDashoffset={`${2 * Math.PI * 52 - (score / 100) * 2 * Math.PI * 52}`}
          className="transition-all duration-1200 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-display font-bold" style={{ color: score >= 80 ? "#059669" : score >= 50 ? "#D97706" : "#DC2626" }}>
          {score}
        </span>
        <span className="text-[10px] text-ink-muted uppercase tracking-wider">vir score</span>
      </div>
    </div>
  );
}
