import React from 'react';
import MobileDevice from './components/MobileDevice';
import InventoryList from './components/InventoryList';
import CameraGuide from './components/CameraGuide';
import Login from './components/Login';
import ReportPreview from './components/ReportPreview';
import SlotReview from './components/SlotReview';
import CompletionReview from './components/CompletionReview';
import InspectionSheet from './components/InspectionSheet';
import DamageTagger from './components/DamageTagger';
import TradeInWalkAround from './components/TradeInWalkAround';
import TradeInValuation from './components/TradeInValuation';
import TradeInSummary from './components/TradeInSummary';
import { Vehicle, QualityReport, DmsExportResult, PointResult } from './types';
import type { InspectionItem, ValuationState, TradeInData } from './types/inspection';
import { createDefaultItems } from './types/inspection';
import { useAuth } from './contexts/AuthContext';

/** Convert a blob: URL to a data: URL so it survives navigation / reload. */
async function blobUrlToDataUrl(url: string): Promise<string> {
  if (!url.startsWith('blob:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Keep client state crash-safe even if API returns partial records. */
function normalizeVehicle(raw: any): Vehicle {
  const photosIn = raw?.photos && typeof raw.photos === 'object' ? raw.photos : {};
  const photos: Record<string, string> = {};
  for (const [k, v] of Object.entries(photosIn)) {
    if (typeof v !== 'string' || v.length < 32) continue;
    if (v.includes('[image content will be provided')) continue;
    /* A stored reference — "/media/<sha256>.jpg" — is a real photo, and is the
       form every photo takes now that they are files rather than base64 in the
       record. It has to be named explicitly: at ~75 characters it carries no
       data:/http prefix and is far too short for the raw-base64 branch below,
       so without this it matched nothing, fell through, and was dropped here on
       arrival — leaving a fully photographed vehicle looking like the shots
       were never taken. The server's isValidPhotoData carries the same case. */
    if (v.startsWith('/media/') || v.startsWith('data:') || v.startsWith('http')) {
      photos[k] = v;
    } else if (v.length > 200 && !v.includes(' ')) {
      photos[k] = `data:image/jpeg;base64,${v}`;
    }
  }
  const qualityIn = raw?.quality && typeof raw.quality === 'object' ? raw.quality : {};
  const quality: Vehicle['quality'] = {};
  for (const [slotId, report] of Object.entries(qualityIn)) {
    if (!report || typeof report !== 'object') continue;
    const r = report as any;
    let issues = r?.aiAnalysis?.detectedIssues;
    if (typeof issues === 'string') issues = issues ? [issues] : [];
    if (!Array.isArray(issues)) issues = [];
    quality[slotId] = {
      ...r,
      aiAnalysis: r.aiAnalysis
        ? { ...r.aiAnalysis, detectedIssues: issues.map(String) }
        : r.aiAnalysis,
    };
  }
  return {
    ...raw,
    id: String(raw?.id || ''),
    make: raw?.make ?? '',
    model: raw?.model ?? '',
    year: Number(raw?.year) || new Date().getFullYear(),
    trim: raw?.trim ?? '',
    vin: raw?.vin ?? '',
    stockNumber: raw?.stockNumber ?? '',
    color: raw?.color ?? '',
    price: Number(raw?.price) || 0,
    vehicleType: raw?.vehicleType,
    status: raw?.status || 'In-Progress',
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    photos,
    quality,
  } as Vehicle;
}

export default function App() {
  const { user, loading } = useAuth();
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleId] = React.useState<string | null>(null);
  const [activeView, setActiveView] = React.useState<'inventory' | 'camera' | 'editor' | 'report' | 'checklist' | 'damage' | 'trade-in' | 'trade-in-valuation' | 'trade-in-summary' | 'completion'>('inventory');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // Trade-in flow state (carried between the 3 screens)
  const [tradeInItems, setTradeInItems] = React.useState<InspectionItem[]>([]);
  const [tradeInValuation, setTradeInValuation] = React.useState<ValuationState | null>(null);

  // Editor view states
  const [activeSlotId, setActiveSlotId] = React.useState<string | null>(null);
  const [activeImageSrc, setActiveImageSrc] = React.useState<string | null>(null);
  const [activeQualityReport, setActiveQualityReport] = React.useState<QualityReport | null>(null);
  
  // Sync status state
  const [syncStatus, setSyncStatus] = React.useState<'synced' | 'syncing' | 'error'>('synced');

  // Load inventory from server
  const fetchInventory = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setLoadError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/inventory', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(normalizeVehicle) : [];
        setVehicles(list);
        
        setSyncStatus('synced');
      } else {
        const errBody = await res.json().catch(() => ({}));
        setSyncStatus('error');
        setLoadError(errBody.error || `Failed to load inventory (${res.status})`);
      }
    } catch (e) {
      console.error('Failed to load inventory:', e);
      setSyncStatus('error');
      setLoadError(e instanceof Error ? e.message : 'Network error loading inventory');
    }
  };

  React.useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user]);

  // Add vehicle
  const handleAddVehicle = async (newVehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => {
    if (!user) return;
    setSyncStatus('syncing');
    const token = await user.getIdToken();
    
    const newVehicle: Vehicle = {
      ...newVehicleData,
      id: 'car-' + Math.floor(100000 + Math.random() * 900000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      photos: {},
      quality: {}
    };

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newVehicle)
      });
      if (res.ok) {
        const updated = await res.json();
        setVehicles(prev => [updated.vehicle, ...prev]);
        setSyncStatus('synced');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to create vehicle - Server response:', res.status, errorData);
        setSyncStatus('error');
        alert(`Sync Error (${res.status}): ${errorData.error || 'Check server connection'}`);
      }
    } catch (e) {
      console.error('Failed to create vehicle - Fetch error:', e);
      setSyncStatus('error');
      alert('Sync Error: Network failure or server unreachable');
    }
  };

  // Delete vehicle
  const handleDeleteVehicle = async (id: string) => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setVehicles(prev => prev.filter(v => v.id !== id));
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      console.error('Failed to delete vehicle:', e);
      setSyncStatus('error');
    }
  };

  // Export vehicle photos to TruFlow DMS (real push)
  const handleExportToDms = async (vehicle: Vehicle): Promise<DmsExportResult> => {
    if (!user) {
      return { success: false, error: 'Not signed in' };
    }

    setSyncStatus('syncing');
    try {
      const token = await user.getIdToken();
      const dmsUrl =
        localStorage.getItem('trulens_dms_url') ||
        undefined;

      const res = await fetch('/api/export/dms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          dmsUrl: dmsUrl || undefined,
          createIfMissing: true,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as DmsExportResult;

      if (!res.ok || !data.success) {
        setSyncStatus('error');
        return {
          success: false,
          error: data.error || `Export failed (${res.status})`,
          details: data.details,
          message: data.message,
        };
      }

      if (data.vehicle) {
        setVehicles((prev) =>
          prev.map((v) => (v.id === vehicle.id ? { ...v, ...data.vehicle } : v))
        );
      }
      setSyncStatus('synced');
      return data;
    } catch (e) {
      console.error('DMS export failed:', e);
      setSyncStatus('error');
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Network error during DMS export',
      };
    }
  };

  /** Latest damage findings per vehicle — survives async scan races */
  // Trigger when photo is captured in viewfinder
  const handlePhotoCaptured = (slotId: string, base64Image: string, qualityReport: QualityReport) => {
    setActiveSlotId(slotId);
    setActiveImageSrc(base64Image);
    setActiveQualityReport(qualityReport);
    setActiveView('editor');
  };

  // Trigger when composite photo is saved in the editor
  const handleSaveProcessedImage = async (processedImage: string, updatedReport: QualityReport) => {
    if (!activeVehicleId || !activeSlotId || !user) return;
    const slotToSave = activeSlotId;

    // Optimistic: update local state immediately so the UI advances without waiting for the server.
    setVehicles(prev => prev.map(v => {
      if (v.id !== activeVehicleId) return v;
      return {
        ...v,
        photos: { ...(v.photos || {}), [slotToSave]: processedImage },
        quality: { ...(v.quality || {}), [slotToSave]: updatedReport },
      };
    }));
    setActiveView('camera');
    setActiveImageSrc(null);
    setActiveSlotId(null);
    setActiveQualityReport(null);

    await uploadPhotoToServer(activeVehicleId, slotToSave, processedImage, updatedReport);
  };

  const uploadPhotoToServer = async (vehicleId: string, slotId: string, base64Image: string, qualityReport: QualityReport) => {
    if (!user) return;
    setSyncStatus('syncing');
    setUploadError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/inventory/upload-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ vehicleId, slotId, base64Image, qualityReport }),
      });
      if (res.ok) {
        const result = await res.json();
        const saved = normalizeVehicle(result.vehicle);
        setVehicles(prev => prev.map(v => v.id === vehicleId ? saved : v));
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
        setUploadError(`Could not save that photo (server said ${res.status}). It has NOT been kept — try again.`);
      }
    } catch (e) {
      console.error('Failed to upload photo:', e);
      setSyncStatus('error');
      setUploadError('Could not reach the server to save that shot. It has NOT been kept — check signal and try again.');
    }
  };

  // Capture-time review: save the real photo AND the condition/note/close-ups
  // assessed the moment it was taken.
  const handleSaveSlotReview = async (
    mainImage: string,
    assessment: PointResult,
    closeups: string[],
  ) => {
    if (!activeVehicleId || !activeSlotId || !user) return;
    const slotId = activeSlotId;
    const vehicleId = activeVehicleId;
    const report: QualityReport = activeQualityReport || {
      overallScore: 100,
      lightingCheck: { status: 'Perfect', brightness: 130, contrast: 120, feedback: 'Captured.' },
      angleCheck: { status: 'Perfect', pitchDiff: 0, rollDiff: 0, feedback: 'Captured.' },
    };

    // Optimistic: merge photo + assessment + close-ups into local state immediately
    const hasAssessment = !!(assessment.rating || assessment.comment);
    setVehicles(prev => prev.map(v => {
      if (v.id !== vehicleId) return v;
      const nextAssessment = { ...(v.slotAssessment || {}) };
      if (hasAssessment) nextAssessment[slotId] = assessment; else delete nextAssessment[slotId];
      const nextCloseups = { ...(v.closeups || {}) };
      if (closeups.length) nextCloseups[slotId] = closeups; else delete nextCloseups[slotId];
      return {
        ...v,
        photos: { ...(v.photos || {}), [slotId]: mainImage },
        quality: { ...(v.quality || {}), [slotId]: report },
        slotAssessment: nextAssessment,
        closeups: nextCloseups,
      };
    }));
    setActiveView('camera');
    setActiveImageSrc(null);
    setActiveSlotId(null);
    setActiveQualityReport(null);

    // Background server sync
    setSyncStatus('syncing');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/inventory/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleId, slotId, base64Image: mainImage, qualityReport: report }),
      });
      if (!res.ok) { setSyncStatus('error'); return; }
      const result = await res.json();
      const saved = normalizeVehicle(result.vehicle);

      const nextAss = { ...(saved.slotAssessment || {}) };
      if (hasAssessment) nextAss[slotId] = assessment; else delete nextAss[slotId];
      const nextCl = { ...(saved.closeups || {}) };
      if (closeups.length) nextCl[slotId] = closeups; else delete nextCl[slotId];

      const merged: Vehicle = { ...saved, slotAssessment: nextAss, closeups: nextCl };
      setVehicles((prev) => prev.map((v) => (v.id === saved.id ? merged : v)));
      setSyncStatus('synced');
      void handleUpdateVehicle(saved, { slotAssessment: nextAss, closeups: nextCl });
    } catch (e) {
      console.error('Failed to save reviewed shot:', e);
      setSyncStatus('error');
    }
  };

  /** Partial vehicle update (dealer fields, trade-in data, inspection points, etc.) */
  const handleUpdateVehicle = async (vehicle: Vehicle, patch: Partial<Vehicle>): Promise<Vehicle | null> => {
    if (!user) return null;
    setSyncStatus('syncing');
    try {
      const token = await user.getIdToken();
      const { photos, quality, closeups, ...vehicleWithoutMedia } = vehicle;
      const next = {
        ...vehicleWithoutMedia,
        ...patch,
        id: vehicle.id,
        updatedAt: new Date().toISOString(),
      };
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        setSyncStatus('error');
        return null;
      }
      const data = await res.json();
      const saved = normalizeVehicle(data.vehicle || next);
      setVehicles((prev) => prev.map((v) => (v.id === saved.id ? saved : v)));
      setSyncStatus('synced');
      return saved;
    } catch (e) {
      console.error('Failed to update vehicle:', e);
      setSyncStatus('error');
      return null;
    }
  };

  // Select active vehicle to start capturing
  const handleSelectVehicle = (vehicle: Vehicle) => {
    try {
      const safe = normalizeVehicle(vehicle);
      setVehicles((prev) => prev.map((v) => (v.id === safe.id ? safe : v)));
      setActiveVehicleId(safe.id);
      setActiveView('camera');
      setLoadError(null);
    } catch (e) {
      console.error('Failed to open vehicle:', e);
      setLoadError(e instanceof Error ? e.message : 'Could not open vehicle');
    }
  };

  // Open the inspector questionnaire for a vehicle
  const handleOpenChecklist = (vehicle: Vehicle) => {
    setActiveVehicleId(vehicle.id);
    setActiveView('checklist');
    setLoadError(null);
  };

  // Open the trade-in appraisal for a vehicle
  const handleOpenTradeIn = (vehicle: Vehicle) => {
    setActiveVehicleId(vehicle.id);
    if (vehicle.tradeInData?.items?.length) {
      setTradeInItems(vehicle.tradeInData.items);
      setTradeInValuation(vehicle.tradeInData.valuation || null);
    } else {
      setTradeInItems([]);
      setTradeInValuation(null);
    }
    setActiveView('trade-in');
    setLoadError(null);
  };

  /** Upload one trade-in photo under `itemId` and get back its "/media/…" URL.
   *  Goes through the same /api/inventory/upload-photo endpoint — and the
   *  same vehicle.photos store — the Inspect capture flow uses, keyed by the
   *  same 27 slot ids, so a shot taken in either workflow shows up in both. */
  const uploadTradePhoto = async (itemId: string, base64Image: string): Promise<string | null> => {
    if (!user || !activeVehicleId) return null;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/inventory/upload-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ vehicleId: activeVehicleId, slotId: itemId, base64Image }),
      });
      if (!res.ok) return null;
      const result = await res.json();
      const saved = normalizeVehicle(result.vehicle);
      setVehicles(prev => prev.map(v => v.id === activeVehicleId ? saved : v));
      const ref = saved.photos?.[itemId];
      return typeof ref === 'string' ? ref : null;
    } catch (e) {
      console.error('Trade-in photo upload failed:', e);
      return null;
    }
  };

  // Save completed trade-in data to the vehicle
  const handleSaveTradeIn = async (data: TradeInData) => {
    if (!activeVehicle) return;
    await handleUpdateVehicle(activeVehicle, { tradeInData: data } as Partial<Vehicle>);
  };

  /** Always navigates — with no appraisal started yet this lands on the
   *  existing "complete the market valuation step first" prompt in the
   *  trade-in-summary view, the same empty-state pattern the VIR report
   *  already uses (it renders fine at 0/23 photos rather than refusing to
   *  open). A silent no-op here was a dead button before. */
  const handleViewTradeInReport = (vehicle: Vehicle) => {
    setActiveVehicleId(vehicle.id);
    setTradeInItems(vehicle.tradeInData?.items || createDefaultItems());
    setTradeInValuation(vehicle.tradeInData?.valuation || null);
    setActiveView('trade-in-summary');
    setLoadError(null);
  };

  // Open the inspection Report for a vehicle
  const handleViewReport = (vehicle: Vehicle) => {
    try {
      const safe = normalizeVehicle(vehicle);
      setVehicles((prev) => prev.map((v) => (v.id === safe.id ? safe : v)));
      setActiveVehicleId(safe.id);
      setActiveView('report');
      setLoadError(null);
    } catch (e) {
      console.error('Failed to open report:', e);
      setLoadError(e instanceof Error ? e.message : 'Could not open report');
    }
  };

  // If camera/report was opened but vehicle disappeared, bounce home instead of blank/error
  React.useEffect(() => {
    if (
      (activeView === 'camera' || activeView === 'report' || activeView === 'editor' || activeView === 'damage' || activeView === 'trade-in' || activeView === 'trade-in-valuation' || activeView === 'trade-in-summary' || activeView === 'completion') &&
      activeVehicleId &&
      !vehicles.find((v) => v.id === activeVehicleId)
    ) {
      setActiveView('inventory');
      setActiveVehicleId(null);
      setLoadError('That vehicle could not be loaded. It may have been removed — try again from the list.');
    }
  }, [activeView, activeVehicleId, vehicles]);

  if (loading) return <div className="h-full w-full flex items-center justify-center bg-black text-[#E8EAE6]">Loading Auth...</div>;

  const activeVehicle = activeVehicleId
    ? vehicles.find(v => v.id === activeVehicleId) || null
    : null;

  return (
    <MobileDevice>
      {!user ? (
        <Login />
      ) : (
        <>
          {activeView === 'inventory' && (
            <>
              {loadError && (
                <div className="absolute top-2 left-2 right-2 z-50 mx-auto max-w-sm rounded-lg border border-red-500/40 bg-red-950/90 px-3 py-2 text-[13px] text-red-200 shadow-lg">
                  <strong className="block mb-0.5">Load error</strong>
                  {loadError}
                  <button
                    type="button"
                    className="mt-1 underline text-red-100"
                    onClick={() => { setLoadError(null); fetchInventory(); }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {/* A failed save has to be seen. The pending shot is already gone
                  by the time this renders, so without it the loss is invisible
                  and the dealer keeps shooting into a void. */}
              {uploadError && (
                <div
                  role="alert"
                  className="mb-3 rounded-xl border border-[#B86A6A]/40 bg-[#B86A6A]/[0.12] px-4 py-3 flex items-start gap-3"
                >
                  <p className="text-[13px] text-[#DFB6B6] leading-snug flex-1">{uploadError}</p>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="text-[13px] font-semibold text-[rgba(232,234,230,0.72)] shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <InventoryList
                vehicles={vehicles}
                onSelectVehicle={handleSelectVehicle}
                onViewReport={handleViewReport}
                onAddVehicle={handleAddVehicle}
                onDeleteVehicle={handleDeleteVehicle}
                onOpenTradeIn={handleOpenTradeIn}
                onViewTradeInReport={handleViewTradeInReport}
                onUpdateVehicle={handleUpdateVehicle}
                syncStatus={syncStatus}
                onForceSync={fetchInventory}
              />
            </>
          )}

          {activeView === 'checklist' && activeVehicle && (
            <InspectionSheet
              vehicle={activeVehicle}
              onBack={() => setActiveView('inventory')}
              onSave={async (points) => {
                await handleUpdateVehicle(activeVehicle, { inspectionPoints: points });
              }}
              onTagDamage={() => setActiveView('damage')}
              onGenerateReport={() => setActiveView('report')}
            />
          )}

          {activeView === 'damage' && activeVehicle && (
            <DamageTagger
              vehicle={activeVehicle}
              onBack={() => setActiveView('camera')}
              onSave={async (damageFindings) => {
                await handleUpdateVehicle(activeVehicle, { damageFindings });
              }}
              onContinueToChecklist={() => setActiveView('checklist')}
            />
          )}

          {activeView === 'trade-in' && activeVehicle && (
            <TradeInWalkAround
              vehicle={activeVehicle}
              onBack={() => setActiveView('inventory')}
              onUploadPhoto={uploadTradePhoto}
              onComplete={(completedItems) => {
                setTradeInItems(completedItems);
                setActiveView('trade-in-valuation');
                /* Photos are already "/media/…" URLs (uploaded as they were
                   captured). Only a shot whose upload failed is still a blob:
                   URL — convert just those to base64 so the server can still
                   file them on save. The common path does no conversion. */
                Promise.all(
                  completedItems.map(async (it) => ({
                    ...it,
                    photoUrl: it.photoUrl?.startsWith('blob:')
                      ? await blobUrlToDataUrl(it.photoUrl)
                      : (it.photoUrl || null),
                  }))
                ).then((persisted) => {
                  setTradeInItems(persisted);
                  handleUpdateVehicle(activeVehicle, {
                    tradeInData: {
                      ...activeVehicle.tradeInData,
                      items: persisted,
                      valuation: tradeInValuation || activeVehicle.tradeInData?.valuation || undefined,
                    },
                  } as Partial<Vehicle>);
                });
              }}
            />
          )}

          {activeView === 'trade-in-valuation' && activeVehicle && (
            <TradeInValuation
              vehicle={activeVehicle}
              items={tradeInItems}
              onBack={() => setActiveView('trade-in')}
              onComplete={(val) => {
                setTradeInValuation(val);
                setActiveView('trade-in-summary');
              }}
            />
          )}

          {activeView === 'trade-in-summary' && activeVehicle && !tradeInValuation && (
            <div className="flex flex-col items-center justify-center h-full bg-neutral-950 text-[#E8EAE6] p-6 text-center">
              <p className="text-[15px] text-neutral-400 mb-4">No valuation data yet — complete the market valuation step first.</p>
              <button
                onClick={() => setActiveView('trade-in-valuation')}
                className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-[#06080D] text-[13px] font-semibold"
              >
                Go to Valuation
              </button>
            </div>
          )}

          {activeView === 'trade-in-summary' && activeVehicle && tradeInValuation && (
            <TradeInSummary
              vehicle={activeVehicle}
              items={tradeInItems}
              valuation={tradeInValuation}
              onBack={() => setActiveView('inventory')}
              onSave={handleSaveTradeIn}
            />
          )}

          {activeView === 'report' && activeVehicle && (
            <ReportPreview
              vehicle={activeVehicle}
              onBack={() => setActiveView('inventory')}
              onVehicleUpdated={async (v) => {
                const saved = await handleUpdateVehicle(activeVehicle, v);
                if (!saved) {
                  setVehicles((prev) => prev.map((x) => (x.id === v.id ? normalizeVehicle(v) : x)));
                }
              }}
            />
          )}

          {activeView === 'completion' && activeVehicle && (
            <CompletionReview
              vehicle={activeVehicle}
              onBack={() => setActiveView('camera')}
              onSubmit={() => setActiveView('report')}
              onRetakeSlot={(navSlotId) => {
                const photo = activeVehicle.photos?.[navSlotId];
                if (photo) {
                  setActiveSlotId(navSlotId);
                  setActiveImageSrc(photo);
                  setActiveView('editor');
                }
              }}
            />
          )}

          {activeView === 'camera' && activeVehicle && (
            <CameraGuide
              vehicle={activeVehicle}
              onBack={() => setActiveView('inventory')}
              onComplete={() => setActiveView('completion')}
              onPhotoCaptured={handlePhotoCaptured}
              onOpenDamageTagger={() => setActiveView('damage')}
              onOpenChecklist={() => handleOpenChecklist(activeVehicle)}
              onBulkPhotosUploaded={(updatedVehicle) => {
                setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
              }}
            />
          )}

          {activeView === 'editor' && activeVehicle && activeSlotId && activeImageSrc && (
            <SlotReview
              vehicle={activeVehicle}
              slotId={activeSlotId}
              imageSrc={activeImageSrc}
              onBack={() => {
                setActiveView('camera');
                setActiveImageSrc(null);
                setActiveSlotId(null);
                setActiveQualityReport(null);
              }}
              onSave={handleSaveSlotReview}
              onNavigateSlot={(navSlotId) => {
                const photo = activeVehicle.photos?.[navSlotId];
                if (photo) {
                  setActiveSlotId(navSlotId);
                  setActiveImageSrc(photo);
                }
              }}
            />
          )}
        </>
      )}
    </MobileDevice>
  );
}
