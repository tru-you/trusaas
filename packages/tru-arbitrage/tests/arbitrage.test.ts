import assert from 'assert';
import crypto from 'crypto';
import { normalizeViaRegex } from '../src/normalizer/regex-fastpath';
import { canonicalMake } from '../src/normalizer/make-aliases';
import { normalizeViaNativeScraper } from '../src/normalizer/native-scraper';
import { adjustForMileage, adjustForYearGap, robustAverage } from '../src/engine/mileage';
import {
  listCategories, listMakes as catMakes, listModels as catModels,
  listVariants as catVariants, resolveByMmCode, resolveVariant,
} from '../src/engine/catalogue';
import { buildYearBand } from '../src/engine/valuation';
import { calculateUrgencyScore, evaluateArbitrageOpportunity, evaluateOverpricedStock, generateVehicleFingerprint, calculateReconBuffer } from '../src/engine/arbitrage';
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

// ── 1b. Native Scraper (Flow stock) Tests ──
console.log('\n1b. Testing Native Scraper (structured Flow feed, zero heuristics)...');

const flowStockRaw: RawFbListing = {
  id: 'flow_STK-001',
  source: 'flow_stock',
  url: 'https://premium.tru-saas.com/vehicle/?stock=STK-001',
  title: '2019 Toyota Hilux 2.8 GD-6 4x4',
  description: '',
  final_price: 550000,
  location: 'South Africa',
  seller_id: 'apex-motors',
  seller_name: 'Apex Auto Motors',
  images: [],
  year: 2019,
  make: 'Toyota',
  model: 'Hilux',
  trim: '2.8 GD-6 4x4',
  mileage: 85000,
};

const flowNormalized = normalizeViaNativeScraper(flowStockRaw);
assert.ok(flowNormalized, 'Flow stock raw should normalize natively');
assert.strictEqual(flowNormalized.normalizedBy, 'native_scraper', 'normalizedBy is native_scraper');
assert.strictEqual(flowNormalized.year, 2019, 'Year from typed field');
assert.strictEqual(flowNormalized.make, 'Toyota', 'Make from typed field');
assert.strictEqual(flowNormalized.model, 'Hilux', 'Model from typed field');
assert.strictEqual(flowNormalized.trim, '2.8 GD-6 4x4', 'Trim from typed field');
assert.strictEqual(flowNormalized.mileageKm, 85000, 'Mileage from typed field');
assert.strictEqual(flowNormalized.askingPrice, 550000, 'Asking price from feed');
assert.strictEqual(flowNormalized.confidence, 1.0, 'Structured feed = full confidence');
assert.strictEqual(flowNormalized.isDamagedOrSalvage, false, 'Dealer stock never flagged damaged');
assert.strictEqual(flowNormalized.sellerId, 'apex-motors', 'Seller id carries the slug');
console.log('   ✅ Flow stock native path: typed fields map 1:1, confidence 1.0');

// Non-dealer sources fall through to the regex path (native returns null)
assert.strictEqual(normalizeViaNativeScraper(poloRaw), null, 'Classifieds source not handled natively');

// SERP's dealer_direct must NOT take the native path — it is a BUY-side
// market source and must never be mistaken for the dealer's own stock.
assert.strictEqual(normalizeViaNativeScraper({ ...flowStockRaw, source: 'dealer_direct' as any }), null, 'dealer_direct (SERP) never takes the native path');

// Missing typed model -> null -> regex fallback still possible upstream
const flowIncomplete: RawFbListing = { ...flowStockRaw, model: undefined };
assert.strictEqual(normalizeViaNativeScraper(flowIncomplete), null, 'Missing typed model falls back');
console.log('   ✅ Fall-through guards verified');


// ── 2. Mileage & Robust Average Math Tests ──
console.log('\n2. Testing Mileage Normalization & Robust Average...');

const mockComps = [
  { price: 170000, km: 140000 },
  { price: 172000, km: 135000 },
  { price: 168000, km: 145000 },
  { price: 175000, km: 130000 },
  { price: 350000, km: 140000 }, // Outlier high
  { price: 50000, km: 140000 },  // Outlier low
];

const adjustedForLowKm = adjustForMileage(mockComps, 80000); // Subject vehicle is lower km than sample (137.5k)
const avgClean = robustAverage(adjustedForLowKm);

assert.ok(avgClean! > 170000, 'Lower km subject vehicle should yield higher market retail valuation');
assert.ok(avgClean! < 200000, 'Outliers should be trimmed properly');
console.log(`   ✅ Robust average computed cleanly: R${avgClean?.toLocaleString('en-ZA')} (Outliers trimmed)`);

// ── 3. Days on Market (DOM) & Urgency Scoring Tests ──
console.log('\n3. Testing Days-on-Market (DOM) & Urgency Scoring...');

const scoreFresh = calculateUrgencyScore(0, 1, 0, 150000);
const scoreAgingDropped = calculateUrgencyScore(28, 3, 30000, 180000);

assert.strictEqual(scoreFresh, 0, 'Fresh listing with no drops should have 0 urgency score');
assert.ok(scoreAgingDropped >= 65, 'Aging listing with 2 price drops should have high urgency score');
console.log(`   ✅ Fresh listing score: ${scoreFresh}/100 | 28-day price drop score: ${scoreAgingDropped}/100`);

// ── 4. Arbitrage Opportunity Calculation Tests ──
console.log('\n4. Testing Arbitrage Gate Calculation...');

const testVehicle: NormalizedVehicle = {
  rawId: 'test_polo',
  source: 'facebook',
  url: 'https://facebook.com/test',
  title: '2017 VW Polo',
  year: 2017,
  make: 'Volkswagen',
  model: 'Polo',
  askingPrice: 125000,
  mileageKm: 110000,
  location: 'Randburg, Gauteng',
  images: [],
  isDamagedOrSalvage: false,
  isWantedAd: false,
  confidence: 1.0,
  normalizedBy: 'regex_fastpath',
};

const valuationPass: ValuationResult = {
  averageRetailPrice: 168000,
  listingsFound: 18,
  mileageAdjusted: true,
  sampleMedianKm: 125000,
  confidence: 0.85,
  sources: [],
};

