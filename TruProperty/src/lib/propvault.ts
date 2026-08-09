import type { Property, PointResult, ComplianceCert } from '../types';
import type { TemplateSlot, ComplianceCertDef } from '../templates';
import { DEFAULT_TEMPLATE, COMPLIANCE_CERTS } from '../templates';
import { deriveReportId } from '../types/inspection';

async function toDataUri(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return url;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

function severityLabel(sev: number) {
  if (sev >= 5) return 'Critical';
  if (sev >= 4) return 'Major';
  if (sev >= 3) return 'Moderate';
  if (sev >= 2) return 'Minor';
  return 'Cosmetic';
}

function conditionScore(property: Property) {
  const all = Object.entries(property.damageFindings || {}).flatMap(([slotId, list]) =>
    (list || []).map(f => ({ ...f, slotId }))
  );
  const sevPenalties = [0, 0.1, 0.25, 0.55, 1.0, 1.7];
  const rawPenalties: number[] = all.map(f => sevPenalties[f.severity] ?? 0.3);

  const pts = property.inspectionPoints || {};
  const flaggedPoints = (DEFAULT_TEMPLATE.checklistPoints || [])
    .map(p => ({ point: p, res: pts[p.id] }))
    .filter(({ res }) => res && (res.rating === 'note' || res.rating === 'damage' || res.works === 'no'));
  for (const { res } of flaggedPoints) {
    if (res?.works === 'no') rawPenalties.push(0.4);
    else if (res?.rating === 'damage') rawPenalties.push(0.5);
    else if (res?.rating === 'note') rawPenalties.push(0.15);
  }

  const slotAssess = property.slotAssessment || {};
  const slotsWithTags = new Set(all.map(f => f.slotId));
  for (const [slotId, res] of Object.entries(slotAssess)) {
    if (slotsWithTags.has(slotId)) continue;
    if (res?.rating === 'damage') rawPenalties.push(0.5);
    else if (res?.rating === 'note') rawPenalties.push(0.15);
  }

  rawPenalties.sort((a, b) => b - a);
  const penalty = rawPenalties.reduce((s, p, i) => s + p / (i + 1), 0);
  const stars = Math.max(1, Math.round((5 - Math.min(4, penalty)) * 10) / 10);
  const hasInput = all.length > 0 || flaggedPoints.length > 0 || Object.keys(pts).length > 0 || Object.keys(slotAssess).length > 0;
  return { stars, hasInput, findingCount: all.length, findings: all, flaggedPoints };
}

function gradeLabel(r?: PointResult) {
  if (r?.rating === 'ok') return 'Good';
  if (r?.rating === 'note') return 'Fair';
  if (r?.rating === 'damage') return 'Poor';
  return '—';
}

function gradeColor(r?: PointResult) {
  if (r?.rating === 'ok') return '#1A7A3A';
  if (r?.rating === 'note') return '#B07A26';
  if (r?.rating === 'damage') return '#B03226';
  return '#6E6656';
}

function esc(s: string | undefined | null): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function generateVaultReport(
  property: Property,
  slots: TemplateSlot[],
  agencyName: string,
  agencyBranch: string,
  agencyWa: string,
): Promise<string> {
  const photos = property.photos || {};
  const photoEntries = Object.entries(photos).filter(([, v]) => !!v);

  const inlined = new Map<string, string>();
  await Promise.all(
    photoEntries.map(async ([slotId, url]) => {
      inlined.set(slotId, await toDataUri(url));
    })
  );

  const closeups = property.closeups || {};
  for (const [slotId, urls] of Object.entries(closeups)) {
    for (let i = 0; i < urls.length; i++) {
      const key = `closeup_${slotId}_${i}`;
      inlined.set(key, await toDataUri(urls[i]));
    }
  }

  const reportId = deriveReportId(property, 'PI');
  const generatedAt = new Date().toLocaleString('en-ZA', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const cond = conditionScore(property);
  const bandLabel = !cond.hasInput ? 'Not yet inspected'
    : cond.stars >= 4.5 ? 'Excellent'
    : cond.stars >= 3.5 ? 'Good'
    : cond.stars >= 2.5 ? 'Fair' : 'Poor';

  const requiredSlots = slots.filter(s => s.required);
  const requiredTaken = requiredSlots.filter(s => !!photos[s.id]).length;

  const sa = property.slotAssessment || {};
  const assessedSlots = slots
    .map(s => ({ s, r: sa[s.id] }))
    .filter(({ r }) => r && (r.rating || r.comment));

  const pts = property.inspectionPoints || {};
  const inspectionRows = (DEFAULT_TEMPLATE.checklistPoints || [])
    .map(p => ({ p, r: pts[p.id] }))
    .filter(({ r }) => r && (r.rating || r.works || r.comment));

  const disclosureRows = (DEFAULT_TEMPLATE.disclosureQuestions || []).flatMap(section =>
    section.items.map(item => {
      const a = property.inspectionChecklist?.[item.id];
      return { section: section.section, item, answer: a?.answer, note: a?.note, flagged: a?.answer === item.flagWhen };
    })
  );
  const flags = disclosureRows.filter(r => r.flagged);

  const showCompliance = property.inspectionPurpose === 'sale' || property.inspectionPurpose === 'new_build';
  const certs = property.complianceCerts || {};

  const heroSlot = requiredSlots.find(s => inlined.has(s.id)) || slots.find(s => inlined.has(s.id));
  const gallerySlots = slots.filter(s => inlined.has(s.id)).slice(0, 18);

  let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>PropVault Report · ${esc(property.propertyType)} · ${esc(property.suburb)} · ${esc(reportId)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;font-size:10px;line-height:1.55;color:#121A26;background:#F1F5F9;padding:12px}
.page{max-width:210mm;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;padding:10mm 12mm 8mm}
.mono{font-family:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace}
.display{font-family:Georgia,"Times New Roman",serif}
.muted{color:#6E6656}.ink2{color:#3A4553}.cyan{color:#07889B}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding-bottom:10px;margin-bottom:16px;border-bottom:2.5px solid #121A26}
.hdr-brand{font-size:18px;font-weight:700;color:#07889B}
.hdr-right{text-align:right}
.doc-type{font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:#07889B;font-weight:700}
.doc-id{font-size:8.5px;color:#6E6656;margin-top:3px}
.verdict{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:10px;margin-bottom:18px}
.verdict-pass{background:rgba(26,122,58,.08);border:1px solid rgba(26,122,58,.3)}
.verdict-caution{background:rgba(176,122,38,.08);border:1px solid rgba(176,122,38,.3)}
.verdict-fail{background:rgba(176,50,38,.08);border:1px solid rgba(176,50,38,.3)}
.verdict-unknown{background:rgba(18,26,38,.06);border:1px solid rgba(18,26,38,.12)}
.verdict .score{margin-left:auto;text-align:center;padding-left:12px;border-left:1px solid rgba(18,26,38,.12)}
.verdict .score .num{font-size:24px;font-weight:600;line-height:1}
.verdict .score .lbl{font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:#6E6656;margin-top:3px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px;margin-bottom:18px}
.info-row{display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(18,26,38,.06)}
.info-row .k{font-size:7.8px;letter-spacing:.1em;text-transform:uppercase;color:#6E6656}
.info-row .v{font-size:10.5px;font-weight:700;text-align:right}
.section-title{display:flex;align-items:center;gap:8px;margin:20px 0 12px}
.section-title .n{font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:#07889B;font-weight:700}
.section-title .ln{flex:1;height:1px;background:rgba(18,26,38,.12)}
.photo-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
.photo-tile{border:1px solid rgba(18,26,38,.12);border-radius:6px;overflow:hidden;break-inside:avoid}
.photo-tile img{width:100%;height:auto;max-height:140px;object-fit:cover;display:block}
.photo-tile .cap{padding:6px 8px;font-size:9px;color:#3A4553}
.panel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:18px}
.panel{padding:9px 10px;border:1px solid rgba(18,26,38,.12);border-radius:6px}
.panel .name{font-size:7.2px;letter-spacing:.08em;text-transform:uppercase;color:#6E6656;margin-bottom:4px}
.panel .grade{font-size:10.5px;font-weight:700}
.panel .note{font-size:9px;color:#3A4553;margin-top:3px}
.finding{border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px;border-left:4px solid #6E6656}
.finding .h{font-size:7.8px;letter-spacing:.1em;text-transform:uppercase}
.finding .l{font-size:10.5px;color:#3A4553;margin-top:4px;font-weight:500}
.no-issues{background:rgba(26,122,58,.08);border-left:4px solid #1A7A3A;border-radius:0 8px 8px 0;padding:10px 14px;color:#1A7A3A;font-weight:700;font-size:11px}
.checks{display:grid;grid-template-columns:repeat(2,1fr);gap:2px 12px;margin-bottom:18px}
.check{display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-bottom:1px solid rgba(18,26,38,.06)}
.check .dot{width:7px;height:7px;border-radius:50%;flex:none;margin-top:3px}
.check .lbl{font-size:9.5px;color:#3A4553}
.check .grp{font-size:6.8px;letter-spacing:.08em;color:#6E6656;display:block}
.card{border:1px solid rgba(18,26,38,.12);border-radius:8px;padding:12px 14px;margin-bottom:10px}
.card .k{font-size:7.8px;letter-spacing:.1em;text-transform:uppercase;color:#6E6656;margin-bottom:6px}
.prose{font-size:10px;color:#3A4553;margin-bottom:8px;line-height:1.6}
.prose b{color:#121A26}
table.checklist{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:14px}
table.checklist th,table.checklist td{border-bottom:1px solid rgba(18,26,38,.06);padding:6px;text-align:left}
table.checklist th{font-size:7.5px;letter-spacing:.1em;text-transform:uppercase;color:#6E6656}
.sig-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px;padding-top:14px;border-top:1px solid rgba(18,26,38,.12)}
.sig .line{border-top:1px solid #121A26;padding-top:5px;min-height:22px}
.sig .name{font-size:10.5px;font-weight:600}
.sig .lbl{font-size:7.2px;letter-spacing:.12em;text-transform:uppercase;color:#6E6656;margin-top:4px}
.foot{border-top:1px solid rgba(18,26,38,.12);margin-top:16px;padding-top:10px;display:flex;justify-content:space-between;font-size:7.8px;letter-spacing:.08em;text-transform:uppercase;color:#6E6656;flex-wrap:wrap;gap:8px}
.accent{height:3px;background:#07889B;margin:0 0 2px}
.cert-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(18,26,38,.06)}
.cert-row .status{font-weight:700;font-size:10px}
.meter-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(18,26,38,.06)}
@media print{body{background:#fff;padding:0}.page{max-width:100%;border-radius:0;padding:8mm 10mm}}
@media(max-width:720px){.photo-grid{grid-template-columns:repeat(2,1fr)}.panel-grid{grid-template-columns:repeat(2,1fr)}.checks{grid-template-columns:1fr}.info-grid{grid-template-columns:1fr}}
</style></head><body><div class="page">`;

  // Header
  html += `<div class="hdr"><div><span class="display hdr-brand">PropInspect</span>`;
  if (agencyName || agencyBranch) {
    html += `<div style="font-size:9.5px;color:#3A4553;margin-left:8px;display:inline">${agencyName ? `<b>${esc(agencyName)}</b>` : ''}${agencyBranch ? ` · ${esc(agencyBranch)}` : ''}</div>`;
  }
  html += `</div><div class="hdr-right"><div class="doc-type mono">Property Inspection Report</div><div class="doc-id mono">${esc(reportId)} · ${esc(generatedAt)}</div></div></div>`;

  // Verdict
  const verdictClass = !cond.hasInput ? 'verdict-unknown' : cond.stars >= 3.5 ? 'verdict-pass' : cond.stars >= 2.5 ? 'verdict-caution' : 'verdict-fail';
  const verdictColor = !cond.hasInput ? '#6E6656' : cond.stars >= 3.5 ? '#1A7A3A' : cond.stars >= 2.5 ? '#B07A26' : '#B03226';
  html += `<div class="verdict ${verdictClass}"><div style="flex:1"><h3 class="display" style="font-size:17px;font-weight:600;color:${verdictColor}">Condition — ${esc(bandLabel)}</h3><p class="ink2" style="font-size:10.5px">${cond.findingCount} damage tag${cond.findingCount === 1 ? '' : 's'} · ${requiredTaken}/${requiredSlots.length} required photos captured.</p></div><div class="score"><div class="num display" style="color:${verdictColor}">${cond.hasInput ? cond.stars.toFixed(1) : '—'}</div><div class="lbl mono">/ 5 condition</div></div></div>`;

  // Property info
  html += `<div class="info-grid">`;
  const rows: [string, string][] = [
    ['Property Type', property.propertyType || '—'],
    ['Suburb', property.suburb || '—'],
    ['Erf Number', property.erfNumber || '—'],
    ['Listing Ref', property.listingRef || '—'],
    ['Year Built', String(property.yearBuilt || '—')],
    ['Address', property.address || '—'],
    ['Bedrooms / Bathrooms', `${property.bedrooms ?? '—'} / ${property.bathrooms ?? '—'}`],
    ['List Price', `R ${Number(property.listPrice || 0).toLocaleString('en-ZA')}`],
    ['Purpose', property.inspectionPurpose || '—'],
    ['Photos', `${requiredTaken}/${requiredSlots.length} required`],
  ];
  for (const [k, v] of rows) {
    html += `<div class="info-row"><span class="k mono">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
  }
  html += `</div>`;

  // Photo gallery
  if (gallerySlots.length > 0) {
    html += `<div class="section-title"><span class="n mono">Gallery</span><span class="ln"></span></div><div class="photo-grid">`;
    for (const slot of gallerySlots) {
      const src = inlined.get(slot.id) || '';
      html += `<div class="photo-tile"><img src="${esc(src)}" alt="${esc(slot.name)}"><div class="cap mono">${esc(slot.name)}</div></div>`;
    }
    html += `</div>`;
  }

  // Condition summary — panel grades
  if (assessedSlots.length > 0) {
    html += `<div class="section-title"><span class="n mono">Condition summary</span><span class="ln"></span></div><div class="panel-grid">`;
    for (const { s, r } of assessedSlots) {
      html += `<div class="panel"><div class="name mono">${esc(s.name)}</div><div class="grade" style="color:${gradeColor(r)}">${gradeLabel(r)}</div>${r?.comment ? `<div class="note">${esc(r.comment)}</div>` : ''}</div>`;
    }
    html += `</div>`;
  }

  // Damage findings
  html += `<div class="section-title"><span class="n mono">Damage findings</span><span class="ln"></span></div>`;
  if (cond.findings.length === 0) {
    html += `<div class="no-issues">No damage was tagged on the inspection photos.</div>`;
  } else {
    for (const f of cond.findings) {
      const sevColors: Record<string, string> = { Critical: '#DC2626', Major: '#EA580C', Moderate: '#CA8A04', Minor: '#64748B', Cosmetic: '#475569' };
      const label = severityLabel(f.severity);
      const c = sevColors[label] || '#6E6656';
      const slot = slots.find(s => s.id === f.slotId);
      html += `<div class="finding" style="border-left-color:${c}"><div class="h" style="color:${c}">${esc(label)} · ${esc(f.damageType)} · ${esc(f.panel)}</div><div class="l">${esc(f.note || 'Tagged by inspector')} — <span class="muted">${esc(slot?.name || f.slotId)}</span></div></div>`;
    }
  }

  // Inspection sheet
  if (inspectionRows.length > 0) {
    html += `<div class="section-title"><span class="n mono">Inspection sheet</span><span class="ln"></span></div>`;
    if (cond.flaggedPoints.length > 0) {
      for (const { point, res } of cond.flaggedPoints) {
        const st = res?.works === 'no' ? 'Faulty' : res?.rating === 'damage' ? 'Damage' : res?.rating === 'note' ? 'Note' : '—';
        html += `<div class="finding" style="background:rgba(176,122,38,.08);border-left-color:#B07A26"><div class="h" style="color:#B07A26">Disclosure · ${esc(point.name)}</div><div class="l">${esc(st)}${res?.comment ? ` — ${esc(res.comment)}` : ''}</div></div>`;
      }
    }
    html += `<div class="checks">`;
    for (const { p, r } of inspectionRows) {
      const st = r?.works === 'yes' ? { t: 'Works', c: '#1A7A3A' }
        : r?.works === 'no' ? { t: 'Faulty', c: '#B03226' }
        : r?.works === 'na' ? { t: 'N/A', c: '#6E6656' }
        : r?.rating === 'ok' ? { t: 'OK', c: '#1A7A3A' }
        : r?.rating === 'note' ? { t: 'Note', c: '#B07A26' }
        : r?.rating === 'damage' ? { t: 'Damage', c: '#B03226' }
        : { t: '—', c: '#6E6656' };
      html += `<div class="check"><span class="dot" style="background:${st.c}"></span><span class="lbl"><span class="grp mono">${esc(p.group)}</span>${esc(p.name)} — ${st.t}${r?.comment ? ` · ${esc(r.comment)}` : ''}</span></div>`;
    }
    html += `</div>`;
  }

  // Compliance certificates
  if (showCompliance) {
    html += `<div class="section-title"><span class="n mono">Compliance certificates</span><span class="ln"></span></div><div class="card">`;
    for (const def of COMPLIANCE_CERTS) {
      const c = certs[def.id];
      const received = c?.received ?? false;
      const color = received ? '#1A7A3A' : '#B03226';
      html += `<div class="cert-row"><span class="status" style="color:${color}">${received ? 'Yes' : 'No'}</span><span style="flex:1;font-size:10px">${esc(def.name)}${c?.issuer ? ` — ${esc(c.issuer)}` : ''}${c?.date ? ` (${esc(c.date)})` : ''}</span></div>`;
    }
    html += `</div>`;
  }

  // Meter readings
  if (property.meterReadings) {
    const mr = property.meterReadings;
    if (mr.electricity || mr.water || mr.gas) {
      html += `<div class="section-title"><span class="n mono">Meter readings</span><span class="ln"></span></div><div class="card">`;
      if (mr.electricity) html += `<div class="meter-row"><span class="k mono">Electricity</span><span style="font-weight:700">${esc(mr.electricity)}</span></div>`;
      if (mr.water) html += `<div class="meter-row"><span class="k mono">Water</span><span style="font-weight:700">${esc(mr.water)}</span></div>`;
      if (mr.gas) html += `<div class="meter-row"><span class="k mono">Gas</span><span style="font-weight:700">${esc(mr.gas)}</span></div>`;
      html += `</div>`;
    }
  }

  // Keys
  if (property.keysHanded) {
    html += `<div class="card"><div class="k mono">Keys handed over</div><div style="font-size:10.5px">${property.keysHanded.count} set${property.keysHanded.count !== 1 ? 's' : ''}${property.keysHanded.description ? ` — ${esc(property.keysHanded.description)}` : ''}</div></div>`;
  }

  // Disclosure flags
  if (flags.length > 0) {
    html += `<div class="section-title"><span class="n mono">Disclosure flags</span><span class="ln"></span></div>`;
    for (const f of flags) {
      html += `<div class="finding" style="background:rgba(176,122,38,.08);border-left-color:#B07A26"><div class="h" style="color:#B07A26">${esc(f.section)} · ${esc(f.item.q)}</div>${f.note ? `<div class="l">${esc(f.note)}</div>` : ''}</div>`;
    }
  }

  // Scope disclaimers
  html += `<div class="section-title"><span class="n mono">Scope &amp; disclaimers</span><span class="ln"></span></div>`;
  html += `<div class="card"><div class="k mono">Covered</div><div class="prose" style="margin-bottom:0">A visual inspection of the property's exterior, interior rooms, structural elements, systems and accessible documents. Inspection conducted with the property unoccupied or with limited access. Visible systems checked for condition and functionality where safely accessible.</div></div>`;
  html += `<div class="card"><div class="k mono">Not covered</div><div class="prose" style="margin-bottom:0">No invasive testing, no removal of coverings or fixtures, no laboratory analysis, no structural depth measurement, no assessment of systems in areas not safely or readily accessible, and no evaluation of compliance status with local building codes beyond visual observation.</div></div>`;

  // Signature
  html += `<div class="sig-row"><div class="sig"><div class="line"><span class="name">${esc(property.inspectorName || '')}</span></div><div class="lbl mono">Inspector — ${esc(property.inspectorRole || 'signature')}</div></div><div class="sig"><div class="line"><span class="name">&nbsp;</span></div><div class="lbl mono">Customer acknowledgement</div></div></div>`;

  // Footer
  html += `<div class="accent"></div><div class="foot"><div>Prepared by <b class="cyan">${esc(agencyName)}</b> · powered by <b>TruProperty</b></div><div class="mono">${esc(reportId)}</div><div>Visual inspection at a moment in time — not a structural warranty.</div></div>`;

  html += `</div></body></html>`;

  return html;
}
