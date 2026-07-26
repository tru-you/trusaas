import { useState, useEffect } from "react";

interface AmortizationCalcProps {
  initialPrice?: number;
}

export default function AmortizationCalc({ initialPrice = 485000 }: AmortizationCalcProps) {
  const [price, setPrice] = useState(initialPrice);
  const [deposit, setDeposit] = useState(50000);
  const [interestRate, setInterestRate] = useState(11.5);
  const [term, setTerm] = useState(60);
  const [balloonPct, setBalloonPct] = useState(10);

  // Calculated state
  const [monthlyInstallment, setMonthlyInstallment] = useState(0);
  const [netPrincipal, setNetPrincipal] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [balloonAmount, setBalloonAmount] = useState(0);
  const [lifetimeCost, setLifetimeCost] = useState(0);

  useEffect(() => {
    const principal = Math.max(0, price - deposit);
    const balloonVal = principal * (balloonPct / 100);
    const financedVal = principal - balloonVal;

    const monthlyRate = interestRate / 100 / 12;
    let installment = 0;

    if (monthlyRate > 0 && term > 0) {
      installment =
        (financedVal * (monthlyRate * Math.pow(1 + monthlyRate, term))) /
        (Math.pow(1 + monthlyRate, term) - 1);
    } else if (term > 0) {
      installment = financedVal / term;
    }

    const totalCostOfInstallments = installment * term;
    const totalCostFinance = totalCostOfInstallments + balloonVal;
    const aggregateInterest = totalCostFinance - principal;

    setMonthlyInstallment(installment);
    setNetPrincipal(principal);
    setTotalInterest(aggregateInterest);
    setBalloonAmount(balloonVal);
    setLifetimeCost(totalCostFinance + deposit);
  }, [price, deposit, interestRate, term, balloonPct]);

  const formatZAR = (num: number) => {
    return "R " + Math.round(num).toLocaleString("en-ZA");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Inputs */}
      <div className="card">
        <div className="card-header border-b border-[rgba(138,162,184,0.1)] px-4 py-3">
          <h3 className="font-semibold text-[13px] text-[color:var(--white)]">Finance Amortization Inputs</h3>
        </div>
        <div className="card-body p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)]">Vehicle Total Price (ZAR)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)]">Downpayment / Initial Deposit (ZAR)</label>
            <input
              type="number"
              value={deposit}
              onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)}
              className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] tracking-normal text-[rgba(232,234,230,0.72)]">Interest Financing Percentage Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={interestRate}
              onChange={(e) => setInterestRate(parseFloat(e.target.value) || 0)}
              className="bg-[color:var(--glass)] border border-[rgba(138,162,184,0.1)] rounded-lg px-3 py-2 text-[13px] text-[color:var(--white)] outline-none focus:border-[color:var(--cyan)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[13px] tracking-normal text-[rgba(232,234,230,0.72)]">
              <span>Financing Term Duration</span>
              <span className="text-[color:var(--cyan-bright)] font-bold font-mono">{term} Months</span>
            </div>
            <input
              type="range"
              min="12"
              max="84"
              step="6"
              value={term}
              onChange={(e) => setTerm(parseInt(e.target.value))}
              className="w-full accent-[color:var(--cyan)] cursor-pointer my-2"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[13px] tracking-normal text-[rgba(232,234,230,0.72)]">
              <span>Residual Balloon Percentage Ratio</span>
              <span className="text-[color:var(--cyan)] font-bold font-mono">{balloonPct}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="5"
              value={balloonPct}
              onChange={(e) => setBalloonPct(parseInt(e.target.value))}
              className="w-full accent-[color:var(--cyan)] cursor-pointer my-2"
            />
          </div>
        </div>
      </div>

      {/* Outputs / Calculations summary */}
      <div className="card">
        <div className="card-header border-b border-[rgba(138,162,184,0.1)] px-4 py-3">
          <h3 className="font-semibold text-[13px] text-[color:var(--white)]">Monthly Amortization Schedule</h3>
        </div>
        <div className="card-body p-6 flex flex-col items-center justify-center text-center h-full min-h-[300px]">
          <div className="text-[13px] text-[rgba(232,234,230,0.72)]  tracking-widest font-mono mb-2">Monthly Installment Payment</div>
          <div className="text-4xl font-semibold text-[color:var(--cyan-bright)] mb-2">{formatZAR(monthlyInstallment)}</div>
          <div className="text-[13px] text-[rgba(232,234,230,0.72)] mb-6">Structured interest at {interestRate}% over {term} months term limit</div>

          <div className="grid grid-cols-2 gap-3 w-full text-left">
            <div className="bg-[color:var(--glass)] rounded-lg p-3 border border-[rgba(138,162,184,0.06)]">
              <div className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Net Principal</div>
              <div className="text-[16px] font-bold text-[color:var(--white)] mt-0.5">{formatZAR(netPrincipal)}</div>
            </div>
            <div className="bg-[color:var(--glass)] rounded-lg p-3 border border-[rgba(138,162,184,0.06)]">
              <div className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Aggregate Interest</div>
              <div className="text-[16px] font-bold text-[color:var(--white)] mt-0.5">{formatZAR(totalInterest)}</div>
            </div>
            <div className="bg-[color:var(--glass)] rounded-lg p-3 border border-[rgba(138,162,184,0.06)]">
              <div className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Balloon Value</div>
              <div className="text-[16px] font-bold text-[color:var(--white)] mt-0.5">{formatZAR(balloonAmount)}</div>
            </div>
            <div className="bg-[color:var(--glass)] rounded-lg p-3 border border-[rgba(138,162,184,0.06)]">
              <div className="text-[13px] text-[rgba(232,234,230,0.72)] tracking-normal font-mono">Lifetime Total Cost</div>
              <div className="text-[16px] font-bold text-[color:var(--white)] mt-0.5">{formatZAR(lifetimeCost)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
