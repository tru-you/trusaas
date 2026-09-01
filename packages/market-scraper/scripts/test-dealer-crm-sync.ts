import { mapDealerToTruCrmLead, generateTruCrmCsv } from '../../../trudata/server/lib/dealer-crm/crm-sync';
import { extractDealerProfile } from '../../../trudata/server/lib/dealer-crm/dealer-extractor';

async function testDealerCrmPipeline() {
  console.log('=== Testing Dealer CRM Ingestion Pipeline ===\n');

  const profile = await extractDealerProfile('www.bargainautosales-jhb.co.za', 'Bargain Auto Sales JHB', 'Johannesburg', 'za');
  
  if (profile) {
    console.log('[1] Extracted Dealer Profile:');
    console.log(`    Dealership:      ${profile.dealerName}`);
    console.log(`    Primary Mobile:  ${profile.primaryMobile}`);
    console.log(`    WhatsApp Link:   ${profile.whatsAppDirectLink}`);
    console.log(`    Sales Email:     ${profile.salesEmail}`);
    console.log(`    Finance Email:   ${profile.financeEmail || 'N/A'}`);
    console.log(`    Address:         ${profile.physicalAddress}`);
    console.log(`    Est Floor Stock: ${profile.estimatedStockCount} vehicles`);
    console.log(`    Pitch Products:  ${profile.recommendedTruSaasProducts.join(', ')}`);

    console.log('\n[2] TruCRM Mapped Lead:');
    const crmLead = mapDealerToTruCrmLead(profile);
    console.log(JSON.stringify(crmLead, null, 2));

    console.log('\n[3] Generated TruCRM CSV Row:');
    const csv = generateTruCrmCsv([profile]);
    console.log(csv);
  }
}

testDealerCrmPipeline();
