import axios from 'axios';
import * as cheerio from 'cheerio';

async function testPropertyScrape() {
  console.log('--- Testing Property24 & Private Property Scraper ---');

  // Test Property24
  try {
    const url = 'https://www.property24.com/for-sale/western-cape/9';
    console.log(`Fetching Property24: ${url}`);
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-ZA,en;q=0.9'
      },
      timeout: 10000
    });

    console.log(`Property24 Response: ${res.status}`);
    const $ = cheerio.load(res.data);
    const listings: any[] = [];

    $('[class*="p24_regularTile"], [class*="p24_content"], .p24_results .p24_tile').each((i, el) => {
      if (i > 5) return;
      const title = $(el).find('.p24_title, .p24_description, [class*="title"]').text().trim();
      const price = $(el).find('.p24_price, [class*="price"]').text().trim();
      const location = $(el).find('.p24_location, [class*="location"]').text().trim();
      const agency = $(el).find('.p24_branding, img[alt*="Agency"], [class*="agency"]').attr('alt') || $(el).find('.p24_branding').text().trim();
      const isPrivate = !agency || agency.toLowerCase().includes('private') || $(el).text().toLowerCase().includes('private property listing');

      if (title || price) {
        listings.push({
          title,
          price,
          location,
          agency: agency || 'None (Private / Unbranded)',
          isPrivate
        });
      }
    });

    console.log(`Found ${listings.length} Property24 sample listings:`);
    console.log(JSON.stringify(listings, null, 2));

  } catch (err: any) {
    console.log(`Property24 fetch status: ${err.response?.status || err.message}`);
  }

  // Test Private Property
  try {
    const url = 'https://www.privateproperty.co.za/for-sale/western-cape/cape-town/58';
    console.log(`\nFetching Private Property: ${url}`);
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-ZA,en;q=0.9'
      },
      timeout: 10000
    });

    console.log(`Private Property Response: ${res.status}`);
    const $ = cheerio.load(res.data);
    const listings: any[] = [];

    $('.listing-result, .results-container .result, [class*="listingCard"]').each((i, el) => {
      if (i > 5) return;
      const title = $(el).find('.title, [class*="title"]').text().trim();
      const price = $(el).find('.price, [class*="price"]').text().trim();
      const seller = $(el).find('[class*="seller"], [class*="agency"], [class*="brand"]').text().trim();
      const isPrivate = seller.toLowerCase().includes('private') || $(el).text().toLowerCase().includes('private seller');

      if (title || price) {
        listings.push({
          title,
          price,
          seller: seller || 'Unbranded / Private',
          isPrivate
        });
      }
    });

    console.log(`Found ${listings.length} Private Property sample listings:`);
    console.log(JSON.stringify(listings, null, 2));

  } catch (err: any) {
    console.log(`Private Property fetch status: ${err.response?.status || err.message}`);
  }
}

testPropertyScrape();
