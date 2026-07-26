import { authFetch } from "./lib/session";
import { Vehicle, Lead, Task, Invoice, Agreement, DealerDocument, User, Communication, Expense, DMSState } from "./types";

/**
 * An EMPTY state, not a populated one.
 *
 * This was 113 lines of seed data belonging to MKR Auto Sales and Cars on
 * Caledon — real dealerships. fetchState falls back to it when /api/state is
 * unreachable and the browser has no cache, which is precisely a dealer's first
 * load during a deploy restart or on a bad connection. They were shown another
 * dealer's dealerships, vehicles, leads and invoices as their own DMS, and it
 * was written to localStorage, so it persisted after the server came back.
 *
 * The server is the only source of truth for tenant data. When it cannot be
 * reached the honest answer is "nothing loaded", which the UI already renders
 * as its empty state.
 */
const EMPTY_STATE: DMSState = {
  vehicles: [],
  leads: [],
  tasks: [],
  invoices: [],
  agreements: [],
  documents: [],
  users: [],
  communications: [],
  expenses: [],
  dealerships: [],
  digitalProducts: [],
  digitalSales: [],
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
  // Deliberately not cached: writing this would make a transient outage look
  // like a real empty dealership on every later load.
  return EMPTY_STATE;
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
    const res = await authFetch("/api/state/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "RESET EVERYTHING" }),
    });
    if (res.ok) {
      const body = await res.json();
      const next = (body.state || EMPTY_STATE) as DMSState;
      localStorage.setItem("dms_state", JSON.stringify(next));
      return next;
    }
  } catch (err) {
    console.warn("resetState server failed", err);
  }
  localStorage.setItem("dms_state", JSON.stringify(EMPTY_STATE));
  return EMPTY_STATE;
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

/**
 * digitalScore is optional rather than omitted, and the caller's value now
 * wins. It used to be excluded from the parameter type *and* hardcoded to 50
 * here, so both callers — the new-lead modal and the website capture form —
 * computed a score that was silently discarded, and every lead created through
 * this path scored exactly 50. The server's POST /api/leads has always honoured
 * req.body.digitalScore, so the two paths disagreed.
 */
export async function createLead(
  lead: Omit<Lead, "id" | "createdAt" | "lastContactedAt" | "status" | "assignedUserId" | "digitalScore">
    & { digitalScore?: number },
): Promise<Lead> {
  const newL = {
    ...lead,
    id: 'l' + Date.now(),
    createdAt: new Date().toISOString(),
    lastContactedAt: new Date().toISOString(),
    status: 'New' as const,
    assignedUserId: 'u1',
    // Same fallback the server uses, so a lead scores the same whichever path
    // created it.
    digitalScore: lead.digitalScore ?? Math.floor(Math.random() * 41) + 50,
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

/** No VIN decoder is wired up. Returning invented make/model would put wrong
 *  details on a real vehicle record, so this reports that it's unavailable. */
export async function decodeVin(_vin: string): Promise<never> {
  throw new Error("VIN decoding isn't available yet — enter the details manually.");
}

/**
 * The dealership co-pilot. This used to return the literal string
 * "This is a mock AI response in the Lite version." — which the compose
 * screens dropped straight into a message body, ready to send to a customer.
 * The server has had a real Gemini-backed endpoint all along; nothing called it.
 */
export async function askAI(question: string): Promise<string> {
  const res = await authFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: question }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Say it's unavailable rather than returning text that reads like an answer.
    throw new Error(data?.error || "The assistant is unavailable right now.");
  }
  return data.text || "";
}

export async function createCommunication(comm: Omit<Communication, "id" | "sentAt">): Promise<Communication> {
  return addCommunication(comm);
}

export async function deleteLead(id: string): Promise<void> {
  // Same bug as deleteVehicle had: local-only, so the lead came back on refresh.
  const res = await authFetch(`/api/leads/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Could not delete lead (server said ${res.status}).`);
  }
  await updateState(s => { s.leads = s.leads.filter(l => l.id !== id); });
}

/**
 * Round-robin unassigned "New" leads across the active salespeople.
 * Goes through authFetch — calling /api/leads/auto-assign with a bare fetch
 * sent no session token and 401'd, which surfaced as "Failed to auto-assign".
 */
export async function autoAssignLeads(): Promise<{ message: string; assignments: any[] }> {
  const res = await authFetch("/api/leads/auto-assign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Auto-assign failed (${res.status})`);
  return data;
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

/* NOTE: the server has no DELETE /api/tasks/:id, so this genuinely is
   local-only and a deleted task reappears on refresh. Left as-is rather than
   faking it — the route needs adding server-side first. */
export async function deleteTask(id: string): Promise<void> {
  await updateState(s => { s.tasks = s.tasks.filter(t => t.id !== id); });
}

export async function uploadImage(file: File): Promise<string> {
  return URL.createObjectURL(file);
}

export async function askCRM(query: string): Promise<string> {
  return askAI(query);
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
  /* Delete on the server FIRST, exactly as createVehicle and updateVehicle
     already do. This function alone still went through updateState, which only
     writes localStorage — so the row vanished from the screen, the next
     fetchState() pulled server truth back, and the car returned. Deleting it
     "again" did the same thing forever. DELETE /api/inventory/:id existed the
     whole time; nothing called it. */
  const res = await authFetch(`/api/inventory/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    // 404 means it is already gone, which is the outcome we wanted anyway.
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Could not delete vehicle (server said ${res.status}).`);
  }
  // Keep the cached copy in step so the UI does not show it until the next fetch.
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
