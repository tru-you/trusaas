import { authFetch } from "./lib/session";
import { Vehicle, Lead, Task, Invoice, Agreement, DealerDocument, User, Communication, Expense, DMSState } from "./types";

const DEFAULT_MOCK_STATE: DMSState = {
  dealerships: [
    { id: 'd1', name: 'MKR Auto Sales', location: 'Johannesburg' },
    { id: 'd2', name: 'Cars on Caledon', location: 'Kariega, Eastern Cape' }
  ],
  documents: [],
  digitalProducts: [],
  digitalSales: [],
  vehicles: [
    { 
      id: 'v1', year: 2023, make: 'Ford', model: 'Ranger', trim: 'Wildtrak', status: 'INVENTORY', retailPrice: 685000, costPrice: 580000, mileage: 18400, transmission: 'Automatic', fuelType: 'Diesel', stockNumber: 'PE-1042', dateAcquired: '2026-07-05', daysInInventory: 8, description: 'Single owner clean condition wildtrak. Full service history at Ford.',
      images: [],
      reconTasks: [
        { id: 'rc-1', name: 'Premium Polish & Buffing', cost: 1800, status: 'Completed', dateAdded: '2026-07-06' },
        { id: 'rc-2', name: 'Windscreen Chip Repair', cost: 1200, status: 'In Progress', dateAdded: '2026-07-08' }
      ]
    },
    { 
      id: 'v2', year: 2022, make: 'Volkswagen', model: 'Golf', trim: 'GTI', status: 'INVENTORY', retailPrice: 485000, costPrice: 410000, mileage: 24100, transmission: 'Automatic', fuelType: 'Petrol', stockNumber: 'PE-1038', dateAcquired: '2026-07-01', daysInInventory: 14, description: 'Volkswagen Golf GTI DSG. Finished in Pure White with tartan sports seats, sunroof, and active info display.',
      images: [],
      reconTasks: [
        { id: 'rc-3', name: 'Front Brake Pads Replacement', cost: 2400, status: 'Completed', dateAdded: '2026-07-02' }
      ]
    },
    { 
      id: 'v3', year: 2023, make: 'Toyota', model: 'Hilux', trim: 'Legend', status: 'INVENTORY', retailPrice: 612000, costPrice: 530000, mileage: 9800, transmission: 'Automatic', fuelType: 'Diesel', stockNumber: 'CT-2091', dateAcquired: '2026-07-10', daysInInventory: 5, description: 'Excellent utility truck with full canopy cover, roller shutter, and premium audio.',
      images: [],
      reconTasks: []
    },
    { 
      id: 'v4', year: 2021, make: 'BMW', model: 'X5', trim: 'xDrive30d', status: 'PENDING', retailPrice: 945000, costPrice: 830000, mileage: 52300, transmission: 'Automatic', fuelType: 'Diesel', stockNumber: 'PE-1015', dateAcquired: '2026-06-03', daysInInventory: 42, description: 'Sophisticated dark black metallic finish with premium luxury leather upholstery, panoroma roof.',
      images: [],
      reconTasks: [
        { id: 'rc-4', name: 'Leather Seat Reconditioning', cost: 3500, status: 'Completed', dateAdded: '2026-06-05' }
      ]
    },
    { 
      id: 'v5', year: 2022, make: 'Isuzu', model: 'D-Max', trim: 'X-Rider', status: 'SOLD', retailPrice: 558000, costPrice: 480000, mileage: 31200, transmission: 'Manual', fuelType: 'Diesel', stockNumber: 'PE-1029', dateAcquired: '2026-07-12', daysInInventory: 3, description: 'Strong workhorse with low fuel consumption indexes and modern canopy safety setup.',
      images: [],
      reconTasks: []
    },
    { 
      id: 'v6', year: 2023, make: 'Toyota', model: 'Corolla', trim: 'Cross XR', status: 'INVENTORY', retailPrice: 459000, costPrice: 390000, mileage: 12600, transmission: 'Automatic', fuelType: 'Petrol', stockNumber: 'CT-2103', dateAcquired: '2026-07-04', daysInInventory: 11, description: 'Crossover urban build with advanced hybrid integration features and Toyota Safety Sense.',
      images: [],
      reconTasks: []
    }
  ],
  leads: [
    { 
      id: 'l1', firstName: 'David', lastName: 'Moyo', phone: '082 441 9012', email: 'david.moyo@gmail.com', vehicleId: 'v4', source: 'Website', status: 'Negotiating', assignedUserId: 'u1', createdAt: '2026-07-08', lastContactedAt: '2026-07-14', digitalScore: 92, notes: 'Interested in structural trade-in credit assessments for his older Ranger.',
      journey: [
        { time: "10:32 AM", action: "Navigated Floor Catalog", detail: "Applied Filter [Price Range: Sub-R1,000,000]" },
        { time: "10:38 AM", action: "Focused Vehicle Detail", detail: "Subject Asset: 2021 BMW X5" },
        { time: "10:45 AM", action: "Completed Digital Installment Form", detail: "Modeled installment schedule on standard parameters." }
      ]
    },
    { 
      id: 'l2', firstName: 'Thabo', lastName: 'Ndlovu', phone: '071 552 3348', email: 'thabo@gmail.com', vehicleId: 'v2', source: 'Walk-in', status: 'Test Drive Scheduled', assignedUserId: 'u1', createdAt: '2026-07-12', lastContactedAt: '2026-07-13', digitalScore: 88, notes: 'Requested Saturday morning slots to inspect suspension & engine bay.',
      journey: [
        { time: "11:15 AM", action: "Walk-in registration", detail: "Greeted at showroom by Aiden" },
        { time: "11:25 AM", action: "Static inspect", detail: "Spent 20 minutes inspecting Golf GTI interior & panel alignments" }
      ]
    },
    { 
      id: 'l3', firstName: 'Linda', lastName: 'Khumalo', phone: '083 219 7765', email: 'linda.k@yahoo.com', vehicleId: 'v6', source: 'Facebook', status: 'Contacted', assignedUserId: 'u2', createdAt: '2026-07-10', lastContactedAt: '2026-07-11', digitalScore: 68, notes: 'Query regarding Corolla Cross hybrid model battery replacement warranties.',
      journey: [
        { time: "08:14 PM", action: "Facebook Lead Gen Form", detail: "Submitted ad query on Hybrid Tech" }
      ]
    },
    { 
      id: 'l4', firstName: 'Riaan', lastName: 'Botha', phone: '084 662 5510', email: 'riaan@bothabuilding.co.za', vehicleId: 'v3', source: 'AutoTrader', status: 'New', assignedUserId: 'u3', createdAt: '2026-07-14', lastContactedAt: null, digitalScore: 54, notes: 'Wants business asset write-off tax documents for his construction fleet.',
      journey: [
        { time: "04:50 PM", action: "AutoTrader Lead API", detail: "Transferred lead focus on Hilux Legend" }
      ]
    }
  ],
  tasks: [
    { id: 't1', title: 'Verify test drive parameters with Thabo', leadId: 'l2', vehicleId: 'v2', assignedUserId: 'u1', dueDate: '2026-07-16', priority: 'Urgent', status: 'Pending' },
    { id: 't2', title: 'Deliver pre-sale checklist packet to David', leadId: 'l1', vehicleId: 'v4', assignedUserId: 'u2', dueDate: '2026-07-18', priority: 'High', status: 'In Progress' },
    { id: 't3', title: 'Validate credit authorization documents for Linda', leadId: 'l3', vehicleId: 'v6', assignedUserId: 'u2', dueDate: '2026-07-20', priority: 'Normal', status: 'Pending' }
  ],
  invoices: [
    { id: 'inv-1', invoiceNumber: 'INV-2026-0047', leadId: 'l1', vehicleId: 'v4', amount: 945000, paymentMethod: 'Dealer Finance', status: 'Sent', dueDate: '2026-07-28' },
    { id: 'inv-2', invoiceNumber: 'INV-2026-0043', leadId: 'l2', vehicleId: 'v2', amount: 485000, paymentMethod: 'Bank Transfer', status: 'Paid', dueDate: '2026-07-15' }
  ],
  agreements: [
    { id: 'agr-1', agreementNumber: 'AGR-2026-0012', leadId: 'l1', vehicleId: 'v4', purchasePrice: 945000, depositAmount: 50000, type: 'Vehicle Sale', status: 'Pending Signature' }
  ],
  users: [
    { id: 'u1', name: 'Aiden Fourie', email: 'aiden@true-cars.co.za', role: 'salesperson', phone: '082 441 0021', isActive: true },
    { id: 'u2', name: 'Zanele Booi', email: 'zanele@true-cars.co.za', role: 'salesperson', phone: '083 552 8834', isActive: true },
    { id: 'u3', name: 'Zack Daniels', email: 'zack@true-cars.co.za', role: 'manager', phone: '084 219 6602', isActive: true }
  ],
  communications: [
    { id: 'c1', leadId: 'l1', type: 'email', subject: 'Pre-Approved Financing Packages', content: 'Here are the pre-approved options for the BMW X5. Let me know if we can sign.', sentBy: 'Aiden Fourie', sentAt: '2026-07-12' },
    { id: 'c2', leadId: 'l2', type: 'whatsapp', subject: 'WhatsApp Follow-Up', content: 'Hi Thabo, confirmed Saturday morning test drive details for Golf GTI. See you then!', sentBy: 'Aiden Fourie', sentAt: '2026-07-13' }
  ],
  expenses: [
    { id: 'exp-1', description: 'Sandton Showroom Monthly Lease', amount: 45000, date: '2026-07-01', category: 'Rent', referenceId: '', reconciled: true },
    { id: 'exp-2', description: 'Google Local Ads Campaign', amount: 12000, date: '2026-07-05', category: 'Marketing', referenceId: '', reconciled: true },
    { id: 'exp-3', description: 'Sutherland Detailing Equipment', amount: 4800, date: '2026-07-08', category: 'Operations', referenceId: 'PE-1042', reconciled: false },
    { id: 'exp-4', description: 'Eskom Electricity Grid Levy', amount: 8400, date: '2026-07-12', category: 'Utilities', referenceId: '', reconciled: false }
  ],
  settings: {
    websitePortal: true,
    trueAI: true,
    smartLedger: true,
    chatbot: true,
    seoAeo: true,
    syndication: true,
    liveReceptionist: true
  }
};

