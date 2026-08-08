import { authFetch } from "./lib/session";
import { Vehicle, Lead, Task, Invoice, Agreement, DealerDocument, User, Communication, Expense, DMSState, DocStage, DocMode, Dealership } from "./types";

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
  // Server-first; the local-only write here was wiped by the next fetchState().
  try {
    const res = await authFetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      const body = await res.json();
      // Server responds with the settings object directly.
      if (body && typeof body === "object") return body as DMSState['settings'];
    }
  } catch (err) {
    console.warn("updateSettings server failed, local fallback", err);
  }
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

/** Change a vehicle's status.
 *
 *  Separate from `updateVehicle` because a status change is the one edit that
 *  moves another record: the server couples the linked deal (SOLD closes it,
 *  back-in-stock reopens it) and reports what it did.
 *
 *  `closeLeadId` names which deal closed, for a car carrying several open ones.
 *  Omit it and the server closes a deal only when there is exactly one
 *  candidate — a car sold outside the system has none, and stays untouched.
 *  No local fallback: a coupled write that only half-applied offline is worse
 *  than a failure the caller can retry. */
export async function setVehicleStatus(
  id: string,
  status: Vehicle["status"],
  closeLeadId?: string,
): Promise<{ vehicle: Vehicle; coupledLeads: { id: string; status: string }[] }> {
  const res = await authFetch(`/api/inventory/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(closeLeadId ? { status, closeLeadId } : { status }),
  });
  if (!res.ok) throw new Error(`Vehicle status update failed (${res.status})`);
  const body = await res.json();
  return { vehicle: body.vehicle as Vehicle, coupledLeads: body.coupledLeads ?? [] };
}

export async function addReconTask(vehicleId: string, task: Omit<Vehicle['reconTasks'][0], 'id'>) {
  // No dedicated /api/inventory/:id/recon route on the server, but the general
  // PUT /api/inventory/:id accepts the whole vehicle payload, so we push the
  // updated reconTasks array through updateVehicle. Same reason as
  // updateLead — a bare local mutation gets wiped by fetchState().
  const newTask = { ...task, id: 'rc-' + Date.now() };
  const state = await fetchState();
  const v = state.vehicles.find(x => x.id === vehicleId);
  const nextTasks = [...(v?.reconTasks || []), newTask];
  await updateVehicle(vehicleId, { reconTasks: nextTasks } as Partial<Vehicle>);
  return newTask;
}

export async function updateReconTask(vehicleId: string, taskId: string, updates: Partial<Vehicle['reconTasks'][0]>) {
  const state = await fetchState();
  const v = state.vehicles.find(x => x.id === vehicleId);
  if (!v?.reconTasks) return undefined;
  const nextTasks = v.reconTasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
  await updateVehicle(vehicleId, { reconTasks: nextTasks } as Partial<Vehicle>);
  return nextTasks.find(t => t.id === taskId);
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
  try {
    const res = await authFetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.lead) return body.lead as Lead;
    }
  } catch (err) {
    console.warn("createLead server failed, local fallback", err);
  }

  const newL = {
    ...lead,
    id: 'l' + Date.now(),
    createdAt: new Date().toISOString(),
    lastContactedAt: new Date().toISOString(),
    status: 'New' as const,
    assignedUserId: 'u1',
    digitalScore: lead.digitalScore ?? Math.floor(Math.random() * 41) + 50,
  } as Lead;
  await updateState(s => s.leads.push(newL));
  return newL;
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  // Persist to server first — a local-only push here used to get silently
  // wiped by the very next fetchState() (server truth wins), so lead status
  // changes never actually survived a refresh.
  try {
    const res = await authFetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.lead) return body.lead as Lead;
    }
  } catch (err) {
    console.warn("updateLead server failed, local fallback", err);
  }

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

/** Change a lead's stage.
 *
 *  Separate from `updateLead` because a status change is the one edit that
 *  moves another record: the server couples the linked vehicle (Closed Won →
 *  SOLD, reopened → back in stock) and reports what it did, so the UI can say
 *  so without duplicating the rule. Every other lead edit should use
 *  `updateLead`. No local fallback — a coupled write that only half-applied
 *  offline is worse than a failure the caller can retry. */
export async function updateLeadStatus(
  id: string,
  status: Lead["status"],
): Promise<{ lead: Lead; coupledVehicle: { id: string; status: string } | null }> {
  const res = await authFetch(`/api/leads/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Lead status update failed (${res.status})`);
  const body = await res.json();
  return { lead: body.lead as Lead, coupledVehicle: body.coupledVehicle ?? null };
}

export async function createTask(task: Omit<Task, "id">): Promise<Task> {
  try {
    const res = await authFetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.task) return body.task as Task;
    }
  } catch (err) {
    console.warn("createTask server failed, local fallback", err);
  }
  const newT = { ...task, id: 't' + Date.now() } as Task;
  await updateState(s => s.tasks.push(newT));
  return newT;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  try {
    const res = await authFetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.task) return body.task as Task;
    }
  } catch (err) {
    console.warn("updateTask server failed, local fallback", err);
  }
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
  // Same story as updateLead/updateVehicle: local push gets wiped by the next
  // fetchState() (server truth wins), so an auto-generated invoice from a
  // Closed Won never survived a refresh. Persist to server; fall back local.
  try {
    const res = await authFetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invoice),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.invoice) return body.invoice as Invoice;
    }
  } catch (err) {
    console.warn("createInvoice server failed, local fallback", err);
  }
  const newI = { ...invoice, id: 'inv' + Date.now(), invoiceNumber: 'INV-' + Date.now() } as Invoice;
  await updateState(s => s.invoices.push(newI));
  return newI;
}

export async function createAgreement(agreement: Omit<Agreement, "id" | "agreementNumber">): Promise<Agreement> {
  try {
    const res = await authFetch("/api/agreements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agreement),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.agreement) return body.agreement as Agreement;
    }
  } catch (err) {
    console.warn("createAgreement server failed, local fallback", err);
  }
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

// --- DocHub -------------------------------------------------------------

/** Create a DocHub stage document. Modes:
 *   - 'attach'   — fileData required (dealer's own signed doc)
 *   - 'generate' — fieldSnapshot captured, PDF rendered from template
 *   - 'confirm'  — no file, no snapshot; server verifies checklist flags on
 *                  finalize (used for compliance: NATIS + roadworthy)
 *   - 'connect'  — server generates an accounting-import CSV */
export async function createStageDocument(input: {
  leadId: string;
  vehicleId?: string;
  stage: DocStage;
  mode: DocMode;
  fileName?: string;
  mimeType?: string;
  fileData?: string;
  fieldSnapshot?: Record<string, unknown>;
}): Promise<DealerDocument> {
  const res = await authFetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Stage document create failed (${res.status})`);
  }
  const body = await res.json();
  return body.document as DealerDocument;
}

