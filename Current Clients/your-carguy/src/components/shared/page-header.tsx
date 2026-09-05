import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  className?: string;
}

export default function PageHeader({ title, subtitle, count, className }: PageHeaderProps) {
  return (
    <section className={cn("px-4 pt-12 pb-8 sm:pt-16 sm:pb-10", className)}>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="mt-2 text-ink-muted">{subtitle}</p>}
          </div>
          {count != null && (
            <div className="shrink-0">
              <span className="inline-flex items-center px-4 py-2 rounded-xl bg-brand-muted border border-brand/20">
                <span className="text-sm font-semibold text-brand">{count}</span>
                <span className="text-xs text-ink-muted ml-1.5">vehicles</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