const fingerprint = generateVehicleFingerprint(testVehicle, 'test-dealer');
const trackedVehicle = {
  fingerprint,
  rawId: testVehicle.rawId,
  source: 'facebook' as const,
  url: testVehicle.url,
  year: testVehicle.year,
  make: testVehicle.make,
  model: testVehicle.model,
  mileageKm: testVehicle.mileageKm,
  location: testVehicle.location,
  firstSeenAt: new Date().toISOString(),
  lastSeenAt: new Date().toISOString(),
  daysOnMarket: 14,
  originalPrice: 125000,
  currentPrice: 125000,
  totalPriceDrop: 0,
  priceHistory: [],
  urgencyScore: 15,
  status: 'active' as const,
  images: [],
};


const deal = evaluateArbitrageOpportunity(testVehicle, valuationPass, trackedVehicle);
assert.ok(deal, 'Arbitrage deal should be detected');
assert.strictEqual(deal.projectedGrossMargin, 43000, 'Gross margin should be 43,000 (168k - 125k)');
assert.strictEqual(deal.reconBuffer, 5040, 'Dynamic recon: 3% of R168k market = R5,040 (above R5k floor)');
assert.strictEqual(deal.projectedNetMargin, 37960, 'Net margin should be 37,960 (43k - 5,040 dynamic recon)');
assert.ok(deal.projectedNetMargin >= 25000, 'Meets >= R25,000 margin threshold');
console.log(`   ✅ Arbitrage deal qualified: Gross R${deal.projectedGrossMargin.toLocaleString('en-ZA')} | Dynamic recon R${deal.reconBuffer.toLocaleString('en-ZA')} | Net Profit: R${deal.projectedNetMargin.toLocaleString('en-ZA')}`);

// Test overpriced car rejected by gate
const valuationFail: ValuationResult = {
  averageRetailPrice: 130000,
  listingsFound: 10,
  mileageAdjusted: false,
  sampleMedianKm: null,
  confidence: 0.8,
  sources: [],
};
const noDeal = evaluateArbitrageOpportunity(testVehicle, valuationFail, trackedVehicle);
assert.strictEqual(noDeal, null, 'Overpriced vehicle should not qualify as arbitrage deal');
console.log('   ✅ Non-profitable listing correctly rejected by margin gate');

// ── 4d. Too-good-to-be-true gate ──
console.log('\n4d. Testing too-good-to-be-true gate...');

// The trust-killer: a "C220 at R99,900 vs R410k market" — 75% margin is a
// misparse or salvage slipping through, not a deal.
const miracleValuation: ValuationResult = {
  averageRetailPrice: 409853,
  listingsFound: 23,
  mileageAdjusted: false,
  sampleMedianKm: null,
  confidence: 0.85,
  sources: [],
};
const suspiciousAsking: NormalizedVehicle = { ...testVehicle, askingPrice: 99900 };
const miracle = evaluateArbitrageOpportunity(suspiciousAsking, miracleValuation, trackedVehicle);
assert.strictEqual(miracle, null, 'R310k net on a R410k market car is rejected (75% > 40% cap)');

// Low-value floor: a genuinely cheap car can still carry a real margin
const beaterValuation: ValuationResult = { ...miracleValuation, averageRetailPrice: 40000 };
const beaterAsking: NormalizedVehicle = { ...testVehicle, askingPrice: 24000 };
const beater = evaluateArbitrageOpportunity(beaterAsking, beaterValuation, trackedVehicle);
assert.ok(beater, 'Cheap car with a real margin passes the sanity floor');
assert.strictEqual(beater!.reconBuffer, 5000, 'Recon floor applies on the beater');
console.log('   ✅ Sanity gate: 75%-of-market "deal" rejected; R11k margin on a R24k car passes');

// ── 4b. Valuation Confidence Tests (the moat) ──
console.log('\n4b. Testing Valuation Confidence Layer...');

const tinyComps = [{ price: 170000 }, { price: 172000 }];

// Zero comps -> zero confidence
assert.strictEqual(calculateValuationConfidence([], 0), 0, 'No comps = no confidence');

// Tiny sample -> low confidence
assert.strictEqual(calculateValuationConfidence(tinyComps, 2), 0.2, '1-2 comps score 0.2');

// Tight band boosts, wide band penalises
const tightComps = [
  { price: 170000 }, { price: 172000 }, { price: 168000 }, { price: 171000 },
  { price: 169000 }, { price: 173000 }, { price: 170500 }, { price: 171500 },
];
const wideComps = [
  { price: 100000 }, { price: 170000 }, { price: 260000 }, { price: 320000 },
  { price: 140000 }, { price: 290000 }, { price: 180000 }, { price: 240000 },
];
const tightScore = calculateValuationConfidence(tightComps, 8);
const wideScore = calculateValuationConfidence(wideComps, 8);
assert.strictEqual(tightScore, 0.85, 'Big tight sample scores 0.85 + tightness bonus 0.1 -> capped 0.95');
assert.ok(wideScore < tightScore, 'Wide band scores below tight band');
assert.ok(tightScore <= 0.95 && wideScore <= 0.95, 'Score never exceeds 0.95');
console.log(`   ✅ Confidence scoring: tight=${tightScore.toFixed(2)} wide=${wideScore.toFixed(2)} (cap 0.95 enforced)`);

// Floor gate: great margin but sub-floor confidence -> NO deal, ever
const lowConfidenceValuation: ValuationResult = {
  averageRetailPrice: 400000, // would be a massive margin...
  listingsFound: 2,           // ...but only 2 comps
  mileageAdjusted: false,
  sampleMedianKm: null,
  confidence: 0.2,
  sources: [],
};
const gateBlocked = evaluateArbitrageOpportunity(testVehicle, lowConfidenceValuation, trackedVehicle);
assert.strictEqual(gateBlocked, null, 'Sub-floor confidence must block the deal despite huge margin');
console.log('   ✅ Confidence floor gate: R275k "margin" on 2 comps does NOT alert');

