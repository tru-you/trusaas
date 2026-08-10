import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { apiGet } from '../lib/api';
import { titleCase } from '../lib/format';
import { Badge, Button, Card, CardHeader, Empty, Spinner } from '../components/ui';

export interface CalendarItem {
  date: string;
  time?: string;
  type: string;
  title: string;
  sub: string;
  entityId: string;
}

const TYPE_DOT: Record<string, string> = {
  payment: 'bg-danger',
  lease: 'bg-accent',
  viewing: 'bg-slate',
  maintenance: 'bg-amber-400',
  task: 'bg-ink-dim',
};

const dotClass = (type: string) => TYPE_DOT[type] ?? 'bg-slate-soft';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Calendar() {
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string>(toKey(now));

  const load = useCallback(async () => {
    setError('');
    try {
      setItems(await apiGet<CalendarItem[]>('/api/calendar'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load calendar.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items ?? []) {
      const key = it.date.slice(0, 10);
      const list = map.get(key) ?? [];
      list.push(it);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const prev = () => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const next = () => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));

  if (error) return <Empty title="Could not load calendar" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!items) return <Spinner />;

  const selParts = selected.split('-').map(Number);
  const selDate = new Date(selParts[0], selParts[1] - 1, selParts[2]);
  const dayItems = byDay.get(selected) ?? [];

  return (
    <div className="space-y-5 animate-fade">
      <Card>
        <CardHeader
          title={selDate.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
          sub={`${items.length} scheduled item${items.length === 1 ? '' : 's'}`}
          actions={
            <>
              <Button variant="ghost" className="px-3" onClick={prev} aria-label="Previous month">
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" className="px-3" onClick={next} aria-label="Next month">
                <ChevronRight size={16} />
              </Button>
            </>
          }
        />
        <div className="px-5 pb-5">
          <div className="grid grid-cols-7 gap-px">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[11px] font-semibold uppercase tracking-tight text-muted py-2">
                {w}
              </div>
            ))}
            {cells.map((d) => {
              const key = toKey(d);
              const list = byDay.get(key) ?? [];
              const inMonth = d.getMonth() === cursor.m;
              const isSelected = key === selected;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={`text-left rounded-[10px] p-1.5 min-h-[64px] border transition-colors ${
                    isSelected
                      ? 'border-accent bg-accent-soft/50 ring-2 ring-accent-soft'
                      : inMonth
                        ? 'border-line/60 hover:border-accent/40 hover:bg-slate-soft'
                        : 'border-transparent opacity-40'
                  }`}
                >
                  <p className="text-[11.5px] font-medium text-ink-dim">{d.getDate()}</p>
                  {list.length > 0 && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {list.slice(0, 3).map((it, i) => (
                        <span key={i} className={`w-2 h-2 rounded-full ${dotClass(it.type)}`} />
                      ))}
                      <Badge tone="neutral" className="px-1.5 py-0">{list.length}</Badge>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={selDate.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}
          sub={`${dayItems.length} item${dayItems.length === 1 ? '' : 's'}`}
        />
        {dayItems.length === 0 ? (
          <p className="px-5 pb-6 text-[13px] text-muted">Nothing scheduled on this day.</p>
        ) : (
          <div className="px-3 pb-4 space-y-1">
            {dayItems.map((it, i) => (
              <div key={`${it.entityId}-${i}`} className="flex items-center gap-3 px-2.5 py-2.5 rounded-[10px] hover:bg-paper">
                <div className="shrink-0 w-[52px] text-[12.5px] mono text-ink-dim">{it.time || '—'}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold text-ink truncate leading-snug">{it.title}</p>
                  {it.sub && <p className="text-[12px] text-muted truncate">{it.sub}</p>}
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--r-pill)] bg-slate-soft text-slate-deep text-[11px] font-semibold tracking-tight shrink-0">
                  <span className={`w-1.5 h-1.5 rounded-full ${dotClass(it.type)}`} />
                  {titleCase(it.type)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
