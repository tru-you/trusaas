import { crawlLegacySites } from '../../../trudata/server/lib/legacy-finder/crawler';

async function testLegacyCrawler() {
  console.log('=== Testing Legacy Site Finder Crawler ===');
  const t0 = Date.now();
  
  const result = await crawlLegacySites({
    city: 'Pretoria',
    industry: 'Commercial Services',
    country: 'za',
    maxResults: 2
  });

  console.log(`Scan completed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`Total Targets Found: ${result.totalFound}`);
  console.log(`Average Readiness Score: ${result.averageReadinessScore}/100`);
  console.log(`Critical Defects Count: ${result.criticalDefectsFound}`);

  console.log('\n--- Audited Targets with Contacts & Defects ---');
  result.targets.forEach((t, i) => {
    console.log(`\n[${i + 1}] ${t.businessName} (${t.domain})`);
    console.log(`    Readiness Score: ${t.readinessScore}/100`);
    console.log(`    Phones: ${t.contacts.phones.join(', ') || 'None found'}`);
    console.log(`    WhatsApp: ${t.contacts.whatsAppLinks.join(', ') || 'None'}`);
    console.log(`    Emails: ${t.contacts.emails.join(', ') || 'None found'}`);
    console.log(`    Address: ${t.contacts.address || 'Pretoria, South Africa'}`);
    console.log(`    Pitch Value: ${t.estimatedPitchValue}`);
    console.log(`    Defects (${t.defects.length}):`);
    t.defects.forEach(d => {
      console.log(`      • [${d.severity}] ${d.title}`);
    });
  });
}

testLegacyCrawler();