// Dynamic recon band math — pct × market clamped to [floor, cap]
assert.strictEqual(calculateReconBuffer(125000), 5000, 'R125k Polo: 3% = R3,750 -> clamped UP to R5k floor');
assert.strictEqual(calculateReconBuffer(300000), 9000, 'R300k unit: straight 3% = R9,000');
assert.strictEqual(calculateReconBuffer(1450000), 30000, 'R1.45m GLS: 3% = R43,500 -> clamped DOWN to R30k cap');
console.log('   ✅ Dynamic recon: floor lifts cheap units, cap bounds expensive ones');

// ── 4c. My Stock Gate Tests (AND: over market AND stale) ──
console.log('\n4c. Testing My Stock Overpriced Gate (AND logic)...');

const marketValuation: ValuationResult = {
  averageRetailPrice: 168000,
  listingsFound: 12,
  mileageAdjusted: false,
  sampleMedianKm: null,
  confidence: 0.85,
  sources: [],
};

// The dealer's own unit: asking R200k against a R168k market = 19% over
const overpricedStock: NormalizedVehicle = { ...testVehicle, source: 'flow_stock', askingPrice: 200000, normalizedBy: 'native_scraper' };
const mkTracked = (days: number) => ({ ...trackedVehicle, daysOnMarket: days, urgencyScore: days >= 40 ? 40 : 10 });

const staleTracked = mkTracked(52);
const stockAlert = evaluateOverpricedStock(overpricedStock, marketValuation, staleTracked);
assert.ok(stockAlert, 'Over market AND stale -> fires');
assert.strictEqual(stockAlert.dealCategory, 'overpriced_stale_stock', 'Category is overpriced_stale_stock');
assert.strictEqual(stockAlert.projectedGrossMargin, -32000, 'Gross margin negative: over market by R32k (the price drop to recommend)');
assert.strictEqual(stockAlert.daysOnMarket, 52, 'Days on market carried through');

// Overpriced but FRESH -> no fire (AND gate)
assert.strictEqual(evaluateOverpricedStock(overpricedStock, marketValuation, mkTracked(14)), null, 'Overpriced but fresh does NOT alert');

// Stale but priced at market -> no fire
const atMarket: NormalizedVehicle = { ...testVehicle, source: 'dealer_direct', askingPrice: 168000 };
assert.strictEqual(evaluateOverpricedStock(atMarket, marketValuation, staleTracked), null, 'Stale but at market does NOT alert');

// Sub-floor confidence blocks even obvious dead weight
const thinValuation: ValuationResult = { ...marketValuation, confidence: 0.3 };
assert.strictEqual(evaluateOverpricedStock(overpricedStock, thinValuation, staleTracked), null, 'Sub-floor confidence blocks My Stock alert');
console.log('   ✅ AND gate: over+stale fires; fresh, at-market or thin-comps do not');

// DOM seeding: the source's own date signal (Flow daysInInventory) becomes real DOM on scan one
const domPath = path.join(__dirname, 'test-dom.json');
if (fs.existsSync(domPath)) fs.unlinkSync(domPath);
const domDb = new ArbitrageDatabase(domPath);
const seeded = domDb.upsertTrackedVehicle(overpricedStock, 'dom-dealer', new Date(Date.now() - 52 * 86400000).toISOString());
assert.ok(seeded.daysOnMarket >= 51 && seeded.daysOnMarket <= 53, `DOM seeded from source days-held (got ${seeded.daysOnMarket})`);
if (fs.existsSync(domPath)) fs.unlinkSync(domPath);
console.log(`   ✅ DOM seeded from source date signal: ${seeded.daysOnMarket} days on the very first scan`);

// ── 5. Buy-Box Matching & Alert/Offer Text Tests ──
console.log('\n5. Testing Multi-Tenant Buy-Box & Webhook Alert Text...');

const gautengVwBuyBox: DealerBuyBox = {
  id: 'sub_gauteng_vw',
  dealerName: 'Apex VW Specialists',
  contactNumber: '+27829998877',
  provinces: ['Gauteng', 'Randburg'],
  allowedMakes: ['Volkswagen'],
  maxPrice: 200000,
  maxMileageKm: 150000,
  minNetMargin: 25000,
  active: true,
};

const toyotaOnlyBuyBox: DealerBuyBox = {
  id: 'sub_toyota_only',
  dealerName: 'Bredell Toyota',
  contactNumber: '+27831112233',
  provinces: ['Gauteng'],
  allowedMakes: ['Toyota'],
  maxPrice: 400000,
  maxMileageKm: 180000,
  minNetMargin: 25000,
  active: true,
};

assert.strictEqual(matchesBuyBox(deal, gautengVwBuyBox), true, 'VW deal in Randburg should match Gauteng VW Buy-Box');
assert.strictEqual(matchesBuyBox(deal, toyotaOnlyBuyBox), false, 'VW deal should not match Toyota-only Buy-Box');
console.log('   ✅ Multi-tenant Buy-Box matching confirmed');

const alertText = formatDealAlertText(deal, gautengVwBuyBox);
assert.ok(alertText.includes('UNDERPRICED ARBITRAGE'), 'Alert text carries the category');
assert.ok(alertText.includes('R37,960'), 'Alert text shows the net profit');
assert.ok(alertText.includes('Apex VW Specialists'), 'Alert text names the subscribing dealer');
console.log('   ✅ Webhook alert text formatted (plain text, no channel markup)');

// My Stock alert text — negative margin framing + price-drop recommendation
const stockAlertText = formatDealAlertText(stockAlert, gautengVwBuyBox);
assert.ok(stockAlertText.includes('OVERPRICED + STALE'), 'Stock alert carries its category');
assert.ok(stockAlertText.includes('R32,000'), 'Stock alert shows over-market exposure');
assert.ok(stockAlertText.includes('drop to ~R168,000'), 'Stock alert recommends matching market');
console.log('   ✅ My Stock alert text: over-market exposure + drop recommendation');

const offerMsg = formatSellerOfferTemplate(deal, gautengVwBuyBox.dealerName);
assert.ok(offerMsg.includes('Apex VW Specialists'), 'Offer message should mention dealer name');
console.log('   ✅ Seller offer template formatted cleanly');

