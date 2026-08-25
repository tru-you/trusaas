import React from 'react';
import MobileDevice from './components/MobileDevice';
import InventoryList from './components/InventoryList';
import CameraGuide from './components/CameraGuide';
import ImageEditor from './components/ImageEditor';
import Login from './components/Login';
import ReportPreview from './components/ReportPreview';
import DamageTagger from './components/DamageTagger';
import PublishGate from './components/PublishGate';
import { Vehicle, QualityReport, PointResult, DmsExportResult } from './types';
import { buildWeb3DPackage } from './lib/web3dPackage';
import { useAuth } from './contexts/AuthContext';
import DealerSelect from './components/DealerSelect';
import GuidePanel from './components/GuidePanel';
import DealerAssist from './components/DealerAssist';
import SetupPrompt from './components/SetupPrompt';
import {
  fetchSetupStatus,
  snoozeSetup,
  setupSnoozed,
  type SetupStatus as AppSetupStatus,
} from './lib/setupStatus';

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
  const { user, loading, isDemo } = useAuth();
  // Which dealership this phone is filing to. Explicit choice at login — no
  // default, so nothing is ever captured against the wrong yard.
  const [dealerConfirmed, setDealerConfirmed] = React.useState<boolean>(
    () => !!localStorage.getItem('trulens_dealer_confirmed'),
  );

  /* This initialiser runs once, at mount — which is BEFORE anyone has signed
     in, so it always read false. Signing in with a per-dealership code sets
     the flag (the code carries the yard, so there is nothing left to choose),
     but the already-initialised state never looked again and the picker asked
     anyway. Re-read once the user arrives. */
  React.useEffect(() => {
    if (!user) return;
    if (localStorage.getItem('trulens_dealer_confirmed')) setDealerConfirmed(true);
  }, [user]);

  /* Warm the dealership list once signed in.
     Only the picker used to fetch it, so a phone pinned by a per-dealership
     code — which skips the picker entirely — had nothing cached, and Settings
     could only show the raw slug where the dealer's name belongs. Failure is
     silent on purpose: this is a display nicety, not something to block on.
     Demo sessions skip this too: the list names our real clients, and an
     anonymous prospect has no business caching it. */
  React.useEffect(() => {
    if (!user || isDemo) return;
    if (localStorage.getItem('trulens_dealerships_v1')) return;
    fetch('/api/dealerships', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        if (Array.isArray(list) && list.length) {
          localStorage.setItem('trulens_dealerships_v1', JSON.stringify(list));
        }
      })
      .catch(() => undefined);
  }, [user]);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [activeVehicleId, setActiveVehicleId] = React.useState<string | null>(null);
  const [activeView, setActiveView] = React.useState<'inventory' | 'camera' | 'editor' | 'report' | 'damage' | 'publish-gate'>('inventory');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  
  // Editor view states
  const [activeSlotId, setActiveSlotId] = React.useState<string | null>(null);
  const [activeImageSrc, setActiveImageSrc] = React.useState<string | null>(null);
  const [activeQualityReport, setActiveQualityReport] = React.useState<QualityReport | null>(null);
  const [damageReturnTo, setDamageReturnTo] = React.useState<'camera' | 'inventory'>('inventory');
  const [damageInitialSlot, setDamageInitialSlot] = React.useState<string | undefined>(undefined);
  
  // Sync status state
  const [guideOpen, setGuideOpen] = React.useState(false);
  const [assistOpen, setAssistOpen] = React.useState(false);

  // First-run dealership setup — bridged to TruFlow central by the server, so
  // demo tokens and legacy shared-code logins come back skipPrompt and never
  // see it. The modal is armed once per login; closing it (either button
  // acknowledges on the shared Flow record) keeps it closed for the session,
  // while the Dashboard tab card carries the quiet reminder.
  const [setupStatus, setSetupStatus] = React.useState<AppSetupStatus | null>(null);
  const [setupOpen, setSetupOpen] = React.useState(true);
  const [setupCardHidden, setSetupCardHidden] = React.useState(() => setupSnoozed());
  React.useEffect(() => {
    if (!user || !dealerConfirmed) return;
    let cancelled = false;
    setSetupOpen(true);
    fetchSetupStatus(() => user.getIdToken()).then((s) => {
      if (!cancelled) setSetupStatus(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user, dealerConfirmed]);


  const [syncStatus, setSyncStatus] = React.useState<'synced' | 'syncing' | 'error'>('synced');
  /* Why the last save failed, in words. syncStatus alone only ever said "error"
     somewhere in the chrome, which is not enough to act on when the shot you
     just took has silently disappeared. */
  const [uploadError, setUploadError] = React.useState<string | null>(null);

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
  const handleAddVehicle = async (newVehicleData: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>, initialPhotos?: Record<string, string>) => {
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
        if (initialPhotos) {
          for (const [slotId, base64] of Object.entries(initialPhotos)) {
            uploadPhotoToServer(newVehicle.id, slotId, base64, undefined as any);
          }
        }
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
      // The DMS target is fixed on the server (TRUFLOW_DMS_URL) for every
      // device — the phone no longer carries its own base URL. A stale
      // localhost left in a phone's storage used to silently break exports.
      // Demo sessions send no slug at all: the server pins them to the
      // hardcoded "demo" tenant, and a slug left in localStorage by a
      // previous real sign-in must never ride along.
      const dealerSlug = isDemo
        ? undefined
        : localStorage.getItem('trulens_dealer_slug') || undefined;

      const res = await fetch('/api/export/dms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          dealerSlug: dealerSlug || undefined,
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

      /* Autoexport the TruOrbit Web3D spin alongside the DMS push, so a
         dealer who never clicked the small "3D" button in the report
         preview still gets a 360 on their site. Awaited (was previously
         fire-and-forget) so the returned DmsExportResult can tell the
         caller whether TruOrbit made it — the InventoryList toast reads
         that flag to say "TruOrbit ✓" or "no TruOrbit". The old flag
         was breakdown.walkaround, but the walkaround video slot was
         removed from the template, so that field never populated. Adds
         a few seconds to the perceived Send-to-DMS wait — acceptable,
         because getting the 360 published is the point. */
      let truOrbit = false;
      try {
        const mergedVehicle = data.vehicle ? { ...vehicle, ...data.vehicle } : vehicle;
        const pkg = await buildWeb3DPackage(mergedVehicle as Vehicle);
        const MIN_ORBIT_FRAMES = 6;
        if (pkg.frames.length >= MIN_ORBIT_FRAMES || pkg.video) {
          const w3Res = await fetch('/api/export/web-3d', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ vehicleId: mergedVehicle.id, package: pkg }),
          });
          if (w3Res.ok) {
            const w3Data = await w3Res.json().catch(() => ({}));
            setVehicles((prev) =>
              prev.map((v) =>
                v.id === mergedVehicle.id
                  ? { ...v, lastWeb3dExportAt: new Date().toISOString(), web3dPublicPath: w3Data.publicUrl }
                  : v
              )
            );
            truOrbit = true;
          } else {
            console.warn('[web3d autoexport] failed', w3Res.status);
          }
        }
      } catch (err) {
        console.warn('[web3d autoexport] error', err);
      }

      return { ...data, truOrbit };
    } catch (e) {
      console.error('DMS export failed:', e);
      setSyncStatus('error');
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Network error during DMS export',
      };
    }
  };

  // Trigger when photo is captured in viewfinder — route to the review screen
  // so the dealer can check the shot and rotate before it saves, matching the
  // TruInspect SlotReview flow.
  const handlePhotoCaptured = (slotId: string, base64Image: string, qualityReport: QualityReport) => {
    setActiveSlotId(slotId);
    setActiveImageSrc(base64Image);
    setActiveQualityReport(qualityReport);
    setActiveView('editor');
  };

  /** Open the editor for a slot on demand (the optional "Edit" button). */
  const handleEditSlot = (slotId: string, base64Image: string, qualityReport: QualityReport) => {
    setActiveSlotId(slotId);
    setActiveImageSrc(base64Image);
    setActiveQualityReport(qualityReport);
    setActiveView('editor');
  };

  // Trigger when photo is saved from the review screen (condition + rotate + close-ups)
  const handleSaveProcessedImage = async (processedImage: string, updatedReport: QualityReport, assessment?: PointResult, closeupPhotos?: string[]) => {
    const targetSlot = activeSlotId;
    if (!activeVehicleId || !targetSlot || !user) return;

    // Optimistic local update — photo, quality, assessment, and close-ups
    setVehicles(prev => prev.map(v => {
      if (v.id !== activeVehicleId) return v;
      return {
        ...v,
        photos: { ...(v.photos || {}), [targetSlot]: processedImage },
        quality: { ...(v.quality || {}), [targetSlot]: updatedReport },
        ...(assessment ? { slotAssessment: { ...(v.slotAssessment || {}), [targetSlot]: assessment } } : {}),
        ...(() => {
          const nextCloseups = { ...(v.closeups || {}) };
          if (closeupPhotos?.length) nextCloseups[targetSlot] = closeupPhotos;
          else delete nextCloseups[targetSlot];
          return { closeups: nextCloseups };
        })(),
      };
    }));
    if (assessment?.rating === 'damage') {
      setDamageReturnTo('camera');
      setDamageInitialSlot(targetSlot);
      setActiveView('damage');
    } else {
      setActiveView('camera');
    }
    setActiveImageSrc(null);
    setActiveSlotId(null);
    setActiveQualityReport(null);

    await uploadPhotoToServer(activeVehicleId, targetSlot, processedImage, updatedReport, assessment, closeupPhotos);
  };

  const uploadPhotoToServer = async (vehicleId: string, slotId: string, base64Image: string, qualityReport?: QualityReport, assessment?: PointResult, closeupPhotos?: string[]) => {
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
        body: JSON.stringify({ vehicleId, slotId, base64Image, qualityReport, assessment, closeups: closeupPhotos }),
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

  /** Partial vehicle update (publish flag, dealer fields, web3d stamps, etc.) */
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
      (activeView === 'camera' || activeView === 'report' || activeView === 'editor' || activeView === 'damage' || activeView === 'publish-gate') &&
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
        /* Demo never sees the dealer picker: a prospect has no yard to pick,
           and the picker's whole job was the legacy shared-code era where the
           app had to ASK which dealership this was. Per-dealer codes pin it
           server-side now, and demo is scoped to its own sandbox — routing a
           prospect into a list of our real clients leaked the customer list. */
      ) : !dealerConfirmed && !isDemo ? (
        <DealerSelect
          onSelected={(slug) => {
            localStorage.setItem('trulens_dealer_slug', slug);
            localStorage.setItem('trulens_dealer_confirmed', '1');
            setDealerConfirmed(true);
          }}
        />
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
                onExportToDms={handleExportToDms}
                onUpdateVehicle={handleUpdateVehicle}
                syncStatus={syncStatus}
                onForceSync={fetchInventory}
                onOpenGuide={() => setGuideOpen(true)}
                onOpenDealerAssist={() => setAssistOpen(true)}
                setupStatus={setupCardHidden ? null : setupStatus}
                onSetupSnooze={() => {
                  snoozeSetup(7);
                  setSetupCardHidden(true);
                }}
              />
            </>
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
                if (saved && v.showOnWebsite !== activeVehicle.showOnWebsite) {
                  handleExportToDms(saved).catch(() => {});
                }
              }}
            />
          )}

          {activeView === 'damage' && activeVehicle && (
            <DamageTagger
              vehicle={activeVehicle}
              initialSlotId={damageInitialSlot}
              onBack={() => setActiveView(damageReturnTo)}
              onSave={async (damageFindings) => {
                /* Persisted through the same upsert every other vehicle change
                   uses — POST /api/inventory merges the body over the stored
                   record, so no new endpoint is needed. The optimistic fallback
                   matches ReportPreview: if the save fails we still show what
                   the inspector entered rather than silently dropping it. */
                const saved = await handleUpdateVehicle(activeVehicle, { damageFindings });
                if (!saved) {
                  setVehicles((prev) =>
                    prev.map((x) => (x.id === activeVehicle.id ? { ...x, damageFindings } : x)),
                  );
                }
              }}
            />
          )}

          {activeView === 'publish-gate' && activeVehicle && (
            <PublishGate
              vehicle={activeVehicle}
              onBack={() => setActiveView('camera')}
              onPublish={() => setActiveView('report')}
              onExport={async () => {
                // Actually push to the DMS (was a nav-only stub). Awaited so the
                // gate can show a "Sending…" state and only leave once it's done —
                // landing on the inventory list, where the used-state DMS button
                // confirms it went. The result is returned so the gate can surface
                // a failure instead of silently navigating away.
                const r = await handleExportToDms(activeVehicle);
                if (r.success) setActiveView('inventory');
                return r;
              }}
            />
          )}

          {activeView === 'camera' && activeVehicle && (
            <CameraGuide
              vehicle={activeVehicle}
              onBack={() => setActiveView('inventory')}
              onComplete={() => setActiveView('publish-gate')}
              onPhotoCaptured={handlePhotoCaptured}
              onEditRequested={handleEditSlot}
              onOpenGuide={() => setGuideOpen(true)}
              onBulkPhotosUploaded={(updatedVehicle) => {
                setVehicles(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
              }}
            />
          )}

          {activeView === 'editor' && activeVehicle && activeSlotId && activeImageSrc && activeQualityReport && (
            <ImageEditor
              vehicle={activeVehicle}
              slotId={activeSlotId}
              imageSrc={activeImageSrc}
              qualityReport={activeQualityReport}
              onBack={() => {
                setActiveView('camera');
                setActiveImageSrc(null);
                setActiveSlotId(null);
                setActiveQualityReport(null);
              }}
              onSave={handleSaveProcessedImage}
            />
          )}

          <GuidePanel
            open={guideOpen}
            onOpenChange={setGuideOpen}
            currentSection={activeView}
          />
          <SetupPrompt
            open={setupOpen && !!setupStatus && !setupStatus.complete && !setupStatus.skipPrompt && !setupStatus.acknowledgedAt}
            onOpenChange={(o) => {
              if (!o) setSetupOpen(false);
            }}
            status={setupStatus}
            getToken={() => user?.getIdToken()}
          />
          <DealerAssist userName={user?.displayName || undefined} open={assistOpen} onOpenChange={setAssistOpen} />
        </>
      )}
    </MobileDevice>
  );
}
