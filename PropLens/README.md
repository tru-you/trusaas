<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/7d4757ec-a059-4566-98db-d15a4840f4ec

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
4. Open: `http://localhost:3000` (or `http://<your-LAN-ip>:3000` on a phone)

## PWA (phone “app”)

TruLens is installable as a Progressive Web App:

| File | Purpose |
|------|---------|
| `public/manifest.webmanifest` | Name, icons, standalone display |
| `public/sw.js` | App-shell cache (never caches photo APIs) |
| `public/icons/*` | Home-screen icons |
| Install banner | Chrome Install + iOS “Add to Home Screen” tips |

**Agency install (production):** host on **HTTPS**, open the URL on the phone → **Install** / **Add to Home Screen**.

**Local phone demo:** same Wi‑Fi → `http://192.168.x.x:3000` (camera may be limited without HTTPS; use a tunnel like Cloudflare Tunnel for full camera + install).
