# TruSaaS website stock sync

One public feed + one embed for every dealership HTML site.

## Public API (same JSON everywhere)

| Product | Local URL |
|---------|-----------|
| TruFlow Premium (live) | `https://premium.tru-saas.com/api/public/stock?dealer=YOUR-SLUG` |
| TruLens (live) | `https://lens.tru-saas.com/api/public/stock?dealer=YOUR-SLUG` |
| TruFlow Premium (local) | `http://localhost:3001/api/public/stock?dealer=YOUR-SLUG` |
| TruFlow Lite (local) | `http://localhost:3002/api/public/stock?dealer=YOUR-SLUG` |
| TruLens only (local) | `http://localhost:3000/api/public/stock?dealer=YOUR-SLUG` |

Response shape:

```json
{
  "success": true,
  "dealer": "mkr-autosales",
  "source": "premium",
  "updatedAt": "...",
  "count": 5,
  "vehicles": [
    {
      "stockNumber": "STK-26505",
      "year": 2026,
      "make": "…",
      "model": "…",
      "price": 24995,
      "images": ["data:image/jpeg;base64,…"],
      "heroImage": "…",
      "photoCount": 7,
      "source": "trulens"
    }
  ]
}
```

### What gets published
- **Premium / Lite:** `status === INVENTORY` and `showOnWebsite !== false`
- **TruLens only:** vehicles with photos, or Ready/Listed (unless `showOnWebsite === false`)

## Drop-in widget

```html
<div id="trusass-stock"></div>
<script
  src="https://premium.tru-saas.com/embed/stock-widget.js"
  data-api="https://premium.tru-saas.com/api/public/stock"
  data-dealer="mkr-autosales"
  data-theme="light"
  data-wa="27662912809"
></script>
```

Point `data-api` at Lite (`:3002`) or TruLens (`:3000`) if the dealer does not use Premium.

## Recommended product flow

1. Shoot in **TruLens**
2. **Export to DMS** (Premium or Lite)
3. Website reads **public stock** from that DMS
4. If no DMS: website reads **TruLens** public stock directly

## Web 3D / spin package (backgroundless + damage tags)

From TruLens report screen: **Export web 3D**

| Resource | URL |
|----------|-----|
| Public package JSON | `http://localhost:3000/api/public/web3d/STK-XXXX` |
| Embed player | `http://localhost:3000/embed/web3d-viewer.html?stock=STK-XXXX` |

Package includes orbit frames (approx transparent cut), optional 360 video, and damage hotspots for the website player.

See also `PRODUCT-CUT.md` for app ownership rules.

## MKR site

`truweb/mkr-autosales/index.html` tries Premium → Lite → TruLens → static fallback.
