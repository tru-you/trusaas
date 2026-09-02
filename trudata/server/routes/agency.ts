import { Router } from 'express';
import { crawlLegacySites } from '../lib/legacy-finder/crawler';

const router = Router();

/**
 * POST /api/agency/crawl
 * Crawl local businesses by city and industry, extracting defects and contact details
 */
router.post('/crawl', async (req, res) => {
  try {
    const { city = 'Pretoria', industry = 'Commercial Services', country = 'za', maxResults = 10 } = req.body;

    const result = await crawlLegacySites({
      city: String(city).trim(),
      industry: String(industry).trim(),
      country: country === 'uk' ? 'uk' : 'za',
      maxResults: Math.min(50, Math.max(1, Number(maxResults) || 10))
    });

    res.json(result);
  } catch (err: any) {
    console.error('[AgencyRoutes] Crawl failed:', err);
    res.status(500).json({ error: err.message || 'Error executing legacy site crawl' });
  }
});

/**
 * POST /api/agency/export-csv
 * Generate downloadable CSV string for agency cold outreach
 */
router.post('/export-csv', async (req, res) => {
  try {
    const { city = 'Pretoria', industry = 'Commercial Services', country = 'za' } = req.body;

    const result = await crawlLegacySites({
      city: String(city).trim(),
      industry: String(industry).trim(),
      country: country === 'uk' ? 'uk' : 'za',
      maxResults: 20
    });

    // Generate CSV lines
    const headers = [
      'Business Name',
      'Domain',
      'Readiness Score',
      'Critical Defects',
      'Primary Phone',
      'Secondary Phone',
      'WhatsApp Direct Link',
      'Contact Email',
      'Physical Address',
      'Estimated Pitch Value'
    ];

    // Sanitize CSV cells to prevent formula injection in Excel/Sheets
    const csvSafe = (val: string): string => {
      const s = val.replace(/"/g, '""');
      // Prefix formula-triggering characters with a tab
      if (/^[=+\-@]/.test(s)) return `"\t${s}"`;
      return `"${s}"`;
    };

    const rows = result.targets.map(t => [
      csvSafe(t.businessName),
      csvSafe(t.domain),
      `${t.readinessScore}/100`,
      csvSafe(t.defects.map(d => d.title).join('; ')),
      csvSafe(t.contacts.phones[0] || ''),
      csvSafe(t.contacts.phones[1] || ''),
      csvSafe(t.contacts.whatsAppLinks[0] || ''),
      csvSafe(t.contacts.emails[0] || ''),
      csvSafe(t.contacts.address || `${t.city}, South Africa`),
      csvSafe(t.estimatedPitchValue)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="legacy-sites-${city.toLowerCase().replace(/\s+/g, '-')}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error generating CSV export' });
  }
});

export default router;
