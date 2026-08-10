import React from 'react';
import MobileDevice from './components/MobileDevice';
import PortfolioList from './components/PortfolioList';
import CameraGuide from './components/CameraGuide';
import ImageEditor from './components/ImageEditor';
import Login from './components/Login';
import ReportPreview from './components/ReportPreview';
import DamageTagger from './components/DamageTagger';
import { Property, QualityReport, PointResult } from './types';
import { useAuth } from './contexts/AuthContext';

/** Keep client state crash-safe even if API returns partial records. */
function normalizeProperty(raw: any): Property {
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
       arrival — leaving a fully photographed property looking like the shots
       were never taken. The server's isValidPhotoData carries the same case. */
    if (v.startsWith('/media/') || v.startsWith('data:') || v.startsWith('http')) {
      photos[k] = v;
    } else if (v.length > 200 && !v.includes(' ')) {
      photos[k] = `data:image/jpeg;base64,${v}`;
    }
  }
  const qualityIn = raw?.quality && typeof raw.quality === 'object' ? raw.quality : {};
  const quality: Property['quality'] = {};
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
    address: raw?.address ?? '',
    suburb: raw?.suburb ?? '',
    city: raw?.city ?? '',
    bedrooms: raw?.bedrooms,
    bathrooms: raw?.bathrooms,
    parkingSpaces: raw?.parkingSpaces,
    erfRef: raw?.erfRef ?? '',
    listingRef: raw?.listingRef ?? '',
    erfSize: raw?.erfSize,
    floorSize: raw?.floorSize,
    price: Number(raw?.price) || 0,
    propertyType: raw?.propertyType,
    status: raw?.status || 'In-Progress',
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
    photos,
    quality,
  } as Property;
}

