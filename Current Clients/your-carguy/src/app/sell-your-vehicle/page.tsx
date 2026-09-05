import type { Metadata } from "next";
import PageHeader from "@/components/shared/page-header";
import TruValueHost from "@/components/widgets/tru-value-host";
import TruTrigger from "@/components/widgets/tru-trigger";
import { ShieldCheck, Search, FileSearch, Handshake } from "lucide-react";

export const metadata: Metadata = {
  title: "Sell Your Vehicle",
  description:
    "Get an instant trade-in estimate for your car in Port Elizabeth. Free valuation, honest pricing, same-week payment.",
};

const STEPS = [
  {
    icon: Search,
    title: "Instant Range",
    desc: "Enter your car's details above and get a market-based trade-in range in seconds.",
  },
  {
    icon: FileSearch,
    title: "Free Assessment",
    desc: "Bring it through to 17 Burt Drive. We inspect, verify, and firm up the number — no charge, no obligation.",
  },
  {
    icon: Handshake,
    title: "Offer & Paperwork",
    desc: "Clear offer in writing. We handle the licensing and transfer admin ourselves.",
  },
  {
    icon: ShieldCheck,
    title: "Paid Same Week",
    desc: "Money in your account, not promises. Trade in against your next car and we apply it directly.",
  },
];

export default function SellYourVehiclePage() {
  return (
    <>
      <PageHeader
        title="Sell Your Vehicle"
        subtitle="Honest trade-in value, priced against the live market — not a lowball guess"
      />

      {/* Real TruValue widget — instant market-based trade-in range */}
      <section className="bg-surface-deep py-12 sm:py-16">
        <div className="max-w-xl mx-auto px-4">
          <div className="text-center mb-6">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-white">
              Want an instant estimate?
            </h2>
            <p className="mt-2 text-sm text-white/50">
              Enter your car's details and get a free market-based trade-in range — no call required.
            </p>
          </div>
          <TruValueHost />
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 sm:py-20 bg-surface">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-ink text-center mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="relative bg-surface-alt rounded-xl p-6 border border-border">
                <span className="absolute -top-3 -left-2 h-7 w-7 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center shadow-md shadow-brand-glow">
                  {i + 1}
                </span>
                <Icon className="h-6 w-6 text-brand mb-3" />
                <h3 className="font-display font-semibold text-ink mb-1">{title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Direct enquiry — opens the global TruForm, source-stamped */}
      <section className="py-14 sm:py-20 bg-surface-alt border-t border-border">
        <div className="max-w-xl mx-auto px-4 text-center">
          <h2 className="font-display font-bold text-2xl text-ink">Rather just talk to us?</h2>
          <p className="text-sm text-ink-muted mt-2 mb-6">
            Send the details — registration number, year, mileage — and we'll come back with a number.
          </p>
          <TruTrigger
            action="form"
            variant="brand"
            size="lg"
            className="h-12 px-8"
            payload={{ source: "YCG Sell Page", interest: "Selling / Trade-in" }}
          >
            Send Enquiry
          </TruTrigger>
        </div>
      </section>
    </>
  );
}