/**
 * Load DMS state from the TruFlow server (data.json).
 * This is what receives TruLens "Export to DMS" pushes — NOT browser localStorage alone.
 */
export async function fetchState(): Promise<DMSState> {
  try {
    const res = await authFetch("/api/state", { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as DMSState;
      // Keep a browser cache for offline fallback only
      try {
        localStorage.setItem("dms_state", JSON.stringify(data));
      } catch {
        /* ignore quota errors from large base64 photos */
      }
      return data;
    }
    console.warn("fetchState: /api/state returned", res.status);
  } catch (err) {
    console.warn("fetchState: server unavailable, trying localStorage", err);
  }

  const local = localStorage.getItem("dms_state");
  if (local) {
    try {
      return JSON.parse(local) as DMSState;
    } catch {
      /* fall through */
    }
  }
  localStorage.setItem("dms_state", JSON.stringify(DEFAULT_MOCK_STATE));
  return DEFAULT_MOCK_STATE;
}

async function updateState(mutator: (state: DMSState) => void): Promise<DMSState> {
  // Prefer server truth, mutate, then try to persist vehicle updates via API
  const state = await fetchState();
  mutator(state);
  try {
    localStorage.setItem("dms_state", JSON.stringify(state));
  } catch {
    /* ignore */
  }
  return state;
}

export async function resetState(): Promise<DMSState> {
  try {
    const res = await authFetch("/api/state/reset", { method: "POST" });
    if (res.ok) {
      const body = await res.json();
      const next = (body.state || DEFAULT_MOCK_STATE) as DMSState;
      localStorage.setItem("dms_state", JSON.stringify(next));
      return next;
    }
  } catch (err) {
    console.warn("resetState server failed", err);
  }
  localStorage.setItem("dms_state", JSON.stringify(DEFAULT_MOCK_STATE));
  return DEFAULT_MOCK_STATE;
}

/** Force reload from server (call after TruLens export). */
export async function refreshFromServer(): Promise<DMSState> {
  const res = await authFetch("/api/state", { cache: "no-store" });
  if (!res.ok) throw new Error(`DMS server refresh failed (${res.status})`);
  const data = (await res.json()) as DMSState;
  try {
    localStorage.setItem("dms_state", JSON.stringify(data));
  } catch {
    /* ignore */
  }
  return data;
}

export async function updateSettings(settings: Partial<DMSState['settings']>): Promise<DMSState['settings']> {
  const state = await updateState(s => { Object.assign(s.settings, settings); });
  return state.settings;
}

export async function createVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
  // Persist to server first — a local-only push here used to get silently
  // wiped by the very next fetchState() (server truth wins), so vehicles
  // added via this form never actually survived a refresh.
  try {
    const res = await authFetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vehicle),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.vehicle) return body.vehicle as Vehicle;
    }
  } catch (err) {
    console.warn("createVehicle server failed, local fallback", err);
  }

  const newV = { ...vehicle, id: 'v' + Date.now(), status: vehicle.status || 'INVENTORY' } as Vehicle;
  await updateState(s => s.vehicles.push(newV));
  return newV;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
  // Persist to server so TruLens-exported photos and edits stay in sync
  try {
    const res = await authFetch(`/api/inventory/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.vehicle) return body.vehicle as Vehicle;
    }
  } catch (err) {
    console.warn("updateVehicle server failed, local fallback", err);
  }

  let updatedV;
  await updateState(s => {
    const idx = s.vehicles.findIndex(v => v.id === id);
    if (idx !== -1) {
      s.vehicles[idx] = { ...s.vehicles[idx], ...updates };
      updatedV = s.vehicles[idx];
    }
  });
  if (!updatedV) throw new Error("Not found");
  return updatedV;
}

export async function addReconTask(vehicleId: string, task: Omit<Vehicle['reconTasks'][0], 'id'>) {
  const newTask = { ...task, id: 'rc-' + Date.now() };
  await updateState(s => {
    const v = s.vehicles.find(v => v.id === vehicleId);
    if (v) {
      if (!v.reconTasks) v.reconTasks = [];
      v.reconTasks.push(newTask);
    }
  });
  return newTask;
}

export async function updateReconTask(vehicleId: string, taskId: string, updates: Partial<Vehicle['reconTasks'][0]>) {
  let updated;
  await updateState(s => {
    const v = s.vehicles.find(v => v.id === vehicleId);
    if (v && v.reconTasks) {
      const idx = v.reconTasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        v.reconTasks[idx] = { ...v.reconTasks[idx], ...updates };
        updated = v.reconTasks[idx];
      }
    }
  });
  return updated;
}

export async function createLead(lead: Omit<Lead, "id" | "createdAt" | "lastContactedAt" | "status" | "assignedUserId" | "digitalScore">): Promise<Lead> {
  const newL = { 
    ...lead, 
    id: 'l' + Date.now(), 
    createdAt: new Date().toISOString(), 
    lastContactedAt: new Date().toISOString(),
    status: 'New' as const,
    assignedUserId: 'u1',
    digitalScore: 50
  } as Lead;
  await updateState(s => s.leads.push(newL));
  return newL;
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  let updated;
  await updateState(s => {
    const idx = s.leads.findIndex(l => l.id === id);
    if (idx !== -1) {
      s.leads[idx] = { ...s.leads[idx], ...updates };
      updated = s.leads[idx];
    }
  });
  if (!updated) throw new Error("Not found");
  return updated;
}

export async function createTask(task: Omit<Task, "id">): Promise<Task> {
  const newT = { ...task, id: 't' + Date.now() } as Task;
  await updateState(s => s.tasks.push(newT));
  return newT;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  let updated;
  await updateState(s => {
    const idx = s.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      s.tasks[idx] = { ...s.tasks[idx], ...updates };
      updated = s.tasks[idx];
    }
  });
  return updated as Task;
}

export async function createInvoice(invoice: Omit<Invoice, "id" | "invoiceNumber">): Promise<Invoice> {
  const newI = { ...invoice, id: 'inv' + Date.now(), invoiceNumber: 'INV-' + Date.now() } as Invoice;
  await updateState(s => s.invoices.push(newI));
  return newI;
}

export async function createAgreement(agreement: Omit<Agreement, "id" | "agreementNumber">): Promise<Agreement> {
  const newA = { ...agreement, id: 'agr' + Date.now(), agreementNumber: 'AGR-' + Date.now() } as Agreement;
  await updateState(s => s.agreements.push(newA));
  return newA;
}

/** Upload a dealer's own document (any file type/template) — persisted server-side. */
export async function uploadDocument(doc: {
  fileName: string;
  mimeType: string;
  fileData: string;
  leadId?: string;
  vehicleId?: string;
  dealershipId?: string;
}): Promise<DealerDocument> {
  const res = await authFetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error(`Document upload failed (${res.status})`);
  const body = await res.json();
  return body.document as DealerDocument;
}

/** Capture a signature on an uploaded document. */
export async function signDocument(id: string, signature: string, signedBy: string): Promise<DealerDocument> {
  const res = await authFetch(`/api/documents/${id}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature, signedBy }),
  });
  if (!res.ok) throw new Error(`Document sign failed (${res.status})`);
  const body = await res.json();
  return body.document as DealerDocument;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await authFetch(`/api/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Document delete failed (${res.status})`);
}

