import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Plus, Copy, Check } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { Agent } from '../lib/types';
import { fmtDate, initials, titleCase } from '../lib/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner } from '../components/ui';

const ROLES = ['admin', 'manager', 'agent'];

export default function Team({ currentAgentId }: { currentAgentId?: string }) {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('agent');
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [newCode, setNewCode] = useState<{ name: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setAgents(await apiGet<Agent[]>('/api/agents'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the team.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || formBusy) return;
    setFormBusy(true);
    setFormError('');
    try {
      const res = await api<{ agent: Agent; code: string }>('/api/agents', {
        method: 'POST',
        body: { name: name.trim(), role },
      });
      setModalOpen(false);
      setName('');
      setRole('agent');
      setNewCode({ name: res.agent.label, code: res.code });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not add agent.');
    } finally {
      setFormBusy(false);
    }
  };

  const toggleActive = async (a: Agent) => {
    try {
      await api(`/api/agents/${a.id}`, { method: 'PUT', body: { active: !a.active } });
      load();
    } catch {
      /* leave as-is */
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

  if (error) return <Empty title="Could not load the team" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!agents) return <Spinner />;

  return (
    <div className="animate-fade">
      <div className="flex items-center justify-between mb-5">
        <p className="text-[13px] text-muted">
          {agents.length} members · codes are shown once when an agent is added, then never again.
        </p>
        <Button variant="accent" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Add agent
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((a) => {
          const tone = a.role === 'admin' ? 'ink' : a.role === 'manager' ? 'slate' : 'teal';
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[14px] font-semibold shrink-0">
                  {initials(a.label.split(' ')[0], a.label.split(' ')[1])}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-ink tracking-tight truncate">
                    {a.label}
                    {a.id === currentAgentId && <span className="ml-1.5 text-[11px] font-medium text-muted">(you)</span>}
                  </h3>
                  <p className="text-[12.5px] text-muted">Joined {fmtDate(a.createdAt)}</p>
                </div>
                <Badge tone={tone as 'ink' | 'slate' | 'teal'}>{titleCase(a.role)}</Badge>
              </div>
              <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
                <Badge tone={a.active ? 'teal' : 'neutral'}>{a.active ? 'Active' : 'Suspended'}</Badge>
                {a.id !== currentAgentId && (
                  <button
                    onClick={() => toggleActive(a)}
                    className="text-[12.5px] font-medium text-muted hover:text-danger transition-colors"
                  >
                    {a.active ? 'Suspend' : 'Reactivate'}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add agent"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={submit} disabled={formBusy || !name.trim()}>
              {formBusy ? 'Adding…' : 'Create agent'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" autoFocus />
          </Field>
          <Field label="Role" hint="Admins manage the agency and team. Managers run listings and deals.">
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
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
            <span className="font-semibold text-ink">{newCode?.name}</span> signs in with this code.
            Copy it somewhere safe — the server never shows it again.
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
    </div>
  );
}