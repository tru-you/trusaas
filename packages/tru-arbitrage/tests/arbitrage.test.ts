import assert from 'assert';
import crypto from 'crypto';
import { normalizeViaRegex } from '../src/normalizer/regex-fastpath';
import { canonicalMake } from '../src/normalizer/make-aliases';
import { adjustForMileage, adjustForYearGap, robustAverage } from '../src/engine/mileage';
import {
  listCategories, listMakes as catMakes, listModels as catModels,
  listVariants as catVariants, resolveByMmCode, resolveVariant,
} from '../src/engine/catalogue';
import { buildYearBand } from '../src/engine/valuation';
import { calculateUrgencyScore, evaluateArbitrageOpportunity, generateVehicleFingerprint, calculateReconBuffer } from '../src/engine/arbitrage';
import { calculateValuationConfidence } from '../src/engine/confidence';
import { matchesBuyBox } from '../src/alerts/dispatcher';
import { formatDealAlertText, formatSellerOfferTemplate } from '../src/alerts/alert-text';
import { ArbitrageDatabase } from '../src/storage/db';
import { parseCity, isDealerDomain } from '../src/ingestion/serp';
import { listMakes, listModels, titleCaseVehicle } from '../src/engine/tu-matcher';
import { signDealerToken, signDemoToken, verifyToken, TOKEN_SECRET } from '../src/auth/jwt';
import { DealerRegistry } from '../src/auth/dealers';
import { NormalizedVehicle, ValuationResult, DealerBuyBox, RawFbListing } from '../src/types';
import path from 'path';
import fs from 'fs';

console.log('🧪 Starting TruArbitrage Test Suite...\n');

// Inline fixtures — the FB mock-payloads file was retired with the FB lane.
const poloRaw: RawFbListing = {
  id: 'fb_item_polo_1',
  source: 'facebook',
  url: 'https://www.facebook.com/marketplace/item/1001',
  title: '2017 VW Polo 1.2 TSI',
  description: 'Mileage: 110000 km. Clean car, accident free.',
  final_price: 125000,
  location: 'Randburg, Gauteng',
};

const golfNonRunnerRaw: RawFbListing = {
  id: 'fb_item_golf_nonrunner',
  source: 'facebook',
  url: 'https://www.facebook.com/marketplace/item/1002',
  title: '2015 VW Golf 7 GTI',
  description: 'Non runner, selling for spares. Gearbox issue.',
  final_price: 45000,
  location: 'Pretoria, Gauteng',
};

// ── 1. Fast Regex Normalizer Tests ──
console.log('1. Testing Fast Regex Normalizer...');

const normalizedPolo = normalizeViaRegex(poloRaw);

assert.ok(normalizedPolo, 'Normalized Polo should not be null');
assert.strictEqual(normalizedPolo.year, 2017, 'Year should be 2017');
assert.strictEqual(normalizedPolo.make, 'Volkswagen', 'Make should be canonicalized to Volkswagen');
assert.strictEqual(normalizedPolo.model, 'Polo', 'Model should be Polo');
assert.strictEqual(normalizedPolo.askingPrice, 125000, 'Price should be 125,000');
assert.strictEqual(normalizedPolo.mileageKm, 110000, 'Mileage should be 110,000 km');
assert.strictEqual(normalizedPolo.isDamagedOrSalvage, false, 'Should not be damaged');
assert.strictEqual(normalizedPolo.isWantedAd, false, 'Should not be wanted ad');
console.log('   ✅ Clean listing normalized correctly (Year, Make, Model, Km, Price)');

const damageRaw = golfNonRunnerRaw;
const normalizedDamaged = normalizeViaRegex(damageRaw);
assert.ok(normalizedDamaged, 'Normalized damaged vehicle should exist');
assert.strictEqual(normalizedDamaged.isDamagedOrSalvage, true, 'Should detect non-runner / damage');
console.log('   ✅ Damage & Non-runner keyword detected');

