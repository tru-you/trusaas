/**
 * Ops check for the dealer stock layer.
 *
 *   npm run check:dealers                 — fetch every enabled dealer, report
 *                                            card counts + first few titles
 *   npm run check:dealers -- VW Golf 2018 — also report how many cards match
 *                                            that vehicle (make + model)
 *
 * Exits non-zero when any enabled dealer fails to load or yields no cards, so
 * it can gate deploys. Uses the same fetch path as the valuation pipeline
 * (worker first, plain HTTP otherwise), so what you see here is what the
 * scraper will actually parse.
 */
import * as cheerio from 'cheerio';
import { expandDealerUrl, fetchPageForParsing, loadDealerSources } from '../src/lib/scraper';

const DEFAULT_CARD_SELECTOR =
  'article, .vehicle, .stock-item, .listing, [class*="card"], [class*="vehicle"]';

function titleOf($: cheerio.CheerioAPI, el: any): string {
  const $el = $(el);
  return (
    $el.find('h2, h3, h4, .title, [class*="title"], [class*="name"]').first().text() ||
    $el.text()
  ).trim();
}

async function main(): Promise<void> {
  const [make, model, year] = process.argv.slice(2).filter((a) => a !== '--');
  const dealers = loadDealerSources();

  if (dealers.length === 0) {
    console.log('No enabled dealers in data/price-sources.json');
    process.exit(1);
  }

  let failures = 0;
  console.log(`Checking ${dealers.length} dealer(s)${make ? ` for "${make} ${model} ${year}"` : ''}:\n`);

  for (const d of dealers) {
    const url = expandDealerUrl(d, make || '', model || '', year || '');
    const started = Date.now();
    try {
      const html = await fetchPageForParsing(url);
      if (!html) {
        console.log(`✗ ${d.name}: no content at ${url}`);
        failures++;
        continue;
      }
      const $ = cheerio.load(html);
      const cards = $(d.cardSelector || DEFAULT_CARD_SELECTOR);
      const titles = cards
        .slice(0, 3)
        .map((_, el) => titleOf($, el))
        .get()
        .filter((t) => t.length > 0);

      let matched = '';
      if (make && model) {
        const wanted = [make.toLowerCase(), model.toLowerCase()];
        let count = 0;
        cards.each((_, el) => {
          const t = titleOf($, el).toLowerCase();
          if (wanted.every((kw) => t.includes(kw))) count++;
        });
        matched = ` · ${count} matching ${make} ${model}`;
      }

      console.log(`✓ ${d.name}: ${cards.length} card(s) in ${Date.now() - started}ms${matched}`);
      for (const t of titles) console.log(`    - ${t.slice(0, 90)}`);
      if (cards.length === 0) {
        console.log(`    ⚠ no cards found — check the cardSelector for this site`);
        failures++;
      }
      console.log('');
    } catch (err: any) {
      console.log(`✗ ${d.name}: ${err?.message || err} (${url})`);
      failures++;
    }
  }

  console.log(failures === 0 ? 'All dealers OK' : `${failures} dealer(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
