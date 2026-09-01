import axios from 'axios';
import * as cheerio from 'cheerio';

async function inspectDetailHtml() {
  const url = 'https://www.privateproperty.co.za/for-sale/western-cape/cape-town/southern-suburbs/wynberg/wynberg-upper/49-petersklip/35-piers-road/T5604489';
  console.log(`Inspecting HTML of: ${url}`);
  
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  const $ = cheerio.load(res.data);
  
  // Find all script tags containing phone, agent, contact, or listing data
  $('script').each((i, el) => {
    const text = $(el).html() || '';
    if (text.includes('telephone') || text.includes('contact') || text.includes('agent') || text.includes('phone') || text.includes('seller')) {
      console.log(`\n--- Found script tag (${i}) [length: ${text.length}] ---`);
      // print snippet
      const lines = text.split('\n').filter(l => l.includes('phone') || l.includes('contact') || l.includes('agent') || l.includes('seller') || l.includes('tel') || l.includes('name'));
      console.log(lines.slice(0, 10).join('\n'));
    }
  });

  // Check buttons / data attributes
  $('[data-contact], [data-phone], [data-mobile], [data-agent], [class*="contact"], [class*="agent"]').each((i, el) => {
    if (i < 8) {
      console.log(`\nElement with contact classes: <${el.tagName} class="${$(el).attr('class')}">`);
      console.log($(el).text().trim().replace(/\s+/g, ' ').slice(0, 120));
    }
  });
}

inspectDetailHtml();
