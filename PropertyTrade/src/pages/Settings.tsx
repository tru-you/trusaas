import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { Agency } from '../lib/types';
import { AgentBrief } from '../lib/types';
import { Button, Card, CardHeader, Empty, Field, Input, Spinner } from '../components/ui';

export default function Settings({ agent }: { agent: AgentBrief | null }) {
  const [agency, setAgency] = useState<Agency | null>(null);
  const [form, setForm] = useState<Agency | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const isAdmin = agent?.role === 'admin';

  const load = useCallback(async () => {
    setError('');
    try {
      const a = await apiGet<Agency>('/api/agency');
      setAgency(a);
      setForm(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load agency settings.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (k: keyof Agency) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await api('/api/agency', { method: 'PUT', body: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <Empty title="Could not load settings" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!form) return <Spinner />;

  if (!isAdmin) {
    return (
      <Empty
        title="Admins only"
        hint="Only an admin can change the agency profile. Ask one of your admins to open Settings on their side."
      />
    );
  }

  return (
    <form onSubmit={submit} className="max-w-[640px] space-y-5 animate-fade">
      <Card>
        <CardHeader title="Agency profile" sub="Shown on owner statements, leases and correspondence." />
        <div className="px-5 pb-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Agency name" required>
              <Input value={form.name} onChange={set('name')} />
            </Field>
            <Field label="Slug">
              <Input value={form.slug} onChange={set('slug')} />
            </Field>
            <Field label="Region">
              <Input value={form.region ?? ''} onChange={set('region')} placeholder="e.g. Western Cape" />
            </Field>
            <Field label="EAAB ref">
              <Input value={form.eaabRef ?? ''} onChange={set('eaabRef')} />
            </Field>
            <Field label="FICA ref">
              <Input value={form.ficaRef ?? ''} onChange={set('ficaRef')} />
            </Field>
            <Field label="Address">
              <Input value={form.address ?? ''} onChange={set('address')} />
            </Field>
            <Field label="Contact email">
              <Input value={form.contactEmail ?? ''} onChange={set('contactEmail')} type="email" />
            </Field>
            <Field label="Contact phone">
              <Input value={form.contactPhone ?? ''} onChange={set('contactPhone')} />
            </Field>
            <Field label="WhatsApp">
              <Input value={form.whatsapp ?? ''} onChange={set('whatsapp')} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Banking" sub="Where owner payouts go. Statements pull these details." />
        <div className="px-5 pb-5 grid sm:grid-cols-3 gap-4">
          <Field label="Bank">
            <Input value={form.bankName ?? ''} onChange={set('bankName')} />
          </Field>
          <Field label="Account number">
            <Input value={form.bankAccount ?? ''} onChange={set('bankAccount')} />
          </Field>
          <Field label="Branch">
            <Input value={form.bankBranch ?? ''} onChange={set('bankBranch')} />
          </Field>
        </div>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {saved && <p className="text-[13px] font-medium text-accent">Saved</p>}
        <Button variant="accent" type="submit" disabled={saving}>
          <Save size={15} /> {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}