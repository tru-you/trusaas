import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Mail, Phone } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { Tenant } from '../lib/types';
import { fmtDate, fmtZAR, initials, titleCase } from '../lib/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner } from '../components/ui';

const FICA_STATUSES = ['pending', 'submitted', 'verified', 'expired'];

const emptyForm = {
  firstName: '', lastName: '', idNumber: '', phone: '', email: '', whatsapp: '',
  emergencyContactName: '', emergencyContactPhone: '', employer: '', employerPhone: '',
  monthlyIncome: '', ficaStatus: 'pending', notes: '',
};

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [fica, setFica] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setTenants(await apiGet<Tenant[]>('/api/tenants'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tenants.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (!tenants) return [];
    const s = search.toLowerCase();
    return tenants.filter((t) => {
      if (fica && t.ficaStatus !== fica) return false;
      if (s && !`${t.firstName} ${t.lastName} ${t.email || ''} ${t.phone || ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [tenants, search, fica]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError('');
    try {
      await api('/api/tenants', {
        method: 'POST',
        body: { ...form, monthlyIncome: Number(form.monthlyIncome) || 0 },
      });
      setModalOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save tenant.');
    } finally {
      setFormBusy(false);
    }
  };

  if (error) return <Empty title="Could not load tenants" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!tenants) return <Spinner />;

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-[340px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="pl-9"
          />
        </div>
        <Select value={fica} onChange={(e) => setFica(e.target.value)} className="w-auto">
          <option value="">All FICA</option>
          {FICA_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
        </Select>
        <div className="flex-1" />
        <Button variant="accent" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add tenant
        </Button>
      </div>

      {visible.length === 0 ? (
        <Empty title="No tenants found" hint="Try a different search or add a new tenant." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((t) => {
            const ficaTone = t.ficaStatus === 'verified' ? 'teal' : t.ficaStatus === 'expired' ? 'red' : 'amber';
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[14px] font-semibold shrink-0">
                    {initials(t.firstName, t.lastName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-semibold text-ink tracking-tight truncate">
                      {t.firstName} {t.lastName}
                    </h3>
                    <p className="text-[12.5px] text-muted truncate">{t.employer || 'No employer on file'}</p>
                  </div>
                  <Badge tone={ficaTone as 'teal' | 'red' | 'amber'}>FICA {titleCase(t.ficaStatus)}</Badge>
                </div>
                <div className="mt-3.5 space-y-1.5 text-[12.5px] text-ink-dim">
                  {t.email && <p className="flex items-center gap-2 truncate"><Mail size={13} className="text-faint shrink-0" /> {t.email}</p>}
                  {t.phone && <p className="flex items-center gap-2"><Phone size={13} className="text-faint shrink-0" /> {t.phone}</p>}
                </div>
                <div className="mt-3.5 pt-3 border-t border-line/60 flex items-center justify-between text-[12.5px]">
                  <span className="text-muted">Income {fmtZAR(t.monthlyIncome)}/mo</span>
                  <span className="text-faint">Joined {fmtDate(t.createdAt)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add tenant"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submit} disabled={formBusy}>
              {formBusy ? 'Saving…' : 'Save tenant'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
          <Field label="First name" required>
            <Input value={form.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="Last name" required>
            <Input value={form.lastName} onChange={set('lastName')} />
          </Field>
          <Field label="ID number">
            <Input value={form.idNumber} onChange={set('idNumber')} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={set('email')} type="email" />
          </Field>
          <Field label="WhatsApp">
            <Input value={form.whatsapp} onChange={set('whatsapp')} />
          </Field>
          <Field label="Employer">
            <Input value={form.employer} onChange={set('employer')} />
          </Field>
          <Field label="Employer phone">
            <Input value={form.employerPhone} onChange={set('employerPhone')} />
          </Field>
          <Field label="Monthly income (ZAR)">
            <Input type="number" value={form.monthlyIncome} onChange={set('monthlyIncome')} />
          </Field>
          <Field label="FICA status">
            <Select value={form.ficaStatus} onChange={set('ficaStatus')}>
              {FICA_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          <Field label="Emergency contact">
            <Input value={form.emergencyContactName} onChange={set('emergencyContactName')} />
          </Field>
          <Field label="Emergency phone">
            <Input value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Input value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering…" />
            </Field>
          </div>
          {formError && (
            <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 rounded-[10px] px-3 py-2.5">{formError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}