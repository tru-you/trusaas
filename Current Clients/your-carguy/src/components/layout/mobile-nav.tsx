"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, Tag, MessageCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { label: string; href: string; icon: typeof Car; external?: boolean }[] = [
  { label: "Stock", href: "/vehicles", icon: Car },
  { label: "Sell", href: "/sell-your-vehicle", icon: Tag },
  { label: "Chat", href: "#", icon: MessageCircle, external: true },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 backdrop-blur-lg border-t border-border safe-area-inset-bottom">
      <div className="flex items-center justify-around h-[64px] max-w-lg mx-auto">
        {TABS.map((tab) => {
          const isActive = tab.href !== "#" ? pathname === tab.href : false;
          const Icon = tab.icon;
          const handleClick = tab.external
            ? () => window.open("https://wa.me/27834659921", "_blank")
            : undefined;

          return tab.external ? (
            <button
              key={tab.label}
              onClick={handleClick}
              className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all min-w-[64px] text-ink-muted hover:text-ink-secondary"
            >
              <Icon className="h-[22px] w-[22px]" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ) : (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all min-w-[64px]",
                isActive ? "text-brand" : "text-ink-muted hover:text-ink-secondary",
              )}
            >
              <Icon className={`h-[22px] w-[22px] ${isActive ? "stroke-[2.5]" : ""}`} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
