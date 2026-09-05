const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '../trudealer/tddeploy');
const pages = [
  'index.html',
  'packages.html',
  'moto.html',
  'uk.html',
  'commercial.html',
  'marine.html',
  'caravans.html',
  'faq.html',
  'what-is-trudealer.html',
  'how-much-does-trudealer-cost.html',
  'start-car-dealership-sa.html',
  'lead-demo.html',
  'trudealer-vs-autoxloo.html',
  'trudealer-vs-vmg.html',
  'trudealer-vs-dms.html'
];

let totalErrors = 0;
let totalWarnings = 0;

console.log('═══════════════════════════════════════════════════════════════');
console.log('  VERIFYING ALL 15 MARKETING SITE PAGES (tddeploy)');
console.log('═══════════════════════════════════════════════════════════════\n');

pages.forEach(file => {
  const filePath = path.join(targetDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[FAIL] File missing: ${file}`);
    totalErrors++;
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  const warnings = [];

  // 1. :root custom properties check
  if (!content.includes('--ink') || (!content.includes('#0F172A') && !content.includes('#0f172a'))) {
    errors.push('Missing or invalid --ink: #0F172A in :root');
  }
  if (!content.includes('--surface') || (!content.includes('#F8F5EE') && !content.includes('#f8f5ee'))) {
    errors.push('Missing or invalid --surface: #F8F5EE in :root');
  }
  if (!content.includes('--white') || (!content.includes('#14141F') && !content.includes('#14141f'))) {
    errors.push('Missing or invalid --white: #14141F in :root');
  }
  if (!content.includes('--cyan') || (!content.includes('#0B7C72') && !content.includes('#0b7c72'))) {
    errors.push('Missing or invalid --cyan: #0B7C72 in :root');
  }
  if (!content.includes('--cyan-hover')) {
    errors.push('Missing --cyan-hover in :root');
  }

  // 2. Legacy --glass-* variables should not be declared in :root
  const legacyGlassVars = content.match(/--glass[a-zA-Z-]*\s*:[^;]+;/gi) || [];
  if (legacyGlassVars.length > 0) {
    errors.push(`Found legacy --glass-* variable declarations (${legacyGlassVars.length}): ${legacyGlassVars.slice(0, 3).join(', ')}`);
  }

  // 3. Check for card shine sweep ::before animations
  if (content.includes('Shine sweep on card hover') || content.includes('.card::before, .table-wrap::before')) {
    errors.push('Card ::before shine sweep effect is still present');
  }

  // 4. Check for rogue blue button theme
  if (content.includes('--blue-primary') || content.includes('BUTTON BLUE THEME')) {
    errors.push('Rogue blue button theme (#07879A) is still present');
  }

  // 5. Check for standard glassmorphism declaration
  if (!content.includes('blur(16px) saturate(180%)') || !content.includes('rgba(255,255,255,.72)')) {
    errors.push('Standard glass card rules (blur(16px) saturate(180%), rgba(255,255,255,.72)) missing');
  }

  // 6. Check for dark section card inversion
  if (!content.includes('[data-dark] .card') && !content.includes('.dark-section .card') && !content.includes('.surface-dark .card')) {
    warnings.push('Dark section card inversion rule not found');
  }

  // 7. Check for floating FAB hidden on mobile (<=768px)
  if (!content.includes('@media') || !content.includes('768px') || (!content.includes('.demo-fab') && !content.includes('.wa-fab'))) {
    errors.push('Missing @media(max-width: 768px) rule hiding floating action buttons (.demo-fab, .wa-fab)');
  }

  // 8. Check for dark desktop and mobile navigation
  if (!content.includes('.nav') || !content.includes('#0F172A')) {
    errors.push('Missing dark #0F172A nav bar styling');
  }

  // 9. Check for official UK WhatsApp number
  if (!content.includes('447476995694')) {
    warnings.push('Official UK WhatsApp number 447476995694 not found');
  }

  if (errors.length === 0) {
    console.log(`[PASS] ${file}${warnings.length ? ` (${warnings.length} warnings)` : ''}`);
    warnings.forEach(w => console.log(`       WARN: ${w}`));
  } else {
    console.log(`[FAIL] ${file} (${errors.length} errors, ${warnings.length} warnings)`);
    errors.forEach(e => console.log(`       ERR:  ${e}`));
    warnings.forEach(w => console.log(`       WARN: ${w}`));
    totalErrors += errors.length;
  }
});

console.log('\n═══════════════════════════════════════════════════════════════');
if (totalErrors === 0) {
  console.log(`  ALL 15 PAGES PASSED VERIFICATION! (0 errors, ${totalWarnings} warnings)`);
} else {
  console.log(`  VERIFICATION FAILED: ${totalErrors} errors found.`);
}
console.log('═══════════════════════════════════════════════════════════════\n');

process.exit(totalErrors > 0 ? 1 : 0);
