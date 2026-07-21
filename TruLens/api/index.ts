import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const FIREBASE_PROJECT_ID = process.env.PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0151924955';
const AUTOLENS_DB_ID = process.env.AUTOLENS_DB_ID || 'ai-studio-autolenspro-7d4757ec-a059-4566-98db-d15a4840f4ec';
const DEFAULT_DMS_URL = process.env.TRUFLOW_DMS_URL || process.env.DMS_URL || 'http://localhost:3001';

if (!getApps().length) {
  initializeApp({
    projectId: FIREBASE_PROJECT_ID,
  });
}

const fdb = getFirestore(getApps()[0], AUTOLENS_DB_ID);
const fauth = getAuth();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await fauth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// GET /api/inventory
app.get('/api/inventory', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const snapshot = await fdb.collection('vehicles').where('ownerId', '==', userId).get();
    const vehicles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/inventory
app.post('/api/inventory', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const vehicleData = { ...req.body, ownerId: userId, createdAt: new Date().toISOString() };
    const docRef = await fdb.collection('vehicles').add(vehicleData);
    res.status(201).json({ id: docRef.id, ...vehicleData });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/inventory/upload-photo
app.post('/api/inventory/upload-photo', authenticate, async (req: any, res) => {
  try {
    const { vehicleId, slotName, base64Image } = req.body;
    if (!vehicleId || !slotName || !base64Image) {
      return res.status(400).json({ error: 'vehicleId, slotName, and base64Image are required' });
    }
    const docRef = fdb.collection('vehicles').doc(vehicleId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Vehicle not found' });
    const data = doc.data();
    if (data?.ownerId !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });

    const photos = data?.photos || {};
    photos[slotName] = base64Image;
    await docRef.update({ photos });
    res.json({ success: true, slotName });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// DELETE /api/inventory/:id
app.delete('/api/inventory/:id', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const docRef = fdb.collection('vehicles').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Vehicle not found' });
    if (doc.data()?.ownerId !== userId) return res.status(403).json({ error: 'Forbidden' });
    await docRef.delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/export/dms — push vehicle photos into TruFlow DMS
app.post('/api/export/dms', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.uid;
    const { vehicleId, dmsUrl: dmsUrlOverride, createIfMissing = true } = req.body || {};
    if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

    const docRef = fdb.collection('vehicles').doc(vehicleId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Vehicle not found' });
    const vehicle = doc.data() as any;
    if (vehicle?.ownerId !== userId) return res.status(403).json({ error: 'Forbidden' });

    const photos = vehicle.photos || {};
    const photoCount = Object.keys(photos).length;
    if (photoCount === 0) {
      return res.status(400).json({ success: false, error: 'No photos to export. Capture photos first.' });
    }

    const dmsBase = String(dmsUrlOverride || DEFAULT_DMS_URL).replace(/\/$/, '');
    const pushUrl = `${dmsBase}/api/sync/push-photos`;
    const payload = {
      stockNumber: vehicle.stockNumber,
      vehicleId: vehicle.id,
      createIfMissing: createIfMissing !== false,
      vehicle: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim,
        vin: vehicle.vin,
        stockNumber: vehicle.stockNumber,
        color: vehicle.color,
        price: vehicle.price,
        vehicleType: vehicle.vehicleType,
      },
      photos,
    };

    const dmsRes = await fetch(pushUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const dmsData = await dmsRes.json().catch(() => ({}));
    if (!dmsRes.ok) {
      return res.status(502).json({
        success: false,
        error: 'TruFlow DMS rejected the export',
        dmsStatus: dmsRes.status,
        details: dmsData,
      });
    }

    const exportMeta = {
      lastDmsExportAt: new Date().toISOString(),
      lastDmsExportStatus: dmsData.synced ? 'success' : 'partial',
      lastDmsVehicleId: dmsData.vehicle?.id || null,
      lastDmsStockNumber: dmsData.vehicle?.stockNumber || vehicle.stockNumber,
    };
    const markListed = vehicle.status === 'Ready' || vehicle.status === 'Listed';
    await docRef.update({
      ...exportMeta,
      ...(markListed ? { status: 'Listed', updatedAt: exportMeta.lastDmsExportAt } : {}),
    });

    res.json({
      success: true,
      synced: !!dmsData.synced,
      created: !!dmsData.created,
      message: dmsData.message || `Exported ${photoCount} photos to TruFlow DMS`,
      breakdown: dmsData.breakdown,
      dmsVehicle: dmsData.vehicle || null,
      vehicle: {
        ...vehicle,
        ...exportMeta,
        status: markListed ? 'Listed' : vehicle.status,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'DMS export failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/gemini/analyze
app.post('/api/gemini/analyze', async (req, res) => {
  const { base64Image, slotName, vehicleInfo } = req.body;
  if (!base64Image) return res.status(400).json({ error: 'base64Image is required' });

  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');

  if (!ai) {
    return res.json({
      overallScore: 85,
      lightingCheck: { status: 'Perfect', brightness: 128, contrast: 135, feedback: 'Excellent lighting.' },
      angleCheck: { status: 'Good', pitchDiff: 2, rollDiff: 1, feedback: 'Good angle alignment.' },
      aiAnalysis: {
        identifiedVehicle: `${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Vehicle'} ${vehicleInfo?.model || ''}`,
        suggestedTitle: `${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || 'Premium'} ${vehicleInfo?.model || 'Edition'}`,
        suggestedDescription: `Professionally photographed ${vehicleInfo?.year || '2022'} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''}.`,
        detectedIssues: [],
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
            { text: `You are an automotive photography AI inspector for TruLens. Analyze this ${slotName || 'vehicle'} photo of a ${vehicleInfo?.year || ''} ${vehicleInfo?.make || ''} ${vehicleInfo?.model || ''}. Return JSON with: overallScore (0-100), lightingCheck {status, brightness, contrast, feedback}, angleCheck {status, pitchDiff, rollDiff, feedback}, aiAnalysis {identifiedVehicle, suggestedTitle, suggestedDescription, detectedIssues[]}` }
          ]
        }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            lightingCheck: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, brightness: { type: Type.NUMBER }, contrast: { type: Type.NUMBER }, feedback: { type: Type.STRING } } },
            angleCheck: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, pitchDiff: { type: Type.NUMBER }, rollDiff: { type: Type.NUMBER }, feedback: { type: Type.STRING } } },
            aiAnalysis: { type: Type.OBJECT, properties: { identifiedVehicle: { type: Type.STRING }, suggestedTitle: { type: Type.STRING }, suggestedDescription: { type: Type.STRING }, detectedIssues: { type: Type.ARRAY, items: { type: Type.STRING } } } }
          }
        }
      }
    });

    const text = response.text || '{}';
    res.json(JSON.parse(text));
  } catch (error) {
    res.status(500).json({ error: 'AI analysis failed', details: error instanceof Error ? error.message : String(error) });
  }
});

export default app;
