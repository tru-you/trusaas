const fs = require('fs');
let code = fs.readFileSync('src/api.ts', 'utf8');

// Replace all fetch calls with local storage logic.
// This is a bit complex. Let's just make a simple script to generate the api.ts with local storage mutations.

let newCode = `import { Vehicle, Lead, Task, Invoice, Agreement, User, Communication, Expense, DMSState } from "./types";

${code.match(/const DEFAULT_MOCK_STATE: DMSState = \{[\s\S]*?\n\};/)[0]}

export async function fetchState(): Promise<DMSState> {
  const local = localStorage.getItem("dms_state");
  if (local) return JSON.parse(local);
  localStorage.setItem("dms_state", JSON.stringify(DEFAULT_MOCK_STATE));
  return DEFAULT_MOCK_STATE;
}

async function updateState(mutator: (state: DMSState) => void): Promise<DMSState> {
  const state = await fetchState();
  mutator(state);
  localStorage.setItem("dms_state", JSON.stringify(state));
  return state;
}

export async function resetState(): Promise<DMSState> {
  localStorage.setItem("dms_state", JSON.stringify(DEFAULT_MOCK_STATE));
  return DEFAULT_MOCK_STATE;
}

export async function updateSettings(settings: Partial<DMSState['settings']>): Promise<DMSState['settings']> {
  const state = await updateState(s => { Object.assign(s.settings, settings); });
  return state.settings;
}

export async function createVehicle(vehicle: Partial<Vehicle>): Promise<Vehicle> {
  const newV = { ...vehicle, id: 'v' + Date.now(), status: vehicle.status || 'INVENTORY' } as Vehicle;
  await updateState(s => s.vehicles.push(newV));
  return newV;
}

export async function updateVehicle(id: string, updates: Partial<Vehicle>): Promise<Vehicle> {
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

export async function createLead(lead: Omit<Lead, "id" | "dateAdded" | "lastContact">): Promise<Lead> {
  const newL = { ...lead, id: 'l' + Date.now(), dateAdded: new Date().toISOString(), lastContact: new Date().toISOString() } as Lead;
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

export async function createInvoice(invoice: Omit<Invoice, "id" | "dateCreated">): Promise<Invoice> {
  const newI = { ...invoice, id: 'inv' + Date.now(), dateCreated: new Date().toISOString() } as Invoice;
  await updateState(s => s.invoices.push(newI));
  return newI;
}

export async function createAgreement(agreement: Omit<Agreement, "id" | "dateCreated">): Promise<Agreement> {
  const newA = { ...agreement, id: 'agr' + Date.now(), dateCreated: new Date().toISOString() } as Agreement;
  await updateState(s => s.agreements.push(newA));
  return newA;
}

export async function createUser(user: Omit<User, "id">): Promise<User> {
  const newU = { ...user, id: 'u' + Date.now() } as User;
  await updateState(s => s.users.push(newU));
  return newU;
}

export async function addCommunication(comm: Omit<Communication, "id" | "timestamp">): Promise<Communication> {
  const newC = { ...comm, id: 'c' + Date.now(), timestamp: new Date().toISOString() } as Communication;
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
`;
fs.writeFileSync('src/api.ts', newCode);
console.log("Rewritten api.ts entirely client-side!");