export type Seat = {
  accountId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: "principal" | "manager" | "salesperson";
  dealershipId?: string;
  isActive: boolean;
  createdAt: string;
  rotatedAt?: string;
};

/** Staff logins for this dealership, plus the billable active count. */
export async function fetchSeats(): Promise<{ seats: Seat[]; activeSeats: number }> {
  const res = await authFetch("/api/auth/users", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load staff logins.");
  return res.json();
}

/**
 * Add a staff member. Creates the person AND their login in one step, and
 * books the seat — the old version wrote a user with no dealership and no way
 * to sign in.
 *
 * The returned code is shown once and is not recoverable; hand it over, and
 * rotate it if it goes missing.
 */
export async function createUser(
  user: Omit<User, "id" | "isActive"> & { role: "manager" | "salesperson" }
): Promise<{ code: string; user: User }> {
  const res = await authFetch("/api/auth/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not add that person.");
  return data;
}

/** Replace someone's access code — for a forgotten code or a lost phone. */
export async function rotateSeatCode(userId: string): Promise<string> {
  const res = await authFetch(`/api/auth/users/${userId}/rotate`, { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Could not issue a new code.");
  return data.code;
}

/** Switch a seat off (or back on). Off ends their session immediately and
 *  drops them out of the billable count; their leads and notes stay. */
export async function setSeatActive(userId: string, isActive: boolean): Promise<void> {
  const res = await authFetch(`/api/auth/users/${userId}/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) throw new Error("Could not update that login.");
}

export async function addCommunication(comm: Omit<Communication, "id" | "sentAt">): Promise<Communication> {
  const newC = { ...comm, id: 'c' + Date.now(), sentAt: new Date().toISOString() } as Communication;
  await updateState(s => s.communications.push(newC));
  return newC;
}

export async function createExpense(expense: Omit<Expense, "id">): Promise<Expense> {
  const newE = { ...expense, id: 'exp' + Date.now() } as Expense;
  await updateState(s => s.expenses.push(newE));
  return newE;
}

export async function generateDocument(type: string, id: string): Promise<Blob> {
  return new Blob(["Mock PDF Content"], { type: "application/pdf" });
}

export async function decodeVin(vin: string) {
  return { make: "MockMake", model: "MockModel", year: 2026, engine: "MockEngine" };
}

export async function askAI(question: string): Promise<string> {
  return "This is a mock AI response in the Lite version.";
}

export async function createCommunication(comm: Omit<Communication, "id" | "sentAt">): Promise<Communication> {
  return addCommunication(comm);
}

export async function deleteLead(id: string): Promise<void> {
  await updateState(s => { s.leads = s.leads.filter(l => l.id !== id); });
}

export async function updateAgreement(id: string, updates: Partial<Agreement>): Promise<Agreement> {
  let updated;
  await updateState(s => {
    const idx = s.agreements.findIndex(a => a.id === id);
    if (idx !== -1) {
      s.agreements[idx] = { ...s.agreements[idx], ...updates };
      updated = s.agreements[idx];
    }
  });
  return updated as Agreement;
}

export async function updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
  let updated;
  await updateState(s => {
    const idx = s.invoices.findIndex(i => i.id === id);
    if (idx !== -1) {
      s.invoices[idx] = { ...s.invoices[idx], ...updates };
      updated = s.invoices[idx];
    }
  });
  return updated as Invoice;
}

export async function deleteTask(id: string): Promise<void> {
  await updateState(s => { s.tasks = s.tasks.filter(t => t.id !== id); });
}

export async function uploadImage(file: File): Promise<string> {
  return URL.createObjectURL(file);
}

export async function askCRM(query: string): Promise<string> {
  return "Mock AI CRM response.";
}

export async function reconcileExpense(id: string, reconciled: boolean): Promise<Expense> {
  let updated;
  await updateState(s => {
    const idx = s.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      s.expenses[idx].reconciled = reconciled;
      updated = s.expenses[idx];
    }
  });
  return updated as Expense;
}

export async function deleteVehicle(id: string): Promise<void> {
  await updateState(s => { s.vehicles = s.vehicles.filter(v => v.id !== id); });
}

export async function payInvoice(id: string): Promise<Invoice> {
  let updated;
  await updateState(s => {
    const idx = s.invoices.findIndex(i => i.id === id);
    if (idx !== -1) {
      s.invoices[idx].status = 'Paid';
      updated = s.invoices[idx];
    }
  });
  return updated as Invoice;
}
