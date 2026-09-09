import React, { useState, useEffect } from 'react';
import { Calculator, Percent, ShieldCheck, Landmark } from 'lucide-react';

interface FinanceCalculatorProps {
  initialPrice?: number;
}

export default function FinanceCalculator({ initialPrice = 385000 }: FinanceCalculatorProps) {
  const [price, setPrice] = useState(initialPrice);
  const [depositPercent, setDepositPercent] = useState(10);
  const [term, setTerm] = useState(72);
  const [interestRate, setInterestRate] = useState(11.75); // SA standard linked rate

  // If initialPrice changes (e.g. from a parent vehicle selection), sync it
  useEffect(() => {
    if (initialPrice) {
      setPrice(initialPrice);
    }
  }, [initialPrice]);

  const depositValue = Math.round(price * (depositPercent / 100));
  const principalAmount = price - depositValue;

  // Monthly repayment formula
  const calculateRepayment = () => {
    if (principalAmount <= 0) return 0;
    const r = (interestRate / 100) / 12;
    const n = term;
    const monthly = (principalAmount * r) / (1 - Math.pow(1 + r, -n));
    return isNaN(monthly) ? 0 : Math.round(monthly);
  };

  const monthlyPayment = calculateRepayment();

  const formatZAR = (val: number) => {
    return 'R ' + val.toLocaleString('en-ZA');
  };

  return (
    <div className="bg-gradient-to-b from-ink-2 to-ink-3 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      {/* Background soft glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-6">
        <span className="font-mono text-xs tracking-widest text-gray-400 uppercase flex items-center gap-2">
          <Calculator className="w-4 h-4 text-brand-brand-gold" />
          Repayment Estimator
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
          LIVE RATES
        </span>
      </div>

      <div className="space-y-6">
        {/* Price slider */}
        <div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-400 font-medium">Vehicle Price</span>
            <span className="font-mono font-bold text-white text-base">
              {formatZAR(price)}
            </span>
          </div>
          <input
            type="range"
            min={80000}
            max={1200000}
            step={5000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full h-1 bg-ink/80 rounded-lg appearance-none cursor-pointer accent-brand-blue"
            style={{
              background: `linear-gradient(to right, #0A2540 0%, #0A2540 ${((price - 80000) / (1200000 - 80000)) * 100}%, #31383e ${((price - 80000) / (1200000 - 80000)) * 100}%, #31383e 100%)`
            }}
          />
        </div>

        {/* Deposit slider */}
        <div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-400 font-medium flex items-center gap-1.5">
              Deposit
              <span className="text-xs font-mono text-gray-500">({depositPercent}%)</span>
            </span>
            <span className="font-mono text-gray-300">
              {formatZAR(depositValue)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={5}
            value={depositPercent}
            onChange={(e) => setDepositPercent(Number(e.target.value))}
            className="w-full h-1 bg-ink/80 rounded-lg appearance-none cursor-pointer accent-brand-blue"
            style={{
              background: `linear-gradient(to right, #0A2540 0%, #0A2540 ${depositPercent * 2}%, #31383e ${depositPercent * 2}%, #31383e 100%)`
            }}
          />
        </div>

        {/* Term Slider */}
        <div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-400 font-medium">Payment Term</span>
            <span className="font-mono font-bold text-gray-300">
              {term} Months <span className="text-xs text-gray-500">({(term / 12).toFixed(0)} yrs)</span>
            </span>
          </div>
          <input
            type="range"
            min={12}
            max={84}
            step={12}
            value={term}
            onChange={(e) => setTerm(Number(e.target.value))}
            className="w-full h-1 bg-ink/80 rounded-lg appearance-none cursor-pointer accent-brand-blue"
            style={{
              background: `linear-gradient(to right, #0A2540 0%, #0A2540 ${((term - 12) / (84 - 12)) * 100}%, #31383e ${((term - 12) / (84 - 12)) * 100}%, #31383e 100%)`
            }}
          />
        </div>

        {/* Dynamic Interest Rate slider */}
        <div>
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-400 font-medium">Interest Rate (Linked)</span>
            <span className="font-mono text-gray-300">{interestRate.toFixed(2)}%</span>
          </div>
          <input
            type="range"
            min={7.0}
            max={20.0}
            step={0.25}
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full h-1 bg-ink/80 rounded-lg appearance-none cursor-pointer accent-brand-blue"
            style={{
              background: `linear-gradient(to right, #0A2540 0%, #0A2540 ${((interestRate - 7) / (20 - 7)) * 100}%, #31383e ${((interestRate - 7) / (20 - 7)) * 100}%, #31383e 100%)`
            }}
          />
        </div>

        {/* Result Area */}
        <div className="bg-brand-blue/10 border border-brand-blue/30 rounded-xl p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 mt-8">
          <div>
            <span className="font-mono text-[9px] tracking-widest text-brand-blue uppercase block font-semibold mb-1">
              Estimated Repayment
            </span>
            <div className="font-disp font-extrabold text-3xl sm:text-4xl text-white tracking-tight flex items-baseline gap-1">
              {formatZAR(monthlyPayment)}
              <span className="text-sm font-medium text-gray-400">/pm</span>
            </div>
          </div>
          <a
            href={`https://wa.me/27618759389?text=Hi%20Lance,%20I%20would%20like%20to%20apply%20for%20finance%20for%20a%20vehicle%20priced%20at%20${encodeURIComponent(formatZAR(price))}%20with%20a%20deposit%20of%20${depositPercent}%.`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-blue hover:bg-brand-blue-deep text-white font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full text-center transition-all hover:scale-[1.02]"
          >
            Apply for Finance
          </a>
        </div>

        <p className="font-mono text-[9.5px] text-gray-500 leading-normal">
          Estimate based on selected interest rate over specified term, excluding mandatory initiation fees &amp; monthly bank admin service levies. Final linked rates are subject to individual credit scoring, bank approval, and FSP conditions. Cars on Caledon facilitates submissions through authorized credit providers.
        </p>
      </div>
    </div>
  );
}
