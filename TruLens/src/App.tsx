import React from 'react';
import MobileDevice from './components/MobileDevice';
import InventoryList from './components/InventoryList';
import CameraGuide from './components/CameraGuide';
import ImageEditor from './components/ImageEditor';
import Login from './components/Login';
import ReportPreview from './components/ReportPreview';
import DamageTagger from './components/DamageTagger';
import { Vehicle, QualityReport, DmsExportResult } from './types';
import { useAuth } from './contexts/AuthContext';
import DealerSelect from './components/DealerSelect';

/** Keep client state crash-safe even if API returns partial records. */
function normalizeVehicle(raw: any): Vehicle {
  const photosIn = raw?.photos && typeof raw.photos === 'object' ? raw.photos : {};
  const photos: Record<string, string> = {};
  for (const [k, v] of Object.entries(photosIn)) {
    if (typeof v !== 'string' || v.length < 32) continue;
    if (v.includes('[image content will be provided')) continue;
    if (v.startsWith('data:') || v.startsWith('http')) {
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
     silent on purpose: this is a display nicety, not something to block on. */
  React.useEffect(() => {
    if (!user) return;
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
  const [activeView, setActiveView] = React.useState<'inventory' | 'camera' | 'editor' | 'report' | 'damage'>('inventory');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  
  // Editor view states
  const [activeSlotId, setActiveSlotId] = React.useState<string | null>(null);
  const [activeImageSrc, setActiveImageSrc] = React.useState<string | null>(null);
  const [activeQualityReport, setActiveQualityReport] = React.useState<QualityReport | null>(null);
  
  // Sync status state
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
        
        // Seed database if empty (optional: only for first-time login)
        if (list.length === 0) {
          await seedInitialVehicles();
        } else {
          setSyncStatus('synced');
        }
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

  // Helper to seed initial vehicle listings for instant evaluation
  const seedInitialVehicles = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    
    const seedCars = [
      {
        id: 'car-mustang-gt-' + Date.now(),
        make: 'Ford',
        model: 'Mustang GT Premium',
        year: 2022,
        trim: 'Fastback v8',
        vin: '1FA6P8CF0N5102931',
        stockNumber: 'STK-958210',
        color: 'Oxford White',
        price: 43500,
        vehicleType: 'Coupe',
        status: 'In-Progress' as const,
        photos: {},
        quality: {}
      },
      {
        id: 'car-tesla-modely-' + Date.now(),
        make: 'Tesla',
        model: 'Model Y Long Range',
        year: 2023,
        trim: 'Dual Motor AWD',
        vin: '5YJYGDEE7PF382910',
        stockNumber: 'STK-441029',
        color: 'Solid Black',
        price: 49990,
        vehicleType: 'SUV',
        status: 'In-Progress' as const,
        photos: {},
        quality: {}
      }
    ];

    try {
      for (const car of seedCars) {
        await fetch('/api/inventory', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(car)
        });
      }
      // Re-fetch to get synced state
      await fetchInventory();
    } catch (err) {
      console.error('Failed to seed DB:', err);
      setSyncStatus('error');
    }
  };

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
      // The DMS target is fixed on the server (TRUFLOW_DMS_URL) for every
      // device — the phone no longer carries its own base URL. A stale
      // localhost left in a phone's storage used to silently break exports.
      const dealerSlug =
        localStorage.getItem('trulens_dealer_slug') ||
        undefined;

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

  // Trigger when photo is captured in viewfinder
  // A kept shot saves immediately — no detour through the editor. Redo happens
  // in the camera before this is ever called; polishing is opt-in afterwards.
  const handlePhotoCaptured = (slotId: string, base64Image: string, qualityReport: QualityReport) => {
    setActiveSlotId(slotId);
    void handleSaveProcessedImage(base64Image, qualityReport, slotId);
  };

  /** Open the editor for a slot on demand (the optional "Edit" button). */
  const handleEditSlot = (slotId: string, base64Image: string, qualityReport: QualityReport) => {
    setActiveSlotId(slotId);
    setActiveImageSrc(base64Image);
    setActiveQualityReport(qualityReport);
    setActiveView('editor');
  };

  // Trigger when composite photo is saved in the editor
  const handleSaveProcessedImage = async (processedImage: string, updatedReport: QualityReport, slotId?: string) => {
    const targetSlot = slotId || activeSlotId;
    if (!activeVehicleId || !targetSlot || !user) return;
    setSyncStatus('syncing');
    setUploadError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/inventory/upload-photo', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleId: activeVehicleId,
          slotId: targetSlot,
          base64Image: processedImage,
          qualityReport: updatedReport
        })
      });

      if (res.ok) {
        const result = await res.json();
        const saved = normalizeVehicle(result.vehicle);
        
        // Update local vehicles state
        setVehicles(prev => prev.map(v => v.id === activeVehicleId ? saved : v));
        setSyncStatus('synced');
        
        // Go back to camera; keep shooting flow tight (next empty required slot preferred)
        setActiveView('camera');
        setActiveImageSrc(null);
        setActiveSlotId(null);
        setActiveQualityReport(null);
      } else {
        /* Say what went wrong. This used to set an error flag and nothing else,
           while the caller had already cleared the pending shot — so a failed
           save looked exactly like a successful one: the clip vanished, the app
           carried on, and the only way to discover the loss was to read the
           dealer's public feed days later. A 360 walkaround is ~20MB against
           ~60KB for a still, so it is the one that hits a size ceiling, and a
           desktop webcam can ignore the bitrate hint and record far larger. */
        setSyncStatus('error');
        const sizeMb = Math.round(processedImage.length / 1024 / 1024);
        setUploadError(
          res.status === 413 || sizeMb > 45
            ? `That clip is ${sizeMb}MB — too large to save. Record a shorter Tru Orbit (under 20 seconds) and keep it again.`
            : `Could not save that ${processedImage.startsWith('data:video') ? 'Tru Orbit' : 'photo'} (server said ${res.status}). It has NOT been kept — try again.`,
        );
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
      const next = {
        ...vehicle,
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
      (activeView === 'camera' || activeView === 'report' || activeView === 'editor' || activeView === 'damage') &&
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
      ) : !dealerConfirmed ? (
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
                onTagDamage={(v) => { setActiveVehicleId(v.id); setActiveView('damage'); }}
                onAddVehicle={handleAddVehicle}
                onDeleteVehicle={handleDeleteVehicle}
                onExportToDms={handleExportToDms}
                onUpdateVehicle={handleUpdateVehicle}
                syncStatus={syncStatus}
                onForceSync={fetchInventory}
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
              }}
            />
          )}

          {activeView === 'damage' && activeVehicle && (
            <DamageTagger
              vehicle={activeVehicle}
              onBack={() => setActiveView('inventory')}
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

          {activeView === 'camera' && activeVehicle && (
            <CameraGuide
              vehicle={activeVehicle}
              onBack={() => setActiveView('inventory')}
              onPhotoCaptured={handlePhotoCaptured}
              onEditRequested={handleEditSlot}
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
        </>
      )}
    </MobileDevice>
  );
}
