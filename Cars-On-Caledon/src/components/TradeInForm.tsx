import React, { useState } from 'react';
import { Tag, Sparkles, Send, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function TradeInForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [make, setMake] = useState('Volkswagen');
  const [otherMake, setOtherMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(2018);
  const [km, setKm] = useState(80000);
  const [condition, setCondition] = useState<'Excellent' | 'Good' | 'Fair'>('Good');

  // Lead Details
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Estimation logic
  const calculateEstimate = () => {
    let baseValue = 250000; // default for VW
    const selectedMake = make === 'Other' ? otherMake : make;

    switch (make) {
      case 'Volkswagen': baseValue = 280000; break;
      case 'Toyota': baseValue = 360000; break;
      case 'Ford': baseValue = 320000; break;
      case 'BMW': baseValue = 420000; break;
      case 'Mercedes-Benz': baseValue = 460000; break;
      case 'Audi': baseValue = 390000; break;
      default: baseValue = 200000;
    }

    // Depreciation by age: 8% per year from 2026
    const age = Math.max(0, 2026 - year);
    const ageFactor = Math.max(0.2, 1 - (age * 0.075));

    // Mileage effect: deduct up to 35% for high mileage
    const kmFactor = Math.max(0.4, 1 - (km / 280000) * 0.35);

    // Condition factor
    let condFactor = 0.95; // Good
    if (condition === 'Excellent') condFactor = 1.05;
    if (condition === 'Fair') condFactor = 0.8;

    const estimatedTradeVal = baseValue * ageFactor * kmFactor * condFactor;
    const estimatedRetailVal = estimatedTradeVal * 1.15; // retail is ~15% higher

    return {
      tradeMin: Math.round((estimatedTradeVal * 0.93) / 1000) * 1000,
      tradeMax: Math.round((estimatedTradeVal * 1.04) / 1000) * 1000,
      retailMin: Math.round((estimatedRetailVal * 0.95) / 1000) * 1000,
      retailMax: Math.round((estimatedRetailVal * 1.05) / 1000) * 1000
    };
  };

  const valuation = calculateEstimate();

  const formatZAR = (val: number) => {
    return 'R ' + val.toLocaleString('en-ZA');
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    // Generate WhatsApp text
    const vehicleName = `${year} ${make === 'Other' ? otherMake : make} ${model}`;
    const waText = `Hi Lance, I would like to enquire about a trade-in/valuation for my car:
- *Vehicle:* ${vehicleName}
- *Mileage:* ${km.toLocaleString('en-ZA')} km
- *Condition:* ${condition}
- *Estimated Trade Range:* ${formatZAR(valuation.tradeMin)} - ${formatZAR(valuation.tradeMax)}

*My Details:*
- *Name:* ${clientName}
- *Phone:* ${clientPhone}
- *Email:* ${clientEmail}`;

    const waUrl = `https://wa.me/27618759389?text=${encodeURIComponent(waText)}`;
    
    // Redirect to WhatsApp after 1.5 seconds
    setTimeout(() => {
      window.open(waUrl, '_blank');
    }, 1500);
  };

  const handleReset = () => {
    setStep(1);
    setSubmitted(false);
    setModel('');
    setKm(80000);
    setClientName('');
    setClientPhone('');
    setClientEmail('');
  };

  return (
    <div className="bg-white border border-line rounded-2xl p-6 sm:p-8 shadow-xl relative">
      <div className="absolute top-0 right-0 bg-brand-blue/5 text-brand-brand-gold text-[10px] font-mono tracking-widest uppercase px-3 py-1 rounded-bl-xl rounded-tr-xl flex items-center gap-1">
        <Sparkles className="w-3 h-3" />
        Instant Digital Appraisal
      </div>

      <AnimatePresence mode="wait">
        {!submitted ? (
          step === 1 ? (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleNextStep}
              className="space-y-5"
            >
              <div className="border-b border-line pb-3 mb-4">
                <h3 className="font-disp font-bold text-xl text-ink">What is your car?</h3>
                <p className="text-xs text-gray-500 mt-1">Provide basic vehicle specifications for an immediate estimate.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Brand / Make</label>
                  <select
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-ink font-medium"
                  >
                    <option>Volkswagen</option>
                    <option>Toyota</option>
                    <option>Ford</option>
                    <option>BMW</option>
                    <option>Mercedes-Benz</option>
                    <option>Audi</option>
                    <option>Other</option>
                  </select>
                </div>

                {make === 'Other' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Specify Brand</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mazda, Hyundai"
                      value={otherMake}
                      onChange={(e) => setOtherMake(e.target.value)}
                      className="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Model / Variant</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Polo GTI, Hilux Raider"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-ink font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Model Year</label>
                  <select
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-ink font-mono"
                  >
                    {Array.from({ length: 17 }, (_, i) => 2026 - i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                    Mileage: <span className="font-mono font-medium text-brand-blue">{km.toLocaleString('en-ZA')} km</span>
                  </label>
                  <input
                    type="range"
                    min={5000}
                    max={250000}
                    step={5000}
                    value={km}
                    onChange={(e) => setKm(Number(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-blue py-3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Overall Vehicle Condition</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Excellent', 'Good', 'Fair'] as const).map((cond) => (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => setCondition(cond)}
                      className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                        condition === cond
                          ? 'bg-ink border-ink text-white'
                          : 'bg-paper border-line text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instant dynamic appraisal widget on Step 1 */}
              <div className="bg-paper border border-line rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-mono">Estimated Trade-In Range</span>
                  <span className="text-xs font-semibold text-brand-blue bg-brand-blue/5 px-2 py-0.5 rounded-full">Est. Appraisal</span>
                </div>
                <div className="font-disp font-extrabold text-2xl text-ink tracking-tight">
                  {formatZAR(valuation.tradeMin)} – {formatZAR(valuation.tradeMax)}
                </div>
                <p className="text-[10px] text-gray-400 leading-tight">
                  *Based on dynamic depreciation factors and current Eastern Cape wholesale market conditions. Subject to on-site check.
                </p>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-blue hover:bg-brand-blue-deep text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                Proceed to Submit
                <Send className="w-4 h-4" />
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="step2"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              <div className="border-b border-line pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h3 className="font-disp font-bold text-xl text-ink font-semibold">Contact Information</h3>
                  <p className="text-xs text-gray-500 mt-1">Submit to schedule your physical grading at Caledon Street.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-brand-blue font-semibold flex items-center gap-1 hover:underline"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Edit Specs
                </button>
              </div>

              {/* Appraisal summary recap card */}
              <div className="bg-ink text-white rounded-xl p-4 flex justify-between items-center">
                <div>
                  <span className="font-mono text-[9px] tracking-wider text-gray-400 block uppercase">Selected Car</span>
                  <span className="font-disp font-bold text-sm">{year} {make === 'Other' ? otherMake : make} {model}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[9px] tracking-wider text-brand-blue block uppercase font-semibold">Trade-In Value</span>
                  <span className="font-disp font-extrabold text-base text-brand-blue">{formatZAR(valuation.tradeMin)} - {formatZAR(valuation.tradeMax)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Your Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sipho Nkosi"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">WhatsApp / Phone Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +27 61 875 9389"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-ink font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. sipho@gmail.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full bg-paper border border-line rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-ink"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-wa hover:bg-emerald-600 text-white font-bold text-sm py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                Submit and Open WhatsApp
                <Send className="w-4 h-4" />
              </button>
            </motion.form>
          )
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="py-12 text-center space-y-4"
          >
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="font-disp font-extrabold text-2xl text-ink tracking-tight">Appraisal Sent!</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Your digital valuation of <strong className="text-ink">{formatZAR(valuation.tradeMin)} – {formatZAR(valuation.tradeMax)}</strong> has been registered. Opening WhatsApp to connect you directly with Lance at Caledon Street...
            </p>
            <button
              onClick={handleReset}
              className="mt-6 text-xs text-brand-blue font-semibold hover:underline"
            >
              Appraise another vehicle
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
