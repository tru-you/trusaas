import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone, Clock, Award, Users, CarFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Your Car Guy is Port Elizabeth's trusted independent used-car dealer. Quality vehicles, honest pricing, and no-pressure service from Ray and team.",
};

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="The Guy You Can Trust"
        subtitle="Independent. Local. Obsessed with quality."
      />

      {/* Story */}
      <section className="px-4 pb-14">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="space-y-5">
            <p className="text-lg text-ink-secondary leading-relaxed">
              Your Car Guy started with one simple idea: buying a used car in PE shouldn't feel like
              a fight. No pressure, no hidden costs, no lemon on the lot.
            </p>
            <p className="text-sm text-ink-muted leading-relaxed">
              Ray built this dealership the hard way — one honest deal at a time. Every vehicle on
              our floor is hand-picked, inspected, and priced against the real market. When we say{" "}
              <em>"Backed by Trust. Driven by Quality,"</em> that's not a slogan. It's the reason
              332 people left us five stars on Google.
            </p>
            <p className="text-sm text-ink-muted leading-relaxed">
              We're at 17 Burt Drive, Newton Park — walk in, browse at your own pace, and leave
              with a car (or just good advice). Either way, you've dealt with Your Car Guy.
            </p>
            <div className="pt-2">
              <Link href="/vehicles">
                <Button className="h-11 px-6">Browse Our Stock</Button>
              </Link>
            </div>
          </div>

          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-border shadow-xl">
            <Image
              src="https://images.unsplash.com/photo-1568605117036-5350106b8cf4?w=900&h=675&fit=crop"
              alt="Your Car Guy showroom, Newton Park"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="bg-surface-deep py-14">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { icon: Award, value: "332+", label: "Five-Star Google Reviews" },
            { icon: Users, value: "10+", label: "Years Serving the Bay" },
            { icon: CarFront, value: "1,500+", label: "Cars Sold & Counting" },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label}>
              <Icon className="h-7 w-7 text-brand mx-auto mb-3" />
              <div className="font-display font-extrabold text-4xl text-white">{value}</div>
              <div className="text-sm text-white/50 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Visit */}
      <section className="py-14">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-alt rounded-xl p-6 border border-border text-center">
              <MapPin className="h-5 w-5 text-brand mx-auto mb-2" />
              <div className="font-semibold text-sm">Find Us</div>
              <p className="text-xs text-ink-muted mt-1">17 Burt Drive, Newton Park, PE 6045</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-6 border border-border text-center">
              <Clock className="h-5 w-5 text-brand mx-auto mb-2" />
              <div className="font-semibold text-sm">Opening Hours</div>
              <p className="text-xs text-ink-muted mt-1">Mon–Fri 07:30–17:30 · Sat 08:00–13:00</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-6 border border-border text-center">
              <Phone className="h-5 w-5 text-brand mx-auto mb-2" />
              <div className="font-semibold text-sm">Call / WhatsApp</div>
              <p className="text-xs text-ink-muted mt-1">083 465 9921 · 041 007 0393</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
