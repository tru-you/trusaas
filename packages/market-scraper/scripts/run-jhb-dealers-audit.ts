import { crawlLegacySites } from '../../../trudata/server/lib/legacy-finder/crawler';

async function runJoburgDealersAudit() {
  console.log('===============================================================');
  console.log('  LEGACY SITE FINDER CRAWL: USED AUTOMOTIVE DEALERS IN JOHANNESBURG');
  console.log('===============================================================\n');

  const t0 = Date.now();

  const result = await crawlLegacySites({
    city: 'Johannesburg',
    industry: 'Used Automotive Dealers',
    country: 'za',
    maxResults: 4
  });

  const durationSec = ((Date.now() - t0) / 1000).toFixed(2);

  console.log(`Crawl completed in: ${durationSec}s`);
  console.log(`Total Targets Discovered: ${result.totalFound}`);
  console.log(`Average Digital Readiness Score: ${result.averageReadinessScore} / 100`);
  console.log(`Total Critical Technical Defects: ${result.criticalDefectsFound}\n`);

  result.targets.forEach((target, index) => {
    console.log(`---------------------------------------------------------------`);
    console.log(`[TARGET #${index + 1}] ${target.businessName.toUpperCase()}`);
    console.log(`  Domain:           ${target.domain} (${target.url})`);
    console.log(`  Readiness Score:  ${target.readinessScore}/100 (${target.readinessScore < 40 ? 'CRITICAL FLAWS' : 'HIGH DEFECTS'})`);
    console.log(`  Pitch Proposal:   ${target.estimatedPitchValue}`);
    console.log(`  Tech Stack:       ${target.techStack.cms} · ${target.techStack.server} · ${target.techStack.estimatedLoadSeconds}s LCP`);
    console.log(`\n  CONTACT INTELLIGENCE:`);
    console.log(`    • Direct Phones: ${target.contacts.phones.join(' | ') || 'None found'}`);
    console.log(`    • WhatsApp:      ${target.contacts.whatsAppLinks.join(' | ') || 'None'}`);
    console.log(`    • Emails:        ${target.contacts.emails.join(' | ') || 'None found'}`);
    console.log(`    • Address:       ${target.contacts.address || 'Johannesburg, Gauteng, South Africa'}`);
    if (target.contacts.socialLinks.facebook || target.contacts.socialLinks.googleMaps) {
      console.log(`    • Social/Maps:   ${target.contacts.socialLinks.facebook || ''} ${target.contacts.socialLinks.googleMaps || ''}`);
    }
    console.log(`\n  DETECTED TECHNICAL DEFECTS (${target.defects.length}):`);
    target.defects.forEach(d => {
      console.log(`    • [${d.severity}] ${d.title}`);
      console.log(`      Pitch Angle: ${d.agencyPitchAngle}`);
    });
    console.log('');
  });
}

runJoburgDealersAudit();