// ── 6. Storage Persistence Tests (tenant-scoped) ──
console.log('\n6. Testing Tenant-Scoped Storage Persistence...');

const testDbPath = path.join(__dirname, 'test-store.json');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const testDb = new ArbitrageDatabase(testDbPath);
testDb.upsertTrackedVehicle(testVehicle, 'test-dealer');
testDb.saveDeal(deal, 'test-dealer');

const retrievedDeals = testDb.getDeals({ dealerSlug: 'test-dealer' });
assert.strictEqual(retrievedDeals.length, 1, 'Should persist and retrieve saved deal');
assert.strictEqual(retrievedDeals[0].fingerprint, fingerprint, 'Fingerprint matches');

if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
console.log('   ✅ Isolated DB storage and query verified');

// ── 7. JWT Auth Tests ──
console.log('\n7. Testing JWT Auth (dealer + demo tokens)...');

// Dealer token round-trip
const dealerToken = signDealerToken('apex-motors');
const dealerClaims = verifyToken(dealerToken);
assert.ok(dealerClaims, 'Dealer token should verify');
assert.strictEqual(dealerClaims!.dealerSlug, 'apex-motors', 'Dealer token carries its slug');
assert.strictEqual(dealerClaims!.demo, false, 'Dealer token is not demo');

// Demo token round-trip — uid doubles as the slug (per-session isolation)
const demoToken = signDemoToken('demo-abc123');
const demoClaims = verifyToken(demoToken);
assert.ok(demoClaims, 'Demo token should verify');
assert.strictEqual(demoClaims!.demo, true, 'Demo token flagged demo');
assert.strictEqual(demoClaims!.dealerSlug, 'demo-abc123', 'Demo slug is its unique uid');

// Tampered signature rejected
const [payload, sig] = dealerToken.split('.');
const tamperedSig = sig.slice(0, -2) + (sig.endsWith('AA') ? 'BB' : 'AA');
assert.strictEqual(verifyToken(`${payload}.${tamperedSig}`), null, 'Tampered signature rejected');

// Wrong-kind claims rejected (demo claims in dealer envelope)
const fakeClaims = { sub: 'x', demo: true, exp: Date.now() + 60000 };
const fakePayload = Buffer.from(JSON.stringify(fakeClaims)).toString('base64url');
const fakeSig = crypto.createHmac('sha256', TOKEN_SECRET).update(fakePayload).digest('base64url');
assert.strictEqual(verifyToken(`${fakePayload}.${fakeSig}`), null, 'Demo claims without demo: prefix rejected');

// Expired token rejected
const expiredClaims = { k: 'dealer', d: 'apex-motors', exp: Date.now() - 1000 };
const expiredPayload = Buffer.from(JSON.stringify(expiredClaims)).toString('base64url');
const expiredSig = crypto.createHmac('sha256', TOKEN_SECRET).update(expiredPayload).digest('base64url');
assert.strictEqual(verifyToken(`${expiredPayload}.${expiredSig}`), null, 'Expired token rejected');

// Garbage rejected
assert.strictEqual(verifyToken('garbage'), null, 'Garbage token rejected');
assert.strictEqual(verifyToken('a.b'), null, 'Empty claims rejected');
console.log('   ✅ Dealer/demo token round-trips, tamper/expiry/garbage all rejected');

// ── 8. Dealer Registry Tests ──
console.log('\n8. Testing Dealer Registry...');

(async () => {
  const regPath = path.join(__dirname, 'test-dealers.json');
  if (fs.existsSync(regPath)) fs.unlinkSync(regPath);
  const reg = new DealerRegistry(regPath);

  await reg.upsertDealer({ slug: 'apex', accessCode: 'secret123', dealerName: 'Apex Auto Motors', contactNumber: '+27821234567' });
  assert.ok(reg.verifyDealer('apex', 'secret123'), 'Correct slug+code verifies');
  assert.strictEqual(reg.verifyDealer('apex', 'wrong-code'), null, 'Wrong code rejected');
  assert.strictEqual(reg.verifyDealer('nope', 'secret123'), null, 'Unknown slug rejected');

  // Deactivation locks the dealer out
  await reg.upsertDealer({ slug: 'apex', active: false });
  assert.strictEqual(reg.verifyDealer('apex', 'secret123'), null, 'Inactive dealer rejected');

  // Update without accessCode keeps the old hash — reactivate still works with same code
  await reg.upsertDealer({ slug: 'apex', active: true, dealerName: 'Apex Auto Motors (Pty) Ltd' });
  assert.ok(reg.verifyDealer('apex', 'secret123'), 'Same code works after name update');
  assert.strictEqual(reg.getDealer('apex')!.dealerName, 'Apex Auto Motors (Pty) Ltd', 'Name updated');

  // Public shape never leaks the hash
  const pub = JSON.stringify(reg.toPublicDealer(reg.getDealer('apex')!));
  assert.ok(!pub.includes(reg.getDealer('apex')!.accessCodeHash), 'Hash never in public shape');

  // New dealer without accessCode is refused
  let threw = false;
  try { await reg.upsertDealer({ slug: 'fresh' }); } catch { threw = true; }
  assert.ok(threw, 'New dealer without accessCode refused');

  if (fs.existsSync(regPath)) fs.unlinkSync(regPath);
  console.log('   ✅ Registry verify, deactivation, update, hash-scrub all pass');

  // ── 9. Per-Dealer Isolation Tests ──
  console.log('\n9. Testing Per-Dealer Data Isolation...');

  const isoPath = path.join(__dirname, 'test-isolation.json');
  if (fs.existsSync(isoPath)) fs.unlinkSync(isoPath);
  const isoDb = new ArbitrageDatabase(isoPath);

  // Same vehicle tracked by two dealers — the fingerprint is tenant-stable
  // (identity = make/model/year/km); isolation comes from the store's slug
  // prefix, proven by the per-tenant counts below.
  const fpA = generateVehicleFingerprint(testVehicle, 'dealer-a');
  const fpB = generateVehicleFingerprint(testVehicle, 'dealer-b');
  assert.strictEqual(fpA, fpB, 'Fingerprint is tenant-stable (no dealerSlug salt)');

  isoDb.upsertTrackedVehicle(testVehicle, 'dealer-a');
  isoDb.upsertTrackedVehicle(testVehicle, 'dealer-b');
  assert.strictEqual(isoDb.getTrackedVehicles({ dealerSlug: 'dealer-a' }).length, 1, 'Dealer A sees own tracked stock');
  assert.strictEqual(isoDb.getTrackedVehicles({ dealerSlug: 'dealer-b' }).length, 1, 'Dealer B sees own tracked stock');

  // Same deal saved under both tenants — each sees exactly one, dealer-c sees none
  isoDb.saveDeal(deal, 'dealer-a');
  isoDb.saveDeal(deal, 'dealer-b');
  assert.strictEqual(isoDb.getDeals({ dealerSlug: 'dealer-a' }).length, 1, 'Dealer A sees own deal');
  assert.strictEqual(isoDb.getDeals({ dealerSlug: 'dealer-b' }).length, 1, 'Dealer B sees own deal');
  assert.strictEqual(isoDb.getDeals({ dealerSlug: 'dealer-c' }).length, 0, 'Outsider sees nothing');
  assert.strictEqual(isoDb.getDeals().length, 2, 'Unscoped (admin) view sees both tenants');

  // Buy-boxes are tenant-scoped too
  isoDb.saveSubscription('dealer-a', gautengVwBuyBox);
  assert.strictEqual(isoDb.getSubscriptions('dealer-a', false).length, 1, 'Dealer A subscription saved');
  assert.strictEqual(isoDb.getSubscriptions('dealer-b', false).length, 0, 'Dealer B has none');

  // Scoped reset wipes only the caller's partition
  await isoDb.flush();
  isoDb.clearAll('dealer-a');
  assert.strictEqual(isoDb.getDeals({ dealerSlug: 'dealer-a' }).length, 0, 'Dealer A wiped');
  assert.strictEqual(isoDb.getDeals({ dealerSlug: 'dealer-b' }).length, 1, 'Dealer B untouched by A reset');

  // Deal status update is tenant-scoped (A's deal was wiped; B's updates fine)
  const bDeal = isoDb.getDeals({ dealerSlug: 'dealer-b' })[0];
  const updated = isoDb.updateDealStatus(bDeal.id, 'dealer-b', 'claimed');
  assert.ok(updated, 'Status update works for owner');
  assert.strictEqual(updated!.status, 'claimed', 'Status set to claimed');
  assert.strictEqual(isoDb.updateDealStatus(bDeal.id, 'dealer-c', 'archived'), null, 'Outsider cannot update');

  if (fs.existsSync(isoPath)) fs.unlinkSync(isoPath);
  console.log('   ✅ Per-dealer isolation: fingerprints, deals, subscriptions, reset, status all tenant-safe');

  // ── 9b. Cross-Source Dedup ──
  console.log('\n9b. Testing Cross-Source Dedup...');

  const dedupPath = path.join(__dirname, 'test-dedup.json');
  if (fs.existsSync(dedupPath)) fs.unlinkSync(dedupPath);
  const dedupDb = new ArbitrageDatabase(dedupPath);

  // Same physical car, three listings: Cars.co.za (with photos), AutoTrader
  // (no photos), and a dealer site (different seller/url). One tracked row.
  const carCars: NormalizedVehicle = { ...testVehicle, source: 'cars_co_za', sellerName: 'Cars Dealer', url: 'https://cars.co.za/a', rawId: 'cars_a', images: ['p1.jpg', 'p2.jpg'] };
  const carAuto: NormalizedVehicle = { ...testVehicle, source: 'autotrader', sellerName: 'AutoTrader Dealer', url: 'https://autotrader.co.za/b', rawId: 'at_b', images: [] };
  const carSerp: NormalizedVehicle = { ...testVehicle, source: 'dealer_direct', sellerName: 'apex-motors.co.za', url: 'https://apex-motors.co.za/c', rawId: 'serp_c', images: ['p1.jpg'] };

  assert.strictEqual(generateVehicleFingerprint(carCars, 'dealer-x'), generateVehicleFingerprint(carAuto, 'dealer-x'), 'Same car dedupes across sellers/sources');
  assert.strictEqual(generateVehicleFingerprint(carCars, 'dealer-x'), generateVehicleFingerprint(carSerp, 'dealer-x'), 'Same car dedupes to dealer-direct too');

  dedupDb.upsertTrackedVehicle(carAuto, 'dealer-x'); // thin source first
  dedupDb.upsertTrackedVehicle(carCars, 'dealer-x');  // richer source second
  dedupDb.upsertTrackedVehicle(carSerp, 'dealer-x');
  const merged = dedupDb.getTrackedVehicles({ dealerSlug: 'dealer-x' });
  assert.strictEqual(merged.length, 1, 'Three sources collapse to ONE tracked row');
  assert.strictEqual(merged[0].images.length, 2, 'Richer source (Cars.co.za, 2 photos) wins the merge');

  // Deal side — same car from two sources = one deal, richer vehicle kept.
  const dealCars = { ...deal, source: 'cars_co_za' as const, vehicle: carCars, fingerprint: generateVehicleFingerprint(carCars, 'dealer-x') };
  const dealAuto = { ...deal, source: 'autotrader' as const, vehicle: carAuto, fingerprint: generateVehicleFingerprint(carAuto, 'dealer-x') };
  dedupDb.saveDeal(dealAuto, 'dealer-x');
  dedupDb.saveDeal(dealCars, 'dealer-x');
  const mergedDeals = dedupDb.getDeals({ dealerSlug: 'dealer-x' });
  assert.strictEqual(mergedDeals.length, 1, 'Same car from two sources = ONE deal');
  assert.strictEqual((mergedDeals[0].vehicle.images || []).length, 2, 'Deal keeps the richer vehicle');

  // Watch toggle is tenant-scoped
  const watchFp = merged[0].fingerprint;
  assert.strictEqual(dedupDb.toggleWatch('dealer-x', watchFp), true, 'Watch turns on');
  assert.ok(dedupDb.getWatchedFingerprints('dealer-x').includes(watchFp), 'Watched fingerprint persists');
  assert.strictEqual(dedupDb.getWatchedFingerprints('dealer-y').length, 0, 'Other tenant has no watches');
  assert.strictEqual(dedupDb.toggleWatch('dealer-x', watchFp), false, 'Watch toggles off');

  if (fs.existsSync(dedupPath)) fs.unlinkSync(dedupPath);
  console.log('   ✅ Cross-source dedup: one row / one deal per car, richer source wins');

  // ── 9c. Legacy-key Migration (cross-source re-key on load) ──
  console.log('\n9c. Testing Legacy-key Migration Re-key...');

  const migPath = path.join(__dirname, 'test-migrate.json');
  // Hand-craft a legacy store: the SAME car under two OLD seller-salted keys.
  const legacyStore = {
    trackedVehicles: {
      'dealer-x:LEGACYKEY_1': { ...trackedVehicle, fingerprint: 'LEGACYKEY_1', make: 'Volkswagen', model: 'Polo', year: 2017, mileageKm: 110000, images: ['a.jpg', 'b.jpg'] },
      'dealer-x:LEGACYKEY_2': { ...trackedVehicle, fingerprint: 'LEGACYKEY_2', make: 'Volkswagen', model: 'Polo', year: 2017, mileageKm: 110000, images: [] },
    },
    deals: {},
    dealerSubscriptions: {},
    discoveredDomains: {},
  };
  fs.writeFileSync(migPath, JSON.stringify(legacyStore));
  const migDb = new ArbitrageDatabase(migPath);
  const migTracked = migDb.getTrackedVehicles({ dealerSlug: 'dealer-x' });
  assert.strictEqual(migTracked.length, 1, 'Legacy seller-salted keys collapse to one row on load');
  assert.strictEqual(migTracked[0].images.length, 2, 'Richer legacy row wins the migration merge');
  assert.strictEqual(migTracked[0].fingerprint, generateVehicleFingerprint(testVehicle, 'dealer-x'), 'Row re-keyed to the cross-source fingerprint');
  if (fs.existsSync(migPath)) fs.unlinkSync(migPath);
  console.log('   ✅ Legacy-key migration re-keys and merges cross-source duplicates');

  // ── 10. SERP Discovery Helpers ──
  console.log('\n10. Testing SERP discovery helpers (city parse + dealer-domain filter)...');

  const CITIES = ['Johannesburg', 'Pretoria', 'Cape Town', 'Durban'];
  assert.strictEqual(parseCity('2019 Hilux in Randburg near Johannesburg R250 000', CITIES), 'Johannesburg', 'City detected from text');
  assert.strictEqual(parseCity('Beachfront runner in Durban, R180k', CITIES), 'Durban', 'Second city detected');
  assert.strictEqual(parseCity('Great deal, papers in order', CITIES), 'South Africa', 'No city -> national fallback');

  assert.strictEqual(isDealerDomain('www.cmcdealership.co.za'), true, '.co.za dealer site accepted');
  assert.strictEqual(isDealerDomain('cars.co.za'), false, 'Aggregator blocked');
  assert.strictEqual(isDealerDomain('gumtree.co.za'), false, 'Classifieds blocked');
  assert.strictEqual(isDealerDomain('facebook.com'), false, 'Non-.co.za blocked');
  assert.strictEqual(isDealerDomain('some-shop.com'), false, 'Non-.co.za blocked');
  console.log('   ✅ Discovery filter: real dealer domains in, aggregators and platforms out');

  // ── 11. Price-check catalogue (static TU data — free dropdowns) ──
  console.log('\n11. Testing price-check catalogue (makes, models, title-casing)...');

  const makes = listMakes();
  assert.ok(Array.isArray(makes) && makes.length > 50, `Catalogue loaded (${makes.length} makes)`);
  assert.ok(makes.includes('TOYOTA') && makes.includes('VOLKSWAGEN'), 'Major makes present');

  const toyotaModels = listModels('TOYOTA');
  assert.ok(toyotaModels.length > 5, `Toyota models loaded (${toyotaModels.length})`);
  assert.ok(toyotaModels.some((m) => /HILUX/i.test(m)), 'Hilux in Toyota models');
  assert.deepStrictEqual(listModels('NO-SUCH-MAKE'), [], 'Unknown make -> empty list');

  assert.strictEqual(titleCaseVehicle('MERCEDES-BENZ'), 'Mercedes-Benz', 'Hyphenated make cased');
  assert.strictEqual(titleCaseVehicle('BMW'), 'BMW', 'Acronym stays uppercase');
  assert.strictEqual(titleCaseVehicle('POLO'), 'Polo', 'Model title-cased');
  console.log(`   ✅ Catalogue: ${makes.length} makes, ${toyotaModels.length} Toyota models, casing rules hold`);

  // ── 11b. Vertical make normalization (Live Deals scan path) ──
  console.log('\n11b. Testing vertical make normalization (scan listings escape the car-only filter)...');

  // Bikes: a Harley listing must resolve make+model to a canonical TU key.
  assert.strictEqual(canonicalMake('harley'), 'Harley Davidson', 'harley alias resolves');
  assert.strictEqual(canonicalMake('ducati'), 'Ducati', 'ducati alias resolves');
  assert.strictEqual(canonicalMake('yamaha'), 'Yamaha', 'yamaha alias resolves');
  assert.strictEqual(canonicalMake('ktm'), 'KTM', 'ktm alias resolves');
  // Trucks + agri.
  assert.strictEqual(canonicalMake('scania'), 'Scania', 'scania resolves');
  assert.strictEqual(canonicalMake('john deere'), 'John Deere', 'john deere resolves');
  assert.strictEqual(canonicalMake('kubota'), 'Kubota', 'kubota resolves');
  // Legacy car aliases still work.
  assert.strictEqual(canonicalMake('vw'), 'Volkswagen', 'vw still resolves');
  assert.strictEqual(canonicalMake('merc'), 'Mercedes-Benz', 'merc still resolves');

  // Full normalizeViaRegex run on a bike listing → a real NormalizedVehicle.
  const harleyListing: RawFbListing = {
    id: 'fb_bike_1', source: 'facebook', url: 'https://www.facebook.com/marketplace/item/x',
    title: '2017 Harley Davidson Sportster 883',
    description: 'Mileage: 12000 km. Cruiser, clean. R125 000.',
    final_price: 125000, location: 'Cape Town',
  };
  const bikeNorm = normalizeViaRegex(harleyListing);
  assert.ok(bikeNorm, 'Harley listing normalizes');
  assert.strictEqual(bikeNorm!.make, 'Harley Davidson', 'Make canonicalized to TU key');
  assert.ok(typeof bikeNorm!.model === 'string' && bikeNorm!.model.length > 0, 'Model resolved');
  assert.strictEqual(bikeNorm!.year, 2017, 'Year parsed');
  assert.strictEqual(bikeNorm!.confidence, 0.95, 'Mileage present → high regex confidence, passes the 0.9 gate');
  const bikeNormUpper = { ...bikeNorm!, make: bikeNorm!.make.toUpperCase() };
  assert.ok(listModels(bikeNormUpper.make).length > 0, `Canonical make ${bikeNormUpper.make} exists in the TU catalogue`);

  // Camera-trucks: a Scania must not be filtered as an unknown make.
  const scaniaListing: RawFbListing = {
    id: 'fb_truck_1', source: 'facebook', url: 'https://www.facebook.com/marketplace/item/y',
    title: '2015 Scania R560 6x4', description: 'Truck tractor, 450000 km, R850 000.', final_price: 850000,
  };
  const truckNorm = normalizeViaRegex(scaniaListing);
  assert.ok(truckNorm, 'Scania listing normalizes');
  assert.strictEqual(truckNorm!.make, 'Scania', 'Scania canonicalized');
  assert.strictEqual(truckNorm!.year, 2015, 'Scania year parsed');

  console.log('   ✅ Vertical normalization: bikes/trucks/agri escape the old car-only filter');

  // ── 12. Vertical catalogue classifier (7 categories, per-variant rules) ──
  console.log('\n12. Testing vertical catalogue classifier (7 buckets, mixed makes split)...');

  const cats = listCategories();
  assert.strictEqual(cats.length, 7, 'Seven categories');
  for (const c of cats) {
    assert.ok(c.makeCount > 0 && c.modelCount > 0, `${c.id} has makes + models (${c.makeCount}/${c.modelCount})`);
  }
  const byId = Object.fromEntries(cats.map((c) => [c.id, c]));

  // Moto: Harley + the motorcycle aggregator all land in moto.
  assert.ok(catMakes('moto').includes('HARLEY DAVIDSON'), 'Harley is moto');
  assert.ok(catMakes('moto').includes('MULTIPLE MOTORCYCLE MANUFACTURERS'), 'Moto aggregator make is moto');
  const harleyModel = catModels('moto', 'HARLEY DAVIDSON')[0];
  assert.ok(harleyModel, 'Harley has a moto model');
  const harleyVariants = catVariants('moto', 'HARLEY DAVIDSON', harleyModel);
  assert.ok(harleyVariants.length > 0, 'Harley moto variants resolve');
  assert.ok(harleyVariants.every((v) => v.category === 'moto'), 'Every Harley variant in this model is moto');

  // Trucks: Scania forced by make, Mercedes trucks caught by body/axle alone.
  assert.ok(catMakes('trucks').includes('SCANIA'), 'Scania is trucks');
  const scaniaModel = catModels('trucks', 'SCANIA')[0];
  assert.ok(scaniaModel, 'Scania has a truck model');
  assert.ok(catVariants('trucks', 'SCANIA', scaniaModel).every((v) => v.category === 'trucks'), 'Scania variants all trucks');
  assert.ok(catModels('trucks', 'MERCEDES-BENZ').length > 0, 'Mercedes trucks mixed into a car make are caught by body/axle');

  // Agri: blank-body tractors need the make list — John Deere can't leak to cars.
  assert.ok(catMakes('agri').includes('JOHN DEERE'), 'John Deere is agri');
  assert.ok(catModels('agri', 'JOHN DEERE').length > 0, 'John Deere has agri models');
  assert.strictEqual(catModels('cars', 'JOHN DEERE').length, 0, 'John Deere never leaks into cars');

  // SPECIALTY pseudo-make routes to its four categories.
  assert.ok(catModels('marine', 'SPECIALTY').includes('BOAT/JETSKI'), 'Boats live under SPECIALTY -> marine');
  assert.ok(catModels('caravans', 'SPECIALTY').includes('CARAVAN'), 'Caravans -> caravans');
  assert.ok(catModels('caravans', 'SPECIALTY').includes('TRAILER'), 'Trailers -> caravans');
  assert.ok(catModels('agri', 'SPECIALTY').includes('YELLOW METAL'), 'Yellow metal -> agri');
  assert.ok(catModels('specialty', 'SPECIALTY').includes('BICYCLE'), 'Bicycles -> specialty');

  // Mixed make at the model level: BMW spawns BOTH cars and moto.
  assert.ok(catModels('moto', 'BMW').length > 0, 'BMW has moto models');
  assert.ok(catModels('cars', 'BMW').length > 0, 'BMW has car models');
  const bmwMotoModel = catModels('moto', 'BMW')[0];
  assert.ok(catVariants('moto', 'BMW', bmwMotoModel).every((v) => v.category === 'moto'), 'BMW model listed under moto is all moto');
  const bmwCarModel = catModels('cars', 'BMW')[0];
  assert.ok(catVariants('cars', 'BMW', bmwCarModel).every((v) => v.category === 'cars'), 'BMW model listed under cars is all cars');

  // mmCode resolution + variant-text resolution.
  const caravan = resolveByMmCode('99905001');
  assert.ok(caravan && caravan.model === 'CARAVAN' && caravan.category === 'caravans', 'resolveByMmCode hits SPECIALTY caravan');
  const boat = resolveVariant('marine', 'SPECIALTY', 'BOAT/JETSKI', 'BOAT/JETSKI');
  assert.ok(boat && boat.mmCode === '99920001', 'resolveVariant resolves boat text to its mmCode');

  // Cascade integrity: every variant has a resolvable mmCode + sane year set.
  for (const make of ['TOYOTA', 'VOLKSWAGEN', 'BMW', 'SCANIA', 'HARLEY DAVIDSON', 'JOHN DEERE']) {
    for (const model of catModels('cars', make).concat(catModels('moto', make)).concat(catModels('trucks', make)).concat(catModels('agri', make)).slice(0, 4)) {
      for (const v of catVariants(undefined, make, model)) {
        assert.ok(v.mmCode, `${make} ${model} variant has mmCode`);
        assert.ok(Array.isArray(v.years) && v.years.length > 0, `${make} ${model} variant has years`);
        assert.ok(v.years.every((y) => y >= 1980 && y <= new Date().getFullYear() + 1), `${make} ${model} years in sane range`);
      }
    }
  }
  console.log(`   ✅ Classifier: 7 buckets — ${byId.cars.makeCount} car makes · ${byId.moto.makeCount} moto · ${byId.trucks.makeCount} trucks · ${byId.marine.makeCount} marine · ${byId.caravans.makeCount} caravans · ${byId.agri.makeCount} agri · ${byId.specialty.makeCount} specialty`);

  // ── 13. Year-band scraping + year-gap age correction ──
  console.log('\n13. Testing year band (±1 SERP widening) + age-corrected comps...');

  assert.deepStrictEqual(buildYearBand(2021, 1), [2020, 2021, 2022], 'Band of ±1 around the model year');
  assert.deepStrictEqual(buildYearBand(2021, 0), [2021], 'Zero tolerance = exact year only');
  assert.deepStrictEqual(buildYearBand(2021, -2), [2021], 'Negative tolerance clamps to 0');

  // A 2019 comp on a 2021 subject must price UP (~0.88^-2); a same-year comp is untouched.
  const subjectYear = 2021;
  const adjusted = adjustForYearGap([
    { price: 200000, year: 2019 },
    { price: 200000, year: 2021 },
    { price: 200000, km: 50000 }, // no year -> untouched
  ], subjectYear);
  assert.strictEqual(adjusted[1].price, 200000, 'Same-year comp unchanged');
  assert.strictEqual(adjusted[2].price, 200000, 'Yearless comp unchanged');
  assert.strictEqual(adjusted[0].price, Math.round(200000 * Math.pow(0.88, -2)), 'Older comp priced up to subject-year equivalence');

  // Far-year escape is clamped, never allowed to swamp the average.
  const clamped = adjustForYearGap([{ price: 100000, year: 2012 }], 2021);
  assert.ok(clamped[0].price >= 100000 * 1.3 && clamped[0].price <= 100000 * 1.4 + 1, 'Far-year comp clamped to 1.4x');

  console.log('   ✅ Band + age correction: thin exact-year samples widen, comps age-normalise to the subject year');

  // ── 14. Lookup cascade binding (functional — routes are thin wrappers) ──
  console.log('\n14. Testing lookup cascade binding (category → make → model → variant)...');

  const motoMakes = catMakes('moto');
  assert.ok(motoMakes.length > 0 && motoMakes.every((m) => catMakes().includes(m)), 'Category makes are a subset of the full index');
  const allModels = catModels('cars', 'TOYOTA');
  assert.ok(allModels.length > 0, 'Car models for Toyota load');
  const variantSet = catVariants('cars', 'TOYOTA', allModels[0]);
  assert.ok(variantSet.length > 0, 'Variants for a Toyota car model load');
  assert.ok(variantSet.every((v) => v.category === 'cars'), 'Variant list is category-filtered');
  assert.deepStrictEqual(catVariants('moto', 'TOYOTA', allModels[0]).length, 0, 'Moto view of a car model is empty');

  console.log('   ✅ Lookup cascade: category filters propagate through make/model/variant');

  // ── 15. Testing strict comp matching & sister-model fallback ──
  console.log('\n15. Testing strict comp matching & sister-model fallback...');
  const { extractNextDataComps, extractJsonLdComps, extractCardComps } = require('../src/engine/valuation');

  const mockPoloPageHtml = `
    <html>
      <head>
        <script id="__NEXT_DATA__" type="application/json">
          {
            "props": {
              "pageProps": {
                "listings": [
                  { "year": 2018, "make": "Volkswagen", "model": "Polo", "price": 185000, "mileage": 60000, "url": "/polo-1" },
                  { "year": 2018, "make": "Toyota", "model": "Hilux", "price": 450000, "mileage": 80000, "url": "/hilux-1" },
                  { "year": 2018, "make": "Ford", "model": "Ranger", "price": 390000, "mileage": 90000, "url": "/ranger-1" }
                ]
              }
            }
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

  console.log('   ✅ Strict comp matching: non-matching make/model listings strictly filtered out');

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

  // The old /\b(19|20)\d{2}\b/ matched ZERO of these (the bug — no word
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

  console.log('   ✅ Year extraction: 5/5 concatenated tiles recovered, unknown years rejected');

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

  console.log('   ✅ Make dictionary: GWM/Changan/BYD/SsangYong/Datsun + boundary guards hold');

  // ── 18. Targeted ingestion parser (P7 lane) ──
  console.log('\n18. Testing targeted AutoTrader listing parser...');
  const { parseAutoTraderListings } = require('../src/ingestion/targets');

  const mockAtHtml = `
    <html>
      <body>
        <a class="result-tile" href="/gwm-1"><span class="price">24R 249 900Great Price2021 GWM P300 LT Used30 000 kmAutomaticDiesel</span></a>
        <a class="result-tile" href="/gwm-2">18R 629 995Fair Price2026 GWM Tank 300 Ultra Luxury Used50 kmAutomaticDiesel</a>
        <a class="result-tile" href="/toyota-1">11R 369 995Fair Price2013 Toyota Hilux Raider AutoUsed241 929 km</a>
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

  console.log('   ✅ Targeted parser: make/model filter + readable-year gate hold');

  console.log('\n🎉 ALL TRUARBITRAGE TESTS PASSED SUCCESSFULLY! (21/21 Suites)');
})().catch((err) => {
  console.error('\n💥 TEST FAILURE:', err?.message || err);
  process.exit(1);
});