/** Finalise a stage document. Server runs the validator (generate mode) or
 *  checks the attached doc is signed (attach mode), then advances the lead's
 *  docStage. Throws a rich error whose `.missing` array (if present) tells
 *  the UI exactly which fields need filling. */
export async function finalizeStageDocument(
  id: string,
): Promise<{ document: DealerDocument; lead: { id: string; docStage: DocStage | null } | null }> {
  const res = await authFetch(`/api/documents/${id}/finalize`, { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Stage finalise failed (${res.status})`) as Error & {
      missing?: string[];
      status?: number;
    };
    if (Array.isArray(body.missing)) err.missing = body.missing;
    err.status = res.status;
    throw err;
  }
  return body;
}

/** Dealer self-service update of identity fields (name, trading-as, VAT,
 *  contact email, address, registration number, website URL). Admins can
 *  target another dealership by passing dealershipId. */
export async function updateDealershipSelf(
  patch: Partial<Pick<Dealership, "name" | "tradingAs" | "vatNumber" | "contactEmail" | "address" | "registrationNumber" | "websiteUrl" | "docSettings">>,
  dealershipId?: string,
): Promise<Dealership> {
  const res = await authFetch("/api/dealership/self", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...patch, dealershipId }),
  });
  if (!res.ok) throw new Error(`Dealership update failed (${res.status})`);
  const body = await res.json();
  return body.dealership as Dealership;
}

/** Save the current dealer's per-stage mode configuration. */
export async function updateDocFlow(
  docFlow: Partial<Record<DocStage, DocMode>>,
  dealershipId?: string,
): Promise<Dealership> {
  const res = await authFetch("/api/docflow", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docFlow, dealershipId }),
  });
  if (!res.ok) throw new Error(`DocFlow update failed (${res.status})`);
  const body = await res.json();
  return body.dealership as Dealership;
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
  try {
    const res = await authFetch("/api/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(comm),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.communication) return body.communication as Communication;
    }
  } catch (err) {
    console.warn("addCommunication server failed, local fallback", err);
  }
  const newC = { ...comm, id: 'c' + Date.now(), sentAt: new Date().toISOString() } as Communication;
  await updateState(s => s.communications.push(newC));
  return newC;
}

export async function createExpense(expense: Omit<Expense, "id">): Promise<Expense> {
  try {
    const res = await authFetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.expense) return body.expense as Expense;
    }
  } catch (err) {
    console.warn("createExpense server failed, local fallback", err);
  }
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
  try {
    const res = await authFetch(`/api/agreements/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.agreement) return body.agreement as Agreement;
    }
  } catch (err) {
    console.warn("updateAgreement server failed, local fallback", err);
  }
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
  // The server has PUT /api/invoices/:id/pay for the paid transition but no
  // general PUT /api/invoices/:id, so a partial update here can't fully
  // persist. Route the pay case through payInvoice; anything else lives
  // locally until the general route lands.
  if (updates.status === "Paid") {
    return payInvoice(id);
  }
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
  const res = await authFetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Could not delete task (server said ${res.status}).`);
  }
  await updateState(s => { s.tasks = s.tasks.filter(t => t.id !== id); });
}

export async function uploadImage(file: File): Promise<string> {
  return URL.createObjectURL(file);
}

export async function askCRM(query: string): Promise<string> {
  return askAI(query);
}

export async function reconcileExpense(id: string, reconciled: boolean): Promise<Expense> {
  try {
    const res = await authFetch(`/api/expenses/${id}/reconcile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reconciled }),
    });
    if (res.ok) {
      const body = await res.json();
      if (body.expense) return body.expense as Expense;
    }
  } catch (err) {
    console.warn("reconcileExpense server failed, local fallback", err);
  }
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
  try {
    const res = await authFetch(`/api/invoices/${id}/pay`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const body = await res.json();
      if (body.invoice) return body.invoice as Invoice;
    }
  } catch (err) {
    console.warn("payInvoice server failed, local fallback", err);
  }
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