const wantedRaw = {
  id: 'test_wanted',
  url: 'https://fb.com/wanted',
  title: 'Looking to buy bakkie under 100k cash ready',
  description: 'Wanted: Looking for bakkie',
  final_price: 100000,
};
const normalizedWanted = normalizeViaRegex(wantedRaw);
assert.ok(normalizedWanted?.isWantedAd || !normalizedWanted, 'Wanted ad correctly flagged or rejected');
console.log('   ✅ Buyer wanted ad filtered');

          }
        </script>
<script type="application/ld+json">
          [
            { "brand": { "name": "Volkswagen" }, "name": "Volkswagen Polo 1.2 TSI 2018", "price": 180000, "mileageFromOdometer": 55000 },
            { "brand": { "name": "Toyota" }, "name": "Toyota Hilux 2.8 GD-6 2018", "price": 460000, "mileageFromOdometer": 85000 }
          ]
        </script>
      </head>
      <body>
        <a class="result-tile" href="/polo-2">2018 Volkswagen Polo 1.0 TSI Comfortline R182,000 58,000 km</a>
        <a class="result-tile" href="/hilux-2">2018 Toyota Hilux 2.4 GD-6 Raider R420,000 95,000 km</a>
      </body>
    </html>
  `;

  const nextComps = extractNextDataComps(mockPoloPageHtml, 'Volkswagen', 'Polo', 2018);
  assert.strictEqual(nextComps.length, 1, 'extractNextDataComps must filter out Hilux & Ranger when searching Polo');
  assert.strictEqual(nextComps[0].price, 185000, 'Matched Polo price extracted');

  const jsonLdComps = extractJsonLdComps(mockPoloPageHtml, 'Volkswagen', 'Polo', 2018);
  assert.strictEqual(jsonLdComps.length, 1, 'extractJsonLdComps must filter out Hilux when searching Polo');
  assert.strictEqual(jsonLdComps[0].price, 180000, 'Matched JsonLd Polo price extracted');

  const cardComps = extractCardComps(mockPoloPageHtml, 'Volkswagen', 'Polo', 2018);
  assert.strictEqual(cardComps.length, 1, 'extractCardComps must filter out Hilux card');
  assert.strictEqual(cardComps[0].price, 182000, 'Matched card Polo price extracted');

  console.log('   ✅. Strict comp matching: non-matching make/model listings strictly filtered out');

  // ── 16. Year extraction from CONCATENATED card text (the 0/800 bug) ──
  console.log('\n16. Testing year extraction from concatenated AutoTrader card text...');
  const { findCardYear, yearInBand } = require('../src/engine/year');

  // Real AutoTrader tiles: no whitespace between the price/rating blob and the year.
  const realTiles = [
    '16R 669 000Fair Price2025 Toyota Hilux2.8GD-6 Double Cab Raider autoUsed23 000 kmAutomaticDiesel',
    '11R 369 995Fair Price2013 Toyota Hilux3.0D-4D Double Cab 4x4 Raider AutoUsed241 929 km',
    '26Insights availableR 459 900Great Price2021 Toyota Fortuner2.4GD-6 AutoUsed106 000 km',
    '30R 809 900No Rating2026 GWM Tank 3002.4T Ultra Luxury 4WDNewAutomaticDiesel',
    '2021 Toyota Hilux 2.8GD-6', // space-delimited still works
  ];
  const expected = [2025, 2013, 2021, 2026, 2021];

  // The old /\b(19|20)\d{2}\b/ matched ZERO of these (the bug �?" no word
  // boundary between "Price" and "2025"). The digit-boundary fix finds all.
  for (let i = 0; i < realTiles.length; i++) {
    if (i < realTiles.length - 1) {
      assert.strictEqual(
        realTiles[i].match(/\b(19|20)\d{2}\b/)?.[0] || null,
        null,
        `Sanity: old word-boundary pattern must fail on concatenated tile #${i}`
      );
    }
    assert.strictEqual(
      findCardYear(realTiles[i], 'Toyota'),
      expected[i],
      `findCardYear recovers ${expected[i]} from tile #${i}`
    );
  }

  // Unknown year must be REJECTED by the band gate (the old code accepted it).
  assert.strictEqual(yearInBand(null, 2021, 2), false, 'Unreadable year is rejected, never silently accepted');
  assert.strictEqual(yearInBand(2024, 2021, 2), false, 'Outside 2-year tolerance rejected');
  assert.strictEqual(yearInBand(2022, 2021, 2), true, 'Inside tolerance accepted');

  console.log('   ✅. Year extraction: 5/5 concatenated tiles recovered, unknown years rejected');

  // ── 17. Make dictionary — the 209-make blind spot (GWM etc.) ──
  console.log('\n17. Testing full-catalogue make detection (formerly-blind makes)...');

  const { detectMakeAndModel } = require('../src/normalizer/regex-fastpath');

  const blindCases: Array<[string, string, string]> = [
    ['2025 GWM P-Series 2.4T Double Cab LT R526,900', 'GWM', 'P-Series'],
    ['2021 Changan Alsvin 1.5L R149,900', 'CHANGAN', 'Alsvin'],
    ['2023 BYD Atto 3 R499,900', 'BYD', 'Atto'],
    ['2019 SsangYong Korando 2.0 Diesel R189,900', 'SSANGYONG', 'Korando'],
    ['2008 Datsun 1200 Bakkie R65,000', 'DATSUN', '1200'],
  ];
  for (const [title, make, model] of blindCases) {
    const r = detectMakeAndModel(title);
    assert.ok(r, `detectMakeAndModel resolves "${title}"`);
    assert.strictEqual(r!.make, make, `Make canonicalized to catalogue key "${make}"`);
    assert.ok(String(r!.model).length >= 2, `Model extracted for "${title}"`);
  }

  // Longest-first: "RANGE ROVER" must not half-match "LAND ROVER".
  assert.strictEqual(detectMakeAndModel('2018 Land Rover Discovery')!.make, 'Land Rover', 'Alias path still wins for Land Rover');

  // Boundary guard: "AMC" must NOT match inside "camera".
  assert.strictEqual(detectMakeAndModel('2010 camera equipment box'), null, 'Substring inside a word is not a make mention');

  // Known make behavior unchanged.
  assert.strictEqual(detectMakeAndModel('2017 VW Polo 1.2 TSI')!.make, 'Volkswagen', 'Alias vw still resolves');

  console.log('   ✅. Make dictionary: GWM/Changan/BYD/SsangYong/Datsun + boundary guards hold');

  // ── 18. Targeted ingestion parser (P7 lane) ──
  console.log('\n18. Testing targeted AutoTrader listing parser...');
  const { parseAutoTraderListings } = require('../src/ingestion/targets');

  const mockAtHtml = `
    <html>
      <body>
        <a class="result-tile" href="/gwm-1"><span class="price">24R 249 900Great Price2021 GWM P300 LT Used30 000 kmAutomaticDiesel</span></a>
        <a class="result-tile" href="/gwm-2">18R 629 995Fair Price2026 GWM Tank 300 Ultra Luxury Used50 kmAutomaticDiesel</span></a>
        <a class="result-tile" href="/toyota-1">11R 369 995Fair Price2021 Toyota Hilux Raider AutoUsed241 929 km</a>
        <a class="result-tile" href="/noyear-1">R 149 900 Great Price GWM Steed (no readable year) 200 000 km</a>
      </body>
    </html>
  `;
  const gwmListings = parseAutoTraderListings(mockAtHtml, 'GWM');
  assert.strictEqual(gwmListings.length, 2, 'Only GWM cards with a readable year parse');
  assert.ok(gwmListings[0].url.includes('gwm-1'), 'Listing carries its deep link');
  assert.ok(gwmListings[0].final_price === 249900, 'Price parsed from concatenated tile');

  const toyotaListings = parseAutoTraderListings(mockAtHtml, 'Toyota', 'Hilux');
  assert.strictEqual(toyotaListings.length, 1, 'make+model filter keeps only Hilux');

  console.log('   ✅. Targeted parser: make/model filter + readable-year gate hold');

  console.log('\n🎉 ALL TRUARBITRAGE TESTS PASSED SUCCESSFULLY! (21/21 Suites)');
}).catch((err) => {
  console.error('\n❌ TEST FAILURE:', err?.message || err);
  process.exit(1);
);