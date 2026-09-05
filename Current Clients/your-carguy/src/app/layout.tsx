import type { Metadata } from "next";
import "@/app/globals.css";
import { Inter, Inter_Tight } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Header from "@/components/layout/header";
import MobileNav from "@/components/layout/mobile-nav";
import Footer from "@/components/layout/footer";
import TruLoader from "@/components/widgets/tru-loader";
import ShowroomInit from "@/components/layout/showroom-init";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  metadataBase: new URL("https://yourcarguy.co.za"),
  title: {
    default: "Your Car Guy | Quality Used Cars in Port Elizabeth",
    template: "%s | Your Car Guy",
  },
  description:
    "Port Elizabeth's trusted used car dealer. Backed by Trust. Driven by Quality. Browse our handpicked selection of quality pre-owned vehicles.",
  keywords: ["used cars PE", "Your Car Guy", "car dealer Eastern Cape", "bakkies Port Elizabeth"],
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "Your Car Guy",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Your Car Guy" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
      <html lang="en" className={`${inter.variable} ${interTight.variable}`} data-theme="dark">
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <meta name="theme-color" content="#0A0A0C" />
        </head>
        <body className="min-h-screen flex flex-col bg-surface text-ink antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <MobileNav />
        {/* Real TruSaaS widgets — loader self-mounts TruForm/TruAfford launchers
            and exposes window.TruDealer / window.TruShare for triggers. */}
        <TruLoader />
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