export default function App() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = React.useState<Property[]>([]);
  const [activeVehicleId, setActiveVehicleId] = React.useState<string | null>(null);
  const [activeView, setActiveView] = React.useState<'portfolio' | 'camera' | 'editor' | 'report' | 'damage'>('portfolio');
  const [loadError, setLoadError] = React.useState<string | null>(null);
  
  // Editor view states
  const [activeSlotId, setActiveSlotId] = React.useState<string | null>(null);
  const [activeImageSrc, setActiveImageSrc] = React.useState<string | null>(null);
  const [activeQualityReport, setActiveQualityReport] = React.useState<QualityReport | null>(null);
  const [damageReturnTo, setDamageReturnTo] = React.useState<'camera' | 'portfolio'>('portfolio');
  const [damageInitialSlot, setDamageInitialSlot] = React.useState<string | undefined>(undefined);
  
  // Sync status state
  const [syncStatus, setSyncStatus] = React.useState<'synced' | 'syncing' | 'error'>('synced');
  /* Why the last save failed, in words. syncStatus alone only ever said "error"
     somewhere in the chrome, which is not enough to act on when the shot you
     just took has silently disappeared. */
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  // Load portfolio from server
  const fetchInventory = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    setLoadError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/portfolio', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data.map(normalizeProperty) : [];
        setProperties(list);
        
        setSyncStatus('synced');
      } else {
        const errBody = await res.json().catch(() => ({}));
        setSyncStatus('error');
        setLoadError(errBody.error || `Failed to load portfolio (${res.status})`);
      }
    } catch (e) {
      console.error('Failed to load portfolio:', e);
      setSyncStatus('error');
      setLoadError(e instanceof Error ? e.message : 'Network error loading portfolio');
    }
  };

  React.useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user]);

  // Add property
  const handleAddVehicle = async (newVehicleData: Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'photos' | 'quality'>) => {
    if (!user) return;
    setSyncStatus('syncing');
    const token = await user.getIdToken();
    
    const newVehicle: Property = {
      ...newVehicleData,
      id: 'prop-' + Math.floor(100000 + Math.random() * 900000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      photos: {},
      quality: {}
    };

    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newVehicle)
      });
      if (res.ok) {
        const updated = await res.json();
        setProperties(prev => [updated.property, ...prev]);
        setSyncStatus('synced');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to create property - Server response:', res.status, errorData);
        setSyncStatus('error');
        alert(`Sync Error (${res.status}): ${errorData.error || 'Check server connection'}`);
      }
    } catch (e) {
      console.error('Failed to create property - Fetch error:', e);
      setSyncStatus('error');
      alert('Sync Error: Network failure or server unreachable');
    }
  };

  // Delete property
  const handleDeleteVehicle = async (id: string) => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/portfolio/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setProperties(prev => prev.filter(v => v.id !== id));
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch (e) {
      console.error('Failed to delete property:', e);
      setSyncStatus('error');
    }
  };

  // Trigger when photo is captured in viewfinder — route to the review screen
  // so the inspector can check the shot and rotate before it saves, matching the
  // property inspection SlotReview flow.
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
    setProperties(prev => prev.map(v => {
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

  const uploadPhotoToServer = async (propertyId: string, slotId: string, base64Image: string, qualityReport: QualityReport, assessment?: PointResult, closeupPhotos?: string[]) => {
    if (!user) return;
    setSyncStatus('syncing');
    setUploadError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/portfolio/upload-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId, slotId, base64Image, qualityReport, assessment, closeups: closeupPhotos }),
      });
      if (res.ok) {
        const result = await res.json();
        const saved = normalizeProperty(result.property);
        setProperties(prev => prev.map(v => v.id === propertyId ? saved : v));
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

  /** Partial property update (publish flag, metadata, inspection stamps, etc.) */
  const handleUpdateVehicle = async (property: Property, patch: Partial<Property>): Promise<Property | null> => {
    if (!user) return null;
    setSyncStatus('syncing');
    try {
      const token = await user.getIdToken();
      const { photos, quality, closeups, ...propertyWithoutMedia } = property;
      const next = {
        ...propertyWithoutMedia,
        ...patch,
        id: property.id,
        updatedAt: new Date().toISOString(),
      };
      const res = await fetch('/api/portfolio', {
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
      const saved = normalizeProperty(data.property || next);
      setProperties((prev) => prev.map((v) => (v.id === saved.id ? saved : v)));
      setSyncStatus('synced');
      return saved;
    } catch (e) {
      console.error('Failed to update property:', e);
      setSyncStatus('error');
      return null;
    }
  };

  // Select active property to start capturing
  const handleSelectVehicle = (property: Property) => {
    try {
      const safe = normalizeProperty(property);
      setProperties((prev) => prev.map((v) => (v.id === safe.id ? safe : v)));
      setActiveVehicleId(safe.id);
      setActiveView('camera');
      setLoadError(null);
    } catch (e) {
      console.error('Failed to open property:', e);
      setLoadError(e instanceof Error ? e.message : 'Could not open property');
    }
  };

  // Open the inspection Report for a property
  const handleViewReport = (property: Property) => {
    try {
      const safe = normalizeProperty(property);
      setProperties((prev) => prev.map((v) => (v.id === safe.id ? safe : v)));
      setActiveVehicleId(safe.id);
      setActiveView('report');
      setLoadError(null);
    } catch (e) {
      console.error('Failed to open report:', e);
      setLoadError(e instanceof Error ? e.message : 'Could not open report');
    }
  };

  // If camera/report was opened but property disappeared, bounce home instead of blank/error
  React.useEffect(() => {
    if (
      (activeView === 'camera' || activeView === 'report' || activeView === 'editor' || activeView === 'damage') &&
      activeVehicleId &&
      !properties.find((v) => v.id === activeVehicleId)
    ) {
      setActiveView('portfolio');
      setActiveVehicleId(null);
      setLoadError('That property could not be loaded. It may have been removed — try again from the list.');
    }
  }, [activeView, activeVehicleId, properties]);

  if (loading) return <div className="h-full w-full flex items-center justify-center bg-[#F5F4F1] text-[#0A1420]">Loading Auth...</div>;

  const activeVehicle = activeVehicleId
    ? properties.find(v => v.id === activeVehicleId) || null
    : null;

  return (
    <MobileDevice>
      {!user ? (
        <Login />
      ) : (
        <>
          {activeView === 'portfolio' && (
            <>
              {loadError && (
                <div className="absolute top-2 left-2 right-2 z-50 mx-auto max-w-sm rounded-lg border border-red-500/40 bg-red-50 px-3 py-2 text-[13px] text-red-700 shadow-lg">
                  <strong className="block mb-0.5">Load error</strong>
                  {loadError}
                  <button
                    type="button"
                    className="mt-1 underline text-red-700"
                    onClick={() => { setLoadError(null); fetchInventory(); }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {/* A failed save has to be seen. The pending shot is already gone
                  by the time this renders, so without it the loss is invisible
                  and the inspector keeps shooting into a void. */}
              {uploadError && (
                <div
                  role="alert"
                  className="mb-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 flex items-start gap-3"
                >
                  <p className="text-[13px] text-red-700 leading-snug flex-1">{uploadError}</p>
                  <button
                    type="button"
                    onClick={() => setUploadError(null)}
                    className="text-[13px] font-semibold text-[rgba(10,20,32,0.72)] shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <PortfolioList
                properties={properties}
                onSelectVehicle={handleSelectVehicle}
                onViewReport={handleViewReport}
                onAddVehicle={handleAddVehicle}
                onDeleteVehicle={handleDeleteVehicle}
                onUpdateVehicle={handleUpdateVehicle}
                syncStatus={syncStatus}
                onForceSync={fetchInventory}
              />
            </>
          )}

          {activeView === 'report' && activeVehicle && (
            <ReportPreview
              property={activeVehicle}
              onBack={() => setActiveView('portfolio')}
              onVehicleUpdated={async (v) => {
                const saved = await handleUpdateVehicle(activeVehicle, v);
                if (!saved) {
                  setProperties((prev) => prev.map((x) => (x.id === v.id ? normalizeProperty(v) : x)));
                }
              }}
            />
          )}

          {activeView === 'damage' && activeVehicle && (
            <DamageTagger
              property={activeVehicle}
              initialSlotId={damageInitialSlot}
              onBack={() => setActiveView(damageReturnTo)}
              onSave={async (damageFindings) => {
                /* Persisted through the same upsert every other property change
                   uses — POST /api/portfolio merges the body over the stored
                   record, so no new endpoint is needed. The optimistic fallback
                   matches ReportPreview: if the save fails we still show what
                   the inspector entered rather than silently dropping it. */
                const saved = await handleUpdateVehicle(activeVehicle, { damageFindings });
                if (!saved) {
                  setProperties((prev) =>
                    prev.map((x) => (x.id === activeVehicle.id ? { ...x, damageFindings } : x)),
                  );
                }
              }}
            />
          )}

          {activeView === 'camera' && activeVehicle && (
            <CameraGuide
              property={activeVehicle}
              onBack={() => setActiveView('portfolio')}
              onComplete={() => setActiveView('report')}
              onPhotoCaptured={handlePhotoCaptured}
              onEditRequested={handleEditSlot}
              onBulkPhotosUploaded={(updatedVehicle) => {
                setProperties(prev => prev.map(v => v.id === updatedVehicle.id ? updatedVehicle : v));
              }}
            />
          )}

          {activeView === 'editor' && activeVehicle && activeSlotId && activeImageSrc && activeQualityReport && (
            <ImageEditor
              property={activeVehicle}
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
