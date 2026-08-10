import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { Maintenance, Property } from '../lib/types';
import { fmtDate, fmtZAR, titleCase } from '../lib/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner } from '../components/ui';

const CATEGORIES = ['plumbing', 'electrical', 'structural', 'appliance', 'pest', 'security', 'garden', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const MAINT_STATUSES = ['reported', 'assigned', 'in_progress', 'awaiting_parts', 'resolved', 'closed'];

const emptyForm = {
  propertyId: '', reportedBy: '', category: 'other', description: '', priority: 'medium',
  estimatedCostZAR: '', assignedTo: '',
};

export default function MaintenancePage() {
  const [jobs, setJobs] = useState<Maintenance[] | null>(null);
  const [props, setProps] = useState<Property[]>([]);
  const [error, setError] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const q = new URLSearchParams();
      if (priority) q.set('priority', priority);
      if (status) q.set('status', status);
      const [m, p] = await Promise.all([
        apiGet<Maintenance[]>(`/api/maintenance${q.toString() ? `?${q}` : ''}`),
        apiGet<Property[]>('/api/properties'),
      ]);
      setJobs(m);
      setProps(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load maintenance jobs.');
    }
  }, [priority, status]);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.propertyId) {
      setFormError('Choose a property.');
      return;
    }
    setFormBusy(true);
    setFormError('');
    try {
      await api('/api/maintenance', {
        method: 'POST',
        body: { ...form, estimatedCostZAR: Number(form.estimatedCostZAR) || 0 },
      });
      setModalOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save job.');
    } finally {
      setFormBusy(false);
    }
  };

  const advance = async (id: string, next: string) => {
    try {
      await api(`/api/maintenance/${id}`, { method: 'PUT', body: { status: next } });
      load();
    } catch {
      /* leave as-is */
    }
  };

  const shown = useMemo(() => jobs ?? [], [jobs]);
  const openCount = shown.filter((j) => j.status !== 'resolved' && j.status !== 'closed').length;
  const urgentCount = shown.filter((j) => j.priority === 'urgent' && j.status !== 'resolved' && j.status !== 'closed').length;

  if (error) return <Empty title="Could not load maintenance" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!jobs) return <Spinner />;

  const propById = new Map(props.map((p) => [p.id, p]));
  const shortAddr = (id: string) => propById.get(id)?.address?.split(',')[0] || '—';

  const priorityTone = (p: string) => (p === 'urgent' ? 'red' : p === 'high' ? 'amber' : 'neutral');
  const statusTone = (s: string) =>
    s === 'resolved' || s === 'closed' ? 'teal' : s === 'in_progress' || s === 'assigned' ? 'amber' : 'neutral';

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-auto">
          <option value="">All priorities</option>
          {PRIORITIES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {MAINT_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
        </Select>
        <p className="text-[13px] text-muted">
          {openCount} open · <span className={urgentCount ? 'text-danger font-medium' : ''}>{urgentCount} urgent</span>
        </p>
        <div className="flex-1" />
        <Button variant="accent" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Log job
        </Button>
      </div>

      {shown.length === 0 ? (
        <Empty title="No maintenance jobs" hint="Log the first job when a tenant reports an issue." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {shown.map((j) => (
            <Card key={j.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-ink tracking-tight truncate">{shortAddr(j.propertyId)}</h3>
                <Badge tone={priorityTone(j.priority)}>{titleCase(j.priority)}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{titleCase(j.category)}</Badge>
                <Badge tone={statusTone(j.status)}>{titleCase(j.status)}</Badge>
              </div>
              {j.description && (
                <p className="mt-3 text-[13px] text-ink-dim leading-relaxed line-clamp-3">{j.description}</p>
              )}
              <div className="mt-3.5 flex items-center justify-between text-[12.5px]">
                <span className="text-muted">
                  Reported {fmtDate(j.reportedDate || j.createdAt)}
                  {j.assignedTo ? ` · ${j.assignedTo}` : ''}
                </span>
                <span className="mono font-semibold text-ink-dim">
                  {j.actualCostZAR > 0 ? fmtZAR(j.actualCostZAR) : j.estimatedCostZAR > 0 ? `${fmtZAR(j.estimatedCostZAR)} est.` : ''}
                </span>
              </div>
              {j.status !== 'resolved' && j.status !== 'closed' && (
                <div className="mt-3 pt-3 border-t border-line/60">
                  <Select
                    value={j.status}
                    onChange={(e) => advance(j.id, e.target.value)}
                    className="h-8 text-[12px]"
                    aria-label="Move job"
                  >
                    <option value="reported">Reported</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In progress</option>
                    <option value="awaiting_parts">Awaiting parts</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </Select>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log maintenance job"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submit} disabled={formBusy}>
              {formBusy ? 'Saving…' : 'Log job'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Property" required>
              <Select value={form.propertyId} onChange={set('propertyId')}>
                <option value="">Choose property…</option>
                {props.map((p) => (
                  <option key={p.id} value={p.id}>{[p.unitNumber, p.address, p.suburb].filter(Boolean).join(', ')}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Category">
            <Select value={form.category} onChange={set('category')}>
              {CATEGORIES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          <Field label="Reported by">
            <Input value={form.reportedBy} onChange={set('reportedBy')} placeholder="Tenant, owner, agent…" />
          </Field>
          <Field label="Assigned to">
            <Input value={form.assignedTo} onChange={set('assignedTo')} placeholder="Handy man, plumber…" />
          </Field>
          <Field label="Estimated cost (ZAR)">
            <Input type="number" value={form.estimatedCostZAR} onChange={set('estimatedCostZAR')} />
          </Field>
          <Field label="Description" hint="What's broken, any urgency notes.">
            <Input value={form.description} onChange={set('description')} />
          </Field>
          {formError && (
            <p className="sm:col-span-2 text-[13px] text-danger bg-danger/10 rounded-[10px] px-3 py-2.5">{formError}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}