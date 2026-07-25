# True-Cars ↔ TruSaaS

See full map: `../TruSaaS/SITES.md`

**This site** = consumer demo at https://true-cars.co.za  
**TruSaaS** = dealer tools on Render / trusaas.co.za  

Live stock: `assets/js/stock-bridge.js` loads  
`/api/public/stock?dealer=true-cars` from Flow Premium (fallback static `data.js`).

Redeploy this site after changing the bridge. Set Flow **dealer slug** to `true-cars` for units you want on the public site.
