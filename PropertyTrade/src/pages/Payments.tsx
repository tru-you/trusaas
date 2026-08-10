import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { ArrearsRow, Lease, Payment, Property, Tenant } from '../lib/types';
import { fmtZAR, titleCase } from '../lib/format';
import { Badge, Button, Card, CardHeader, Empty, Field, Input, Modal, Select, Spinner } from '../components/ui';

const PAYMENT_STATUSES = ['received', 'pending', 'bounced', 'reversed'];
const METHODS = ['eft', 'cash', 'debit_order', 'card', 'other'];

const currentMonth = () => new Date().toISOString().slice(0, 7);

const emptyForm = {
  leaseId: '', amountZAR: '', dueDate: currentMonth(), method: 'eft', status: 'received', reference: '', notes: '',
};

export default function Payments() {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [arrears, setArrears] = useState<ArrearsRow[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [props, setProps] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(currentMonth());
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const q = new URLSearchParams({ month });
      if (status) q.set('status', status);
      const [p, a, l, pr, t] = await Promise.all([
        apiGet<Payment[]>(`/api/payments?${q}`),
        apiGet<ArrearsRow[]>('/api/payments/arrears'),
        apiGet<Lease[]>('/api/leases?status=active'),
        apiGet<Property[]>('/api/properties'),
        apiGet<Tenant[]>('/api/tenants'),
      ]);
      setPayments(p);
      setArrears(a);
      setLeases(l);
      setProps(pr);
      setTenants(t);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payments.');
    }
  }, [month, status]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onLeasePick = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lid = e.target.value;
    const l = leases.find((x) => x.id === lid);
    setForm((f) => ({
      ...f,
      leaseId: lid,
      amountZAR: l?.monthlyRentZAR ? String(l.monthlyRentZAR) : f.amountZAR,
    }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.leaseId) {
      setFormError('Choose a lease.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      await api('/api/payments', {
        method: 'POST',
        body: { ...form, amountZAR: Number(form.amountZAR) || 0 },
      });
      setModalOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not record payment.');
    } finally {
      setFormBusy(false);
    }
  };

  const flipStatus = async (id: string, next: string) => {
    try {
      await api(`/api/payments/${id}`, { method: 'PUT', body: { status: next } });
      load();
    } catch {
      /* leave as-is */
    }
  };

  const shown = useMemo(() => payments ?? [], [payments]);
  const receivedSum = shown.filter((p) => p.status === 'received').reduce((s, p) => s + p.amountZAR, 0);
  const bouncedCount = shown.filter((p) => p.status === 'bounced').length;
  const arrearsTotal = arrears.reduce((s, a) => s + a.outstandingZAR, 0);

  if (error) return <Empty title="Could not load payments" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!payments) return <Spinner />;

  const propById = new Map(props.map((p) => [p.id, p]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const shortAddr = (id?: string) => propById.get(id ?? '')?.address?.split(',')[0] || '—';
  const tenantName = (id?: string) => {
    const t = tenantById.get(id ?? '');
    return t ? `${t.firstName} ${t.lastName}` : '—';
  };

  const statusTone = (s: string) => (s === 'received' ? 'teal' : s === 'reversed' ? 'neutral' : s === 'bounced' ? 'red' : 'amber');

  return (
    <div className="animate-fade">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <Card className="p-4">
          <p className="text-[11.5px] text-muted uppercase tracking-tight font-medium">Received {month}</p>
          <p className="mt-1 text-[20px] font-semibold mono text-accent">{fmtZAR(receivedSum)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted uppercase tracking-tight font-medium">Bounced</p>
          <p className={`mt-1 text-[20px] font-semibold mono ${bouncedCount ? 'text-danger' : 'text-ink'}`}>{bouncedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted uppercase tracking-tight font-medium">Arrears now</p>
          <p className={`mt-1 text-[20px] font-semibold mono ${arrears.length ? 'text-danger' : 'text-ink'}`}>
            {arrears.length > 0 ? `${arrears.length} leases` : 'None'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted uppercase tracking-tight font-medium">Arrears value</p>
          <p className={`mt-1 text-[20px] font-semibold mono ${arrearsTotal ? 'text-danger' : 'text-ink'}`}>{fmtZAR(arrearsTotal)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
        </Select>
        <div className="flex-1" />
        <Button variant="accent" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Record payment
        </Button>
      </div>

      {shown.length === 0 ? (
        <Empty title="No payments for this month" hint="Record the first collection when the tenant pays." />
      ) : (
        <Card>
          <CardHeader title={`Payments · ${month}`} sub={`${shown.length} entries · ${fmtZAR(receivedSum)} received`} />
          <div className="px-2 pb-3 space-y-1.5">
            {shown.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-paper transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink tracking-tight truncate">{shortAddr(p.propertyId)}</p>
                  <p className="text-[12.5px] text-muted truncate">{tenantName(p.tenantId)} · {titleCase(p.method)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-semibold mono text-ink">{fmtZAR(p.amountZAR)}</p>
                  <p className="text-[11px] text-faint mono">{p.dueDate}{p.reference ? ` · ${p.reference}` : ''}</p>
                </div>
                <Select
                  value={p.status}
                  onChange={(e) => flipStatus(p.id, e.target.value)}
                  className={`w-auto h-8 px-2 text-[12px] ${p.status === 'bounced' ? 'text-danger' : ''}`}
                  aria-label="Payment status"
                >
                  {PAYMENT_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
                </Select>
                <Badge tone={statusTone(p.status)}>{titleCase(p.status)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record payment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submit} disabled={formBusy}>
              {formBusy ? 'Saving…' : 'Record payment'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Lease" required>
              <Select value={form.leaseId} onChange={onLeasePick}>
                <option value="">Choose lease…</option>
                {leases.map((l) => (
                  <option key={l.id} value={l.id}>
                    {propById.get(l.propertyId)?.address?.split(',')[0] || '—'} · {tenantName(l.tenantId)} · {fmtZAR(l.monthlyRentZAR)}/mo
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Amount (ZAR)" required>
            <Input type="number" value={form.amountZAR} onChange={set('amountZAR')} />
          </Field>
          <Field label="Due month" required>
            <Input type="month" value={form.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label="Method">
            <Select value={form.method} onChange={set('method')}>
              {METHODS.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set('status')}>
              {PAYMENT_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          <Field label="Reference">
            <Input value={form.reference} onChange={set('reference')} placeholder="EFT reference" />
          </Field>
          <Field label="Notes">
            <Input value={form.notes} onChange={set('notes')} />
          </Field>
          {formError && (
            <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 rounded-[10px] px-3 py-2.5">{formError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}