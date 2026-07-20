# TruSaaS product cut map

**Positioning:** Same-day web-ready pre-owned units — guided photos, trust report, stock on DMS + site without retyping.

## Who owns what

| Job | TruLens | Flow Lite | Flow Premium | Website |
|-----|---------|-----------|--------------|---------|
| Capture / guide shoot | **Yes** | No | No | No |
| AI quality per shot | **Yes** | No | Read-only score | No |
| VIR / PDF report | **Yes** | Link only | Link only | View if published |
| 3D / spin web package | **Yes (export)** | Host URL | Host URL | **Player** |
| Stock price / status | Optional | **Yes** | **Yes** | Read |
| Leads / WhatsApp CRM | No | **Yes** | **Yes** | Form → API |
| Finance / invoices / recon costs | No | Light | **Yes** | No |
| Publish to website | Flag | **Yes** | **Yes** | Consume feed |
| In-app camera studio | **Only place** | **Remove** | **Remove** | — |

## Photos in Premium / Lite mean

- Gallery on stock card (hero + count)
- Publish gate (“Ready for web”)
- Evidence for recon / damage
- **Not** a second camera app → deep-link to TruLens

## Shared lifecycle

```
Capture (TruLens) → Ready (required shots met) → Listed/Web (exported + published) → Sold (DMS)
```

### Ready-for-web rules (code: `readiness.ts`)

1. All **required** photo slots present  
2. Overall VIR score ≥ **70** (or no quality data yet but all required present)  
3. Optional: damage tagged OR explicitly “no damage”  
4. `showOnWebsite !== false`  
5. DMS: `status === INVENTORY` for public feed  

## Kill / move list

| Feature | Action |
|---------|--------|
| Premium “Photo Capture” CameraGuide | **Done** — removed from Flow; Media hub only |
| Premium “Image Editor” as main nav | **Done** — not in Flow UI |
| Flow multi-file photo upload | **Done** — metadata only; shoot in TruLens |
| Lite “Premium unlocked” copy | **Done** — Lite packaging honest |
| Duplicate PDF from Premium | **Don’t build** — link TruLens VIR |
| TruLens fake DMS alert | **Done** — real export |
| Average single PDF | **Replace** with Sales pack + Full pack |

## Demo honesty

- Flow shows a dismissible **Demo / pilot** banner (password login is not multi-user production auth).
- Settings → TruLens URL + dealer slug + **copy website embed** snippet.
- DMS gallery readiness: `lib/dmsReadiness.ts` (count-based; TruLens still owns slot + VIR rules).

## 3D web package (TruLens export)

Export for websites:

- Orbit **frames** (exterior slots) with **transparent / studio-cut background** where possible  
- Optional **360 video** payload if captured  
- **Damage tags** (label + frame index + normalized x/y) for hotspots  
- Public URL: `/api/public/web3d/:stockNumber` + embed player  

## SA wedge

Guided lot standard → defensible VIR → one-tap DMS + site + **interactive damage-tagged spin** for buyers.
