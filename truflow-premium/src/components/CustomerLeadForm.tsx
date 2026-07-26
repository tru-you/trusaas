import React, { useState } from "react";
import { createLead } from "../api";
import { Send, CheckCircle, AlertTriangle } from "lucide-react";

interface CustomerLeadFormProps {
  dealershipId: string;
  vehicles: { id: string; make: string; model: string; year: number }[];
  onSuccess?: () => void;
}

export default function CustomerLeadForm({ dealershipId, vehicles, onSuccess }: CustomerLeadFormProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    vehicleId: vehicles.length > 0 ? vehicles[0].id : "",
    notes: "",
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      await createLead({
        ...formData,
        source: "Website Contact Form",
        // status was passed as "New" here, but both createLead and the server's
        // POST /api/leads set it unconditionally — the value never reached
        // anything. Dropped rather than left looking load-bearing.
        dealershipId,
        digitalScore: 50, // Default initial score
      });
      setStatus('success');
      onSuccess && onSuccess();
    } catch (error) {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="card p-6 flex flex-col items-center justify-center text-center gap-4">
        <CheckCircle className="text-[color:var(--cyan)]" size={48} />
        <h2 className="text-xl font-bold text-[color:var(--white)]">Enquiry Received!</h2>
        <p className="text-[16px] text-[rgba(232,234,230,0.72)]">Our sales team will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card p-6 flex flex-col gap-4">
      <h2 className="text-lg font-bold text-[color:var(--white)] mb-2">Dealership Enquiry</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <input type="text" placeholder="First Name" required className="input-field" onChange={e => setFormData(p => ({...p, firstName: e.target.value}))} />
        <input type="text" placeholder="Last Name" required className="input-field" onChange={e => setFormData(p => ({...p, lastName: e.target.value}))} />
      </div>
      <input type="tel" placeholder="Phone Number" required className="input-field" onChange={e => setFormData(p => ({...p, phone: e.target.value}))} />
      <input type="email" placeholder="Email Address" required className="input-field" onChange={e => setFormData(p => ({...p, email: e.target.value}))} />
      
      <select className="input-field" onChange={e => setFormData(p => ({...p, vehicleId: e.target.value}))} value={formData.vehicleId}>
        {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>
        ))}
      </select>
      
      <textarea placeholder="Message/Notes (optional)" className="input-field min-h-[100px]" onChange={e => setFormData(p => ({...p, notes: e.target.value}))} />
      
      <button type="submit" className="btn btn-primary w-full flex items-center justify-center gap-2" disabled={status === 'submitting'}>
        {status === 'submitting' ? "Sending..." : <>Send Enquiry <Send size={14} /></>}
      </button>
      
      {status === 'error' && (
        <div className="flex items-center gap-2 text-[13px] text-[color:var(--muted)] mt-2">
            <AlertTriangle size={14} /> Failed to send enquiry. Please try again.
        </div>
      )}
    </form>
  );
}
