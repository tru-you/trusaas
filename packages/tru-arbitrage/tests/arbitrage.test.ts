import assert from 'assert';
import { normalizeViaRegex } from '../src/normalizer/regex-fastpath';
import { adjustForMileage, robustAverage } from '../src/engine/mileage';
import { calculateUrgencyScore, evaluateArbitrageOpportunity, generateVehicleFingerprint } from '../src/engine/arbitrage';
import { matchesBuyBox } from '../src/alerts/dispatcher';
import { formatDealerWhatsAppAlert, formatSellerOfferTemplate } from '../src/alerts/whatsapp';
import { SA_MOCK_FB_LISTINGS } from '../src/ingestion/mock-payloads';
import { ArbitrageDatabase } from '../src/storage/db';
import { NormalizedVehicle, ValuationResult, DealerBuyBox } from '../src/types';
import path from 'path';
import fs from 'fs';

console.log('🧪 Starting TruArbitrage Test Suite...\n');

// ── 1. Fast Regex Normalizer Tests ──
console.log('1. Testing Fast Regex Normalizer...');

const poloRaw = SA_MOCK_FB_LISTINGS[0]; // 2017 VW Polo 1.2 TSI R125k
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

const damageRaw = SA_MOCK_FB_LISTINGS.find((l) => l.id === 'fb_item_golf_nonrunner')!;
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
  sources: [],
};

const fingerprint = generateVehicleFingerprint(testVehicle);
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
assert.strictEqual(deal.projectedNetMargin, 34500, 'Net margin should be 34,500 (43k - 8.5k recon)');
assert.ok(deal.projectedNetMargin >= 25000, 'Meets >= R25,000 margin threshold');
console.log(`   ✅ Arbitrage deal qualified: Gross R${deal.projectedGrossMargin.toLocaleString('en-ZA')} | Net Profit: R${deal.projectedNetMargin.toLocaleString('en-ZA')}`);

// Test overpriced car rejected by gate
const valuationFail: ValuationResult = {
  averageRetailPrice: 130000,
  listingsFound: 10,
  mileageAdjusted: false,
  sampleMedianKm: null,
  sources: [],
};
const noDeal = evaluateArbitrageOpportunity(testVehicle, valuationFail, trackedVehicle);
assert.strictEqual(noDeal, null, 'Overpriced vehicle should not qualify as arbitrage deal');
console.log('   ✅ Non-profitable listing correctly rejected by margin gate');

// ── 5. Buy-Box Matching & WhatsApp Formatting Tests ──
console.log('\n5. Testing Multi-Tenant Buy-Box & WhatsApp Formatting...');

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

const whatsappMsg = formatDealerWhatsAppAlert(deal, gautengVwBuyBox);
assert.ok(whatsappMsg.includes('TRUARBITRAGE'), 'WhatsApp message should contain header');
assert.ok(whatsappMsg.includes('R34,500'), 'WhatsApp message should show profit margin');


const offerMsg = formatSellerOfferTemplate(deal, gautengVwBuyBox.dealerName);
assert.ok(offerMsg.includes('Apex VW Specialists'), 'Offer message should mention dealer name');
console.log('   ✅ WhatsApp alert & 1-click cash offer messages formatted cleanly');

// ── 6. Storage Isolation Tests ──
console.log('\n6. Testing Isolated Storage Persistence...');

const testDbPath = path.join(__dirname, 'test-store.json');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

const testDb = new ArbitrageDatabase(testDbPath);
testDb.upsertTrackedVehicle(testVehicle);
testDb.saveDeal(deal);

const retrievedDeals = testDb.getDeals();
assert.strictEqual(retrievedDeals.length, 1, 'Should persist and retrieve saved deal');
assert.strictEqual(retrievedDeals[0].fingerprint, fingerprint, 'Fingerprint matches');

if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
console.log('   ✅ Isolated DB storage and query verified');

console.log('\n🎉 ALL TRUARBITRAGE TESTS PASSED SUCCESSFULLY! (6/6 Suites)');
