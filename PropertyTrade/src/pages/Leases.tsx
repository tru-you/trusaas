import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, KeyRound, CalendarRange } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { Lease, Property, Tenant } from '../lib/types';
import { fmtDate, fmtZAR, titleCase } from '../lib/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner } from '../components/ui';

const LEASE_STATUSES = ['draft', 'active', 'expiring', 'expired', 'terminated'];

const emptyForm = {
  propertyId: '', tenantId: '', startDate: '', endDate: '', monthlyRentZAR: '',
  annualEscalation: '', depositZAR: '', depositBankName: '', depositAccountNumber: '',
  depositPaidDate: '', depositReceiptSentDate: '', moveInDate: '', status: 'draft',
};

export default function Leases() {
  const [leases, setLeases] = useState<Lease[] | null>(null);
  const [props, setProps] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (expiringOnly) q.set('expiring', 'true');
      const [l, p, t] = await Promise.all([
        apiGet<Lease[]>(`/api/leases${q.toString() ? `?${q}` : ''}`),
        apiGet<Property[]>('/api/properties'),
        apiGet<Tenant[]>('/api/tenants'),
      ]);
      setLeases(l);
      setProps(p);
      setTenants(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load leases.');
    }
  }, [status, expiringOnly]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onPropertyPick = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    const p = props.find((x) => x.id === pid);
    setForm((f) => ({
      ...f,
      propertyId: pid,
      monthlyRentZAR: p?.monthlyRentZAR ? String(p.monthlyRentZAR) : f.monthlyRentZAR,
      depositZAR: p?.depositZAR ? String(p.depositZAR) : f.depositZAR,
    }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.propertyId || !form.tenantId) {
      setFormError('Choose a property and a tenant.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      await api('/api/leases', {
        method: 'POST',
        body: {
          ...form,
          monthlyRentZAR: Number(form.monthlyRentZAR) || 0,
          annualEscalation: Number(form.annualEscalation) || 0,
          depositZAR: Number(form.depositZAR) || 0,
        },
      });
      setModalOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save lease.');
    } finally {
      setFormBusy(false);
    }
  };

  const rendered = useMemo(() => leases ?? [], [leases]);

  if (error) return <Empty title="Could not load leases" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!leases) return <Spinner />;

  const propById = new Map(props.map((p) => [p.id, p]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const shortAddr = (id: string) => propById.get(id)?.address?.split(',')[0] || '—';

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {LEASE_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
        </Select>
        <button
          onClick={() => setExpiringOnly((v) => !v)}
          className={`px-3.5 h-10 rounded-[10px] text-[13px] font-medium tracking-tight transition-colors border ${
            expiringOnly ? 'bg-accent-soft text-accent border-accent/30' : 'bg-card text-muted border-line hover:text-ink'
          }`}
        >
          Expiring within 60 days
        </button>
        <div className="flex-1" />
        <Button variant="accent" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New lease
        </Button>
      </div>

      {rendered.length === 0 ? (
        <Empty title="No leases here" hint="Match a property and tenant to start a lease." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rendered.map((l) => {
            const tone =
              l.status === 'active' ? 'teal' : l.status === 'expiring' ? 'amber' : l.status === 'terminated' ? 'red' : 'neutral';
            return (
              <Card key={l.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink tracking-tight truncate">{shortAddr(l.propertyId)}</h3>
                    <p className="text-[13px] text-muted truncate">
                      {tenantById.get(l.tenantId) ? `${tenantById.get(l.tenantId)!.firstName} ${tenantById.get(l.tenantId)!.lastName}` : '—'}
                    </p>
                  </div>
                  <Badge tone={tone as 'teal' | 'amber' | 'red' | 'neutral'}>{titleCase(l.status)}</Badge>
                </div>

                <div className="mt-3.5 flex items-center gap-2 text-[12.5px] text-ink-dim">
                  <CalendarRange size={13} className="text-faint shrink-0" />
                  <span className="mono">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5 text-[13px]">
                  <div className="bg-paper rounded-[10px] px-3 py-2">
                    <p className="text-[11px] text-muted uppercase tracking-tight font-medium">Rent</p>
                    <p className="font-semibold mono text-ink">{fmtZAR(l.monthlyRentZAR)}<span className="text-[11px] font-medium text-muted">/mo</span></p>
                  </div>
                  <div className="bg-paper rounded-[10px] px-3 py-2">
                    <p className="text-[11px] text-muted uppercase tracking-tight font-medium">Deposit</p>
                    <p className="font-semibold mono text-ink">{fmtZAR(l.depositZAR)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {l.depositReceiptOverdue && <Badge tone="red">Receipt overdue</Badge>}
                  {l.depositRefundOverdue && <Badge tone="red">Refund overdue</Badge>}
                  {!l.depositReceiptOverdue && !l.depositRefundOverdue && l.depositPaidDate && (
                    <Badge tone="teal">Deposit paid {fmtDate(l.depositPaidDate)}</Badge>
                  )}
                  {!l.depositPaidDate && <Badge tone="neutral">Deposit unsettled</Badge>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New lease"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submit} disabled={formBusy}>
              {formBusy ? 'Saving…' : 'Save lease'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
          <Field label="Property" required>
            <Select value={form.propertyId} onChange={onPropertyPick}>
              <option value="">Choose property…</option>
              {props.map((p) => (
                <option key={p.id} value={p.id}>{[p.unitNumber, p.address, p.suburb].filter(Boolean).join(', ')}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tenant" required>
            <Select value={form.tenantId} onChange={set('tenantId')}>
              <option value="">Choose tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Start date">
            <Input type="date" value={form.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="End date">
            <Input type="date" value={form.endDate} onChange={set('endDate')} />
          </Field>
          <Field label="Monthly rent (ZAR)">
            <Input type="number" value={form.monthlyRentZAR} onChange={set('monthlyRentZAR')} />
          </Field>
          <Field label="Annual escalation %">
            <Input type="number" value={form.annualEscalation} onChange={set('annualEscalation')} />
          </Field>
          <Field label="Deposit (ZAR)">
            <Input type="number" value={form.depositZAR} onChange={set('depositZAR')} />
          </Field>
          <Field label="Deposit bank">
            <Input value={form.depositBankName} onChange={set('depositBankName')} />
          </Field>
          <Field label="Deposit account no.">
            <Input value={form.depositAccountNumber} onChange={set('depositAccountNumber')} />
          </Field>
          <Field label="Deposit paid date">
            <Input type="date" value={form.depositPaidDate} onChange={set('depositPaidDate')} />
          </Field>
          <Field label="Deposit receipt sent">
            <Input type="date" value={form.depositReceiptSentDate} onChange={set('depositReceiptSentDate')} />
          </Field>
          <Field label="Move-in date">
            <Input type="date" value={form.moveInDate} onChange={set('moveInDate')} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {LEASE_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          {formError && (
            <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 rounded-[10px] px-3 py-2.5">{formError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}