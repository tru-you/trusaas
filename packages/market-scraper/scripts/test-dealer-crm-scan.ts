import axios from 'axios';
import { generateTruCrmCsv, mapDealerToTruCrmLead } from '../../../trudata/server/lib/dealer-crm/crm-sync';
import { DealerContactProfile } from '../../../trudata/server/lib/dealer-crm/types';

async function testDealerCrmScan() {
  console.log('=== Testing Used Car Dealer CRM Prospect Pipeline ===\n');

  const sampleProfile: DealerContactProfile = {
    dealerName: 'Bargain Auto Sales Johannesburg',
    websiteUrl: 'http://www.bargainautosales-jhb.co.za',
    city: 'Johannesburg',
    physicalAddress: '142 Main Reef Road, Boksburg / Johannesburg',
    primaryMobile: '+27 82 449 1190',
    secondaryMobile: '+27 83 221 0044',
    switchboardPhone: '+27 11 892 4000',
    whatsAppDirectLink: 'https://wa.me/27824491190',
    salesEmail: 'sales@bargainautosales-jhb.co.za',
    financeEmail: 'fandi@bargainautosales-jhb.co.za',
    adminEmail: 'dp@bargainautosales-jhb.co.za',
    estimatedStockCount: 42,
    hasOnlineFinanceForm: false,
    hasMobileVir: false,
    hasLiveChat: false,
    readinessScore: 32,
    digitalPainPoints: [
      'Missing mobile viewport tag (broken for mobile car shoppers)',
      'No digital VIR condition reports attached to listings',
      'Flat static photos without 360 photo studio or damage hotspots'
    ],
    recommendedTruSaasProducts: ['TruFlow DMS', 'TruLens Studio', 'TruInspect VIR'],
    outreachBlurbWhatsApp: 'Hi Bargain Auto Sales Team, saw your showroom in Johannesburg with ~42 vehicles. We help independent dealers boost mobile sales and automate 360 photos with TruSaaS. Would love to send a quick 2-min demo for your dealership.',
    outreachBlurbEmail: 'Subject: Upgrading Bargain Auto Sales online showroom & stock turnover\n\nHi Dealer Principal,\n\nWe noticed your dealership in Johannesburg has an active stock inventory of ~42 vehicles. We help dealerships streamline operations, shoot interactive 360 photos in 5 minutes with TruLens, and issue digital condition reports with TruInspect.\n\nCould we share a free demo tailored for your floor this week?'
  };

  console.log('[1] Mapped TruCRM Lead Record:');
  const crmLead = mapDealerToTruCrmLead(sampleProfile);
  console.log(JSON.stringify(crmLead, null, 2));

  console.log('\n[2] TruCRM / VMG Import CSV Output:');
  const csv = generateTruCrmCsv([sampleProfile]);
  console.log(csv);
}

testDealerCrmScan();
