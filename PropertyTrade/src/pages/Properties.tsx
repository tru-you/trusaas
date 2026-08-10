import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, MapPin, BedDouble, Bath, CarFront, Pencil } from 'lucide-react';
import { api, apiGet } from '../lib/api';
import { Property } from '../lib/types';
import { fmtZAR, titleCase } from '../lib/format';
import { Badge, Button, Card, Empty, Field, Input, Modal, Select, Spinner } from '../components/ui';

const PURPOSE_OPTIONS = ['rental', 'sale', 'both'];
const TYPE_OPTIONS = ['House', 'Flat', 'Townhouse', 'Estate', 'Farm', 'Commercial'];
const RENTAL_STATUSES = ['vacant', 'occupied', 'maintenance', 'listed'];
const SALES_STATUSES = ['available', 'under-offer', 'sold', 'withdrawn'];

const emptyForm = {
  purpose: 'rental', propertyType: 'House', address: '', unitNumber: '', suburb: '', city: '',
  province: '', postalCode: '', bedrooms: '', bathrooms: '', parking: '', floorArea: '',
  erfNumber: '', monthlyRentZAR: '', depositZAR: '', askingPriceZAR: '',
  rentalStatus: 'vacant', salesStatus: 'available',
};

export default function Properties() {
  const [props, setProps] = useState<Property[] | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [purpose, setPurpose] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setProps(await apiGet<Property[]>('/api/properties'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load listings.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    if (!props) return [];
    const s = search.toLowerCase();
    return props.filter((p) => {
      if (purpose && p.purpose !== purpose && p.purpose !== 'both') return false;
      if (status) {
        const st = p.purpose === 'sale' || p.purpose === 'both' ? p.salesStatus : p.rentalStatus;
        if (st !== status) return false;
      }
      if (s && !`${p.address} ${p.suburb} ${p.city} ${p.propertyType}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [props, search, purpose, status]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormBusy(true);
    setFormError('');
    try {
      await api(editing ? `/api/properties/${editing.id}` : '/api/properties', {
        method: editing ? 'PUT' : 'POST',
        body: {
          ...form,
          bedrooms: Number(form.bedrooms) || 0,
          bathrooms: Number(form.bathrooms) || 0,
          parking: Number(form.parking) || 0,
          floorArea: Number(form.floorArea) || 0,
          monthlyRentZAR: Number(form.monthlyRentZAR) || 0,
          depositZAR: Number(form.depositZAR) || 0,
          askingPriceZAR: Number(form.askingPriceZAR) || 0,
        },
      });
      setModalOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save listing.');
    } finally {
      setFormBusy(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (p: Property) => {
    setEditing(p);
    setForm({
      purpose: p.purpose,
      propertyType: p.propertyType,
      address: p.address,
      unitNumber: p.unitNumber,
      suburb: p.suburb,
      city: p.city,
      province: p.province,
      postalCode: p.postalCode,
      bedrooms: String(p.bedrooms),
      bathrooms: String(p.bathrooms),
      parking: String(p.parking),
      floorArea: String(p.floorArea),
      erfNumber: p.erfNumber,
      monthlyRentZAR: String(p.monthlyRentZAR),
      depositZAR: String(p.depositZAR),
      askingPriceZAR: String(p.askingPriceZAR),
      rentalStatus: p.rentalStatus,
      salesStatus: p.salesStatus,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
  };

  if (error) return <Empty title="Could not load listings" hint={error} action={<Button onClick={load}>Retry</Button>} />;
  if (!props) return <Spinner />;

  return (
    <div className="animate-fade">
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-[340px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address, suburb, city…"
            className="pl-9"
          />
        </div>
        <Select value={purpose} onChange={(e) => { setPurpose(e.target.value); setStatus(''); }} className="w-auto">
          <option value="">All purposes</option>
          {PURPOSE_OPTIONS.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
          <option value="">All statuses</option>
          {(purpose === 'sale' ? SALES_STATUSES : RENTAL_STATUSES).map((o) => (
            <option key={o} value={o}>{titleCase(o)}</option>
          ))}
        </Select>
        <div className="flex-1" />
        <Button variant="accent" onClick={openCreate}>
          <Plus size={16} /> New listing
        </Button>
      </div>

      {visible.length === 0 ? (
        <Empty title="No listings match" hint="Try a different search or add a new listing." />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((p) => {
            const isSale = p.purpose === 'sale' || p.purpose === 'both';
            const isRent = p.purpose === 'rental' || p.purpose === 'both';
            const statusBadge = isSale ? p.salesStatus : p.rentalStatus;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-ink tracking-tight leading-snug">
                    {p.unitNumber ? `${p.unitNumber} ` : ''}{p.address}
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(p)}
                      title="Edit"
                      aria-label={`Edit ${p.address}`}
                      className="w-7 h-7 rounded-[8px] flex items-center justify-center text-muted hover:text-ink hover:bg-slate-soft transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <Badge tone={isSale ? 'ink' : 'teal'}>{titleCase(p.purpose)}</Badge>
                  </div>
                </div>
                <p className="mt-0.5 text-[13px] text-muted flex items-center gap-1">
                  <MapPin size={12} className="text-faint" />
                  {[p.suburb, p.city].filter(Boolean).join(', ') || '—'} · {p.propertyType}
                </p>

                <div className="mt-3 flex items-center gap-4 text-[12.5px] text-ink-dim">
                  <span className="flex items-center gap-1.5"><BedDouble size={14} className="text-faint" /> {p.bedrooms}</span>
                  <span className="flex items-center gap-1.5"><Bath size={14} className="text-faint" /> {p.bathrooms}</span>
                  <span className="flex items-center gap-1.5"><CarFront size={14} className="text-faint" /> {p.parking}</span>
                  {p.floorArea > 0 && <span className="text-faint">{p.floorArea} m²</span>}
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-end justify-between gap-2">
                  <div>
                    {isSale && p.askingPriceZAR > 0 && (
                      <p className="text-[16px] font-semibold mono text-ink">{fmtZAR(p.askingPriceZAR)}</p>
                    )}
                    {isRent && p.monthlyRentZAR > 0 && (
                      <p className="text-[16px] font-semibold mono text-accent">{fmtZAR(p.monthlyRentZAR)}<span className="text-[11px] font-medium text-muted">/mo</span></p>
                    )}
                  </div>
                  <Badge tone={statusBadge === 'sold' || statusBadge === 'occupied' ? 'ink' : statusBadge === 'vacant' || statusBadge === 'under-offer' ? 'amber' : 'teal'}>
                    {titleCase(statusBadge)}
                  </Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit listing' : 'New listing'}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button variant="accent" onClick={submit} disabled={formBusy}>
              {formBusy ? 'Saving…' : 'Save listing'}
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
          <Field label="Purpose" required>
            <Select value={form.purpose} onChange={set('purpose')}>
              {PURPOSE_OPTIONS.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          <Field label="Type" required>
            <Select value={form.propertyType} onChange={set('propertyType')}>
              {TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>
          <Field label="Address" required>
            <Input value={form.address} onChange={set('address')} placeholder="12 Acacia Road" />
          </Field>
          <Field label="Unit number">
            <Input value={form.unitNumber} onChange={set('unitNumber')} placeholder="Flat 2B" />
          </Field>
          <Field label="Suburb" required>
            <Input value={form.suburb} onChange={set('suburb')} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={set('city')} />
          </Field>
          <Field label="Province">
            <Input value={form.province} onChange={set('province')} />
          </Field>
          <Field label="Postal code">
            <Input value={form.postalCode} onChange={set('postalCode')} />
          </Field>
          <Field label="ERF number">
            <Input value={form.erfNumber} onChange={set('erfNumber')} />
          </Field>
          <Field label="Bedrooms">
            <Input type="number" value={form.bedrooms} onChange={set('bedrooms')} />
          </Field>
          <Field label="Bathrooms">
            <Input type="number" value={form.bathrooms} onChange={set('bathrooms')} />
          </Field>
          <Field label="Parking">
            <Input type="number" value={form.parking} onChange={set('parking')} />
          </Field>
          <Field label="Floor area (m²)">
            <Input type="number" value={form.floorArea} onChange={set('floorArea')} />
          </Field>
          <Field label="Monthly rent (ZAR)">
            <Input type="number" value={form.monthlyRentZAR} onChange={set('monthlyRentZAR')} />
          </Field>
          <Field label="Deposit (ZAR)">
            <Input type="number" value={form.depositZAR} onChange={set('depositZAR')} />
          </Field>
          <Field label="Asking price (ZAR)">
            <Input type="number" value={form.askingPriceZAR} onChange={set('askingPriceZAR')} />
          </Field>
          <Field label="Rental status">
            <Select value={form.rentalStatus} onChange={set('rentalStatus')}>
              {RENTAL_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </Select>
          </Field>
          <Field label="Sales status">
            <Select value={form.salesStatus} onChange={set('salesStatus')}>
              {SALES_STATUSES.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
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