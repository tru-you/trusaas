import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Copy, Check, RotateCw } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Badge, Button, Card, CardHeader, Empty, Field, Input, Modal, Spinner } from '../components/ui';
import { AgentBrief } from '../lib/types';

const PRODUCTS = ['flowpms', 'prop-lens', 'prop-inspect', 'prop-website', 'trusocial'];

interface AgencyEntry {
  id: string;
  name: string;
  slug: string;
  products: string[];
  websiteUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Master({ agent }: { agent: AgentBrief | null }) {
  const isMaster = agent?.role === 'admin' && !agent?.agencyId;

  const [agencies, setAgencies] = useState<AgencyEntry[] | null>(null);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [selProducts, setSelProducts] = useState<string[]>(['flowpms', 'prop-lens', 'prop-inspect']);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const [newCode, setNewCode] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editAgency, setEditAgency] = useState<AgencyEntry | null>(null);
  const [editProducts, setEditProducts] = useState<string[]>([]);
  const [editFormBusy, setEditFormBusy] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setAgencies(await apiGet<AgencyEntry[]>('/api/master/agencies'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load agencies.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleProduct = (p: string, current: string[], fn: (v: string[]) => void) => {
    fn(current.includes(p) ? current.filter((x) => x !== p) : [...current, p]);
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim() || formBusy) return;
    setFormBusy(true);
    setFormError('');
    try {
      const res = await api<{ agency: AgencyEntry; code: string }>('/api/master/agencies', {
        method: 'POST',
        body: { name: name.trim(), slug: slug.trim(), products: selProducts, websiteUrl: websiteUrl.trim() },
      });
      setCreateOpen(false);
      setName('');
      setSlug('');
      setSelProducts(['flowpms', 'prop-lens', 'prop-inspect']);
      setWebsiteUrl('');
      setNewCode({ name: res.agency.name, code: res.code });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create agency.');
    } finally {
      setFormBusy(false);
    }
  };

  const rotateCode = async (id: string, agencyName: string) => {
    try {
      const res = await api<{ code: string }>(`/api/master/agencies/${id}/rotate`, { method: 'POST' });
      setNewCode({ name: agencyName, code: res.code });
    } catch {
      /* leave as-is */
    }
  };

  const openEdit = (a: AgencyEntry) => {
    setEditAgency(a);
    setEditProducts([...a.products]);
    setEditOpen(true);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editAgency || editFormBusy) return;
    setEditFormBusy(true);
    setEditFormError('');
    try {
      await api(`/api/master/agencies/${editAgency.id}`, {
        method: 'PUT',
        body: { products: editProducts },
      });
      setEditOpen(false);
      load();
    } catch (err) {
      setEditFormError(err instanceof Error ? err.message : 'Could not update.');
    } finally {
      setEditFormBusy(false);
    }
  };

  const copyCode = async () => {
    if (!newCode) return;
    try {
      await navigator.clipboard.writeText(newCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (!isMaster) {
    return <Empty title="Master console only" hint="Sign in as a TruSaaS master to manage agencies." />;
  }

  if (error) return <Empty title="Could not load agencies" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!agencies) return <Spinner />;

  return (
    <div className="animate-fade">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-muted">
          {agencies.length} {agencies.length === 1 ? 'agency' : 'agencies'} · slugs are permanent, passcodes are one-shot.
        </p>
        <Button variant="accent" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Create agency
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {agencies.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-ink tracking-tight truncate">{a.name}</h3>
                <p className="text-[12.5px] font-mono text-muted mt-0.5">{a.slug}</p>
              </div>
              <Badge>{a.products.length} product{a.products.length !== 1 ? 's' : ''}</Badge>
            </div>

            {a.products.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {a.products.map((p) => (
                  <span key={p} className="inline-block text-[11px] font-medium bg-accent-soft text-accent px-2 py-0.5 rounded-full">
                    {p}
                  </span>
                ))}
              </div>
            )}

            <p className="text-[11px] text-faint mt-3">Created {fmtDate(a.createdAt)}</p>

            <div className="mt-4 pt-3 border-t border-line/60 flex items-center gap-2">
              <Button variant="ghost" className="text-[12.5px] h-8 px-3" onClick={() => openEdit(a)}>
                Products
              </Button>
              <Button variant="ghost" className="text-[12.5px] h-8 px-3" onClick={() => rotateCode(a.id, a.name)}>
                <RotateCw size={13} /> Rotate code
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create agency"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submitCreate} disabled={formBusy || !name.trim() || !slug.trim()}>
              {formBusy ? 'Creating…' : 'Create agency'}
            </Button>
          </>
        }
      >
        <form onSubmit={submitCreate} className="space-y-4">
          <Field label="Agency name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Stone Heights" autoFocus />
          </Field>
          <Field label="Slug" required hint="Lowercase letters, numbers and dashes — permanent once created.">
            <Input value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))} placeholder="stone-heights" />
          </Field>
          <Field label="Products" hint="What this agency is entitled to use.">
            <div className="flex flex-wrap gap-2">
              {PRODUCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProduct(p, selProducts, setSelProducts)}
                  className={`text-[12.5px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    selProducts.includes(p)
                      ? 'bg-accent border-accent text-white'
                      : 'border-line text-muted hover:border-slate-deep hover:text-ink'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Website URL" hint="The agency's public site (optional).">
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://stoneheights.co.za" />
          </Field>
          {formError && <p className="text-[13px] text-danger bg-danger/10 rounded-[10px] px-3 py-2.5">{formError}</p>}
        </form>
      </Modal>

      <Modal
        open={!!newCode}
        onClose={() => setNewCode(null)}
        title="Access code — shown once"
        footer={<Button variant="primary" onClick={() => setNewCode(null)}>Got it</Button>}
      >
        <div className="flex flex-col items-center text-center">
          <p className="text-[13.5px] text-muted">
            <span className="font-semibold text-ink">{newCode?.name}</span> principal passcode. Copy it somewhere safe — the server never shows it again.
          </p>
          <div className="mt-5 w-full bg-paper rounded-[14px] border border-line px-5 py-4">
            <p className="text-[26px] font-semibold mono tracking-[0.25em] text-ink">{newCode?.code}</p>
          </div>
          <Button variant="ghost" className="mt-4" onClick={copyCode}>
            {copied ? <Check size={16} className="text-accent" /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy code'}
          </Button>
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editAgency ? `Edit products — ${editAgency.name}` : ''}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submitEdit} disabled={editFormBusy}>
              {editFormBusy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form onSubmit={submitEdit} className="space-y-4">
          <Field label="Products">
            <div className="flex flex-wrap gap-2">
              {PRODUCTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleProduct(p, editProducts, setEditProducts)}
                  className={`text-[12.5px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    editProducts.includes(p)
                      ? 'bg-accent border-accent text-white'
                      : 'border-line text-muted hover:border-slate-deep hover:text-ink'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
          {editFormError && <p className="text-[13px] text-danger bg-danger/10 rounded-[10px] px-3 py-2.5">{editFormError}</p>}
        </form>
      </Modal>
    </div>
  );
}