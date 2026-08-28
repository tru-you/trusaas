import assert from 'assert';
import crypto from 'crypto';
import { normalizeViaRegex } from '../src/normalizer/regex-fastpath';
import { normalizeViaNativeScraper } from '../src/normalizer/native-scraper';
import { adjustForMileage, robustAverage } from '../src/engine/mileage';
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

  // Same vehicle tracked by two dealers — fingerprints must differ per tenant
  const fpA = generateVehicleFingerprint(testVehicle, 'dealer-a');
  const fpB = generateVehicleFingerprint(testVehicle, 'dealer-b');
  assert.notStrictEqual(fpA, fpB, 'Same car under two dealers gets distinct fingerprints');

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

  console.log('\n🎉 ALL TRUARBITRAGE TESTS PASSED SUCCESSFULLY! (14/14 Suites)');
})().catch((err) => {
  console.error('\n💥 TEST FAILURE:', err?.message || err);
  process.exit(1);
});