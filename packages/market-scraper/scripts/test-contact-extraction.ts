import axios from 'axios';
import * as cheerio from 'cheerio';

async function testContactExtraction() {
  console.log('--- Testing Contact Details Extraction from Detail Pages ---');

  // 1. Fetch Property24 list to get a real listing detail URL
  try {
    const listUrl = 'https://www.property24.com/for-sale/western-cape/9';
    const listRes = await axios.get(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-ZA,en;q=0.9'
      },
      timeout: 10000
    });

    const $list = cheerio.load(listRes.data);
    let detailLink = '';
    $list('a[href*="/for-sale/"]').each((i, el) => {
      const href = $list(el).attr('href') || '';
      if (/\/\d{6,10}$/.test(href) && !detailLink) {
        detailLink = href.startsWith('http') ? href : `https://www.property24.com${href}`;
      }
    });

    if (detailLink) {
      console.log(`\nTesting Property24 Detail Page: ${detailLink}`);
      const detailRes = await axios.get(detailLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(detailRes.data);

      // Extract JSON-LD or microdata
      let phoneFromJsonLd = '';
      let sellerNameFromJsonLd = '';
      $('script[type="application/ld+json"]').each((i, el) => {
        try {
          const json = JSON.parse($(el).html() || '{}');
          if (json.telephone) phoneFromJsonLd = json.telephone;
          if (json.name) sellerNameFromJsonLd = json.name;
        } catch (e) {}
      });

      // Extract HTML tel attributes
      const telLinks: string[] = [];
      $('a[href^="tel:"]').each((i, el) => {
        telLinks.push($(el).attr('href')?.replace('tel:', '') || '');
      });

      // Check for inline JS contact objects
      const rawHtml = detailRes.data;
      const phoneMatches = rawHtml.match(/(?:\+27|0)[6-8][0-9]{8}/g) || [];
      const agentNames = $('.p24_agentName, .p24_contactDetails, [class*="agentName"], [class*="contactName"]').map((i, el) => $(el).text().trim()).get();

      console.log('Property24 Extracted Contact Info:');
      console.log({
        detailLink,
        phoneFromJsonLd,
        telLinks: [...new Set(telLinks)],
        regexPhoneMatches: [...new Set(phoneMatches)].slice(0, 5),
        sellerNames: agentNames.slice(0, 3)
      });
    }
  } catch (err: any) {
    console.log(`Property24 Detail error: ${err.message}`);
  }

  // 2. Test Private Property list & detail page
  try {
    const ppListUrl = 'https://www.privateproperty.co.za/for-sale/western-cape/cape-town/58';
    const ppListRes = await axios.get(ppListUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ppList = cheerio.load(ppListRes.data);
    let ppDetailLink = '';
    $ppList('a[href*="/for-sale/"]').each((i, el) => {
      const href = $ppList(el).attr('href') || '';
      if (/\/T\d+/i.test(href) && !ppDetailLink) {
        ppDetailLink = href.startsWith('http') ? href : `https://www.privateproperty.co.za${href}`;
      }
    });

    if (ppDetailLink) {
      console.log(`\nTesting Private Property Detail Page: ${ppDetailLink}`);
      const ppDetailRes = await axios.get(ppDetailLink, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      const $pp = cheerio.load(ppDetailRes.data);
      const ppTelLinks: string[] = [];
      $pp('a[href^="tel:"]').each((i, el) => {
        ppTelLinks.push($pp(el).attr('href')?.replace('tel:', '') || '');
      });

      const ppRaw = ppDetailRes.data;
      const ppPhoneMatches = ppRaw.match(/(?:\+27|0)[6-8][0-9]{8}/g) || [];
      const ppSellers = $pp('.agent-name, .contact-name, [class*="agentName"], [class*="sellerName"]').map((i, el) => $pp(el).text().trim()).get();

      console.log('Private Property Extracted Contact Info:');
      console.log({
        ppDetailLink,
        telLinks: [...new Set(ppTelLinks)],
        regexPhoneMatches: [...new Set(ppPhoneMatches)].slice(0, 5),
        sellerNames: ppSellers.slice(0, 3)
      });
    }
  } catch (err: any) {
    console.log(`Private Property Detail error: ${err.message}`);
  }
}

testContactExtraction();
