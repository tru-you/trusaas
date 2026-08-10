import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DocSettings } from "./src/types";

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 45.35; // 16mm
const CONTENT_W = PAGE.w - MARGIN * 2;
const INK = rgb(0.078, 0.09, 0.11);
const MUTED = rgb(0.463, 0.494, 0.537);
const FAINT = rgb(0.541, 0.627, 0.6);
const ACCENT = rgb(0.055, 0.31, 0.298);
const RULE = rgb(0.898, 0.902, 0.886);
const HAIR = rgb(0.929, 0.933, 0.918);
const TINT = rgb(0.973, 0.973, 0.965);
const BODY_TEXT = rgb(0.29, 0.314, 0.345);
const WHITE = rgb(1, 1, 1);

export const VAT_RATE = 0.15;

const DEFAULT_OWNERSHIP =
  "Ownership of the property specified herein remains vested in the Seller (or the " +
  "underwriting Financial Institution) and shall not pass to the Buyer until the full " +
  "purchase price has been received in cleared funds in the Seller's bank account.";

/* ── shared interfaces ───────────────────────────────────────────────────── */

export interface DealerLetterhead {
  name?: string;
  tradingAs?: string;
  address?: string;
  registrationNumber?: string;
  vatNumber?: string;
  contactEmail?: string;
  websiteUrl?: string;
}

export interface BuyerBlock {
  name?: string;
  address?: string;
  idOrBrn?: string;
  vatNumber?: string;
  phone?: string;
}

export interface PropertyBlock {
  address?: string;
  suburb?: string;
  city?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  erfSize?: number;
  floorSize?: number;
  erfRef?: string;
  listingRef?: string;
  price?: number;
}

/* ── drawing helpers ─────────────────────────────────────────────────────── */

function money(n: number): string {
  return "R " + (Math.round(n * 100) / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

interface Ctx {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  y: number;
}

function text(ctx: Ctx, s: string, opts: { x?: number; size?: number; bold?: boolean; color?: any; maxW?: number } = {}) {
  let str = s;
  const size = opts.size ?? 9.5;
  const font = opts.bold ? ctx.bold : ctx.regular;
  if (opts.maxW) {
    while (font.widthOfTextAtSize(str, size) > opts.maxW && str.length > 3) {
      str = str.slice(0, -4) + "...";
    }
  }
  ctx.page.drawText(str, {
    x: opts.x ?? MARGIN,
    y: ctx.y,
    size,
    font,
    color: opts.color ?? INK,
  });
}

function textRight(ctx: Ctx, s: string, right: number, opts: { size?: number; bold?: boolean; color?: any } = {}) {
  const size = opts.size ?? 9.5;
  const font = opts.bold ? ctx.bold : ctx.regular;
  ctx.page.drawText(s, { x: right - font.widthOfTextAtSize(s, size), y: ctx.y, size, font, color: opts.color ?? INK });
}

function hRule(ctx: Ctx, colour = RULE, x1 = MARGIN, x2 = PAGE.w - MARGIN) {
  ctx.page.drawLine({ start: { x: x1, y: ctx.y }, end: { x: x2, y: ctx.y }, thickness: 0.75, color: colour });
}

function darkRule(ctx: Ctx) {
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE.w - MARGIN, y: ctx.y }, thickness: 0.75, color: INK });
}

function paragraphWrap(ctx: Ctx, s: string, opts: { size?: number; lead?: number; color?: any; maxW?: number; x?: number } = {}) {
  const size = opts.size ?? 8.5;
  const lead = opts.lead ?? 12;
  const color = opts.color ?? BODY_TEXT;
  const maxW = opts.maxW ?? CONTENT_W;
  const x = opts.x ?? MARGIN;
  const words = s.split(/\s+/);
  let line = "";
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.regular.widthOfTextAtSize(probe, size) > maxW) {
      text(ctx, line, { x, size, color });
      ctx.y -= lead;
      line = w;
    } else {
      line = probe;
    }
  }
  if (line) {
    text(ctx, line, { x, size, color });
    ctx.y -= lead;
  }
}

function dateStr(d: Date): string {
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
}

async function createDoc() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE.w, PAGE.h]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { page, regular, bold, y: PAGE.h - MARGIN };
  return { doc, ctx };
}

/* ── header / title / meta ──────────────────────────────────────────────── */

function dealerHeader(ctx: Ctx, d: DealerLetterhead) {
  const right = PAGE.w - MARGIN;
  const top = ctx.y;

  text(ctx, d.name || "", { size: 11, bold: true });
  ctx.y -= 13;
  if (d.tradingAs && d.tradingAs !== d.name) {
    text(ctx, `t/a ${d.tradingAs}`, { size: 8.5, color: MUTED });
    ctx.y -= 11;
  }

  const rightLines: string[] = [];
  const addrLines = (d.address || "").split(/\s*,\s*/).filter(Boolean);
  if (addrLines.length) rightLines.push(addrLines.join(", "));
  const regLine = [
    d.registrationNumber ? `Reg ${d.registrationNumber}` : "",
    d.vatNumber ? `VAT ${d.vatNumber}` : "",
  ].filter(Boolean).join("  ·  ");
  if (regLine) rightLines.push(regLine);
  const contactLine = [d.contactEmail, (d.websiteUrl || "").replace(/^https?:\/\//, "")].filter(Boolean).join("  ·  ");
  if (contactLine) rightLines.push(contactLine);

  let ry = top;
  for (const rl of rightLines) {
    const w = ctx.regular.widthOfTextAtSize(rl, 8);
    ctx.page.drawText(rl, { x: right - w, y: ry, size: 8, font: ctx.regular, color: MUTED });
    ry -= 12;
  }

  ctx.y = Math.min(ctx.y, ry) - 8;
  hRule(ctx);
  ctx.y -= 20;
}

function docTitle(ctx: Ctx, title: string) {
  text(ctx, title, { size: 22, bold: true });
  ctx.y -= 10;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y, width: 30, height: 1.5, color: ACCENT });
  ctx.y -= 14;
}

interface MetaRow { label: string; value: string; accent?: boolean }

function metaGrid(ctx: Ctx, rows: MetaRow[], startY: number) {
  const right = PAGE.w - MARGIN;
  let y = startY;
  for (const row of rows) {
    const color = row.accent ? ACCENT : FAINT;
    const valColor = row.accent ? ACCENT : INK;
    const labelW = ctx.bold.widthOfTextAtSize(row.label, 7);
    const valueW = ctx.bold.widthOfTextAtSize(row.value, 9);
    const gap = 14;
    const labelX = right - valueW - gap - labelW;
    ctx.page.drawText(row.label, { x: labelX, y, size: 7, font: ctx.bold, color });
    ctx.page.drawText(row.value, { x: right - valueW, y, size: 9, font: ctx.bold, color: valColor });
    y -= 14;
  }
}

/* ── parties / vehicle box ──────────────────────────────────────────────── */

interface FieldRow { label: string; value: string }

function drawFieldGrid(ctx: Ctx, fields: FieldRow[], x: number, maxW: number) {
  const labelSize = 7;
  const valueSize = 8.5;
  for (const f of fields) {
    text(ctx, f.label, { x, size: labelSize, bold: true, color: FAINT });
    const labelW = ctx.bold.widthOfTextAtSize(f.label, labelSize);
    text(ctx, f.value, { x: x + labelW + 8, size: valueSize, maxW: maxW - labelW - 8 });
    ctx.y -= 13;
  }
}

function partiesBox(ctx: Ctx, buyer: BuyerBlock, p: PropertyBlock, leftLabel = "BILLED TO") {
  const boxTop = ctx.y;
  const boxX = MARGIN;
  const boxW = CONTENT_W;
  const divX = MARGIN + boxW * 0.42;
  const rightColX = divX + 14;
  const rightColW = boxW - (divX - MARGIN) - 28;
  const leftColW = divX - MARGIN - 28;
  const pad = 14;

  const leftFieldRows: FieldRow[] = [
    buyer.idOrBrn ? { label: "ID NO.", value: buyer.idOrBrn } : null,
    buyer.phone ? { label: "TEL", value: buyer.phone } : null,
    buyer.vatNumber ? { label: "VAT", value: buyer.vatNumber } : null,
  ].filter(Boolean) as FieldRow[];

  const propFields: FieldRow[] = [
    p.address ? { label: "ADDRESS", value: p.address } : null,
    p.suburb ? { label: "SUBURB", value: p.suburb } : null,
    p.city ? { label: "CITY", value: p.city } : null,
    p.erfRef ? { label: "ERF NO.", value: p.erfRef } : null,
    typeof p.floorSize === "number" ? { label: "FLOOR SIZE", value: `${p.floorSize.toLocaleString("en-ZA")} m²` } : null,
    typeof p.erfSize === "number" ? { label: "ERF SIZE", value: `${p.erfSize.toLocaleString("en-ZA")} m²` } : null,
    typeof p.bedrooms === "number" ? { label: "BEDROOMS", value: String(p.bedrooms) } : null,
    typeof p.bathrooms === "number" ? { label: "BATHROOMS", value: String(p.bathrooms) } : null,
    typeof p.parkingSpaces === "number" ? { label: "PARKING", value: String(p.parkingSpaces) } : null,
    p.listingRef ? { label: "LISTING", value: p.listingRef } : null,
  ].filter(Boolean) as FieldRow[];

  const buyerAddressLines = (buyer.address || "").split(/\s*,\s*/).filter(Boolean);
  const leftLineCount = 1 + buyerAddressLines.length + (buyerAddressLines.length ? 0.5 : 0) + leftFieldRows.length;
  const propLineCount = 1 + 1 + propFields.length;
  const rows = Math.max(leftLineCount, propLineCount);
  const boxH = rows * 13 + pad * 2 + 20;

  ctx.page.drawRectangle({ x: boxX, y: ctx.y - boxH, width: boxW, height: boxH, color: TINT });
  ctx.page.drawRectangle({ x: boxX, y: ctx.y - boxH, width: boxW, height: boxH, borderColor: RULE, borderWidth: 0.75 });
  ctx.page.drawLine({ start: { x: divX, y: ctx.y }, end: { x: divX, y: ctx.y - boxH }, thickness: 0.75, color: RULE });

  ctx.y -= pad;
  const contentTop = ctx.y;

  text(ctx, leftLabel, { x: boxX + pad, size: 7, bold: true, color: FAINT });
  ctx.y -= 13;
  text(ctx, buyer.name || "", { x: boxX + pad, size: 10, bold: true });
  ctx.y -= 14;
  for (const line of buyerAddressLines) {
    text(ctx, line, { x: boxX + pad, size: 9, color: BODY_TEXT });
    ctx.y -= 12;
  }
  if (buyerAddressLines.length) ctx.y -= 4;
  for (const f of leftFieldRows) {
    text(ctx, f.label, { x: boxX + pad, size: 7, bold: true, color: FAINT });
    const lw = ctx.bold.widthOfTextAtSize(f.label, 7);
    text(ctx, f.value, { x: boxX + pad + lw + 8, size: 8.5 });
    ctx.y -= 13;
  }

  ctx.y = contentTop;
  text(ctx, "VEHICLE", { x: rightColX, size: 7, bold: true, color: FAINT });
  ctx.y -= 13;
  text(ctx, p.address || p.suburb || 'Property', { x: rightColX, size: 10, bold: true, maxW: rightColW });
  ctx.y -= 16;
  for (const f of propFields) {
    text(ctx, f.label, { x: rightColX, size: 7, bold: true, color: FAINT });
    const lw = ctx.bold.widthOfTextAtSize(f.label, 7);
    text(ctx, f.value, { x: rightColX + lw + 8, size: 8.5 });
    ctx.y -= 13;
  }

  ctx.y = contentTop - boxH + pad - 10;
}

/* ── line items table ───────────────────────────────────────────────────── */

function lineItemsTable(ctx: Ctx, lines: { label: string; amountIncl: number }[]) {
  const right = PAGE.w - MARGIN;

  darkRule(ctx);
  ctx.y -= 12;
  text(ctx, "DESCRIPTION", { size: 7, bold: true, color: FAINT });
  textRight(ctx, "AMOUNT (INCL.)", right, { size: 7, bold: true, color: FAINT });
  ctx.y -= 16;

  for (const l of lines) {
    text(ctx, l.label, { size: 9.5, maxW: CONTENT_W - 110 });
    textRight(ctx, money(l.amountIncl), right, { size: 9.5 });
    ctx.y -= 4;
    hRule(ctx, HAIR);
    ctx.y -= 12;
  }
}

/* ── totals block ───────────────────────────────────────────────────────── */

function totalBar(ctx: Ctx, label: string, amount: string) {
  const barW = 240;
  const barH = 28;
  const barX = PAGE.w - MARGIN - barW;
  ctx.page.drawRectangle({ x: barX, y: ctx.y - barH + 8, width: barW, height: barH, color: INK });
  ctx.page.drawText(label, { x: barX + 12, y: ctx.y - 6, size: 7.5, font: ctx.bold, color: WHITE });
  const amtW = ctx.bold.widthOfTextAtSize(amount, 12);
  ctx.page.drawText(amount, { x: PAGE.w - MARGIN - 12 - amtW, y: ctx.y - 8, size: 12, font: ctx.bold, color: WHITE });
  ctx.y -= barH + 4;
}

/* ── tinted info box ────────────────────────────────────────────────────── */

function tintedBox(ctx: Ctx, heading: string, drawContent: (innerX: number, innerW: number) => void, opts: { halfWidth?: "left" | "right"; accentHeading?: boolean } = {}) {
  const pad = 14;
  let boxX = MARGIN;
  let boxW = CONTENT_W;
  if (opts.halfWidth === "left") { boxW = CONTENT_W * 0.42; }
  if (opts.halfWidth === "right") { boxX = MARGIN + CONTENT_W * 0.42 + 12; boxW = CONTENT_W * 0.58 - 12; }

  const savedY = ctx.y;
  const innerX = boxX + pad;
  const innerW = boxW - pad * 2;

  ctx.y -= pad;
  text(ctx, heading, { x: innerX, size: 7, bold: true, color: opts.accentHeading !== false ? ACCENT : FAINT });
  ctx.y -= 14;
  drawContent(innerX, innerW);

  const boxH = savedY - ctx.y + pad;
  ctx.page.drawRectangle({ x: boxX, y: savedY - boxH, width: boxW, height: boxH, color: TINT });
  ctx.page.drawRectangle({ x: boxX, y: savedY - boxH, width: boxW, height: boxH, borderColor: RULE, borderWidth: 0.75 });

  const savedY2 = ctx.y;
  ctx.y = savedY - pad;
  text(ctx, heading, { x: innerX, size: 7, bold: true, color: opts.accentHeading !== false ? ACCENT : FAINT });
  ctx.y -= 14;
  drawContent(innerX, innerW);
  ctx.y = savedY2 - pad;
}

/* ── signature block ────────────────────────────────────────────────────── */

function signatureBlock(ctx: Ctx, leftLabel: string, rightLabel: string, date?: Date) {
  const right = PAGE.w - MARGIN;
  const mid = PAGE.w / 2;
  const gap = 24;

  ctx.y -= 32;
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: mid - gap, y: ctx.y }, thickness: 0.75, color: INK });
  ctx.page.drawLine({ start: { x: mid + gap, y: ctx.y }, end: { x: right, y: ctx.y }, thickness: 0.75, color: INK });
  ctx.y -= 10;
  text(ctx, leftLabel, { size: 7, bold: true, color: FAINT });
  text(ctx, rightLabel, { x: mid + gap, size: 7, bold: true, color: FAINT });

  ctx.y -= 20;
  const dateColW = (mid - gap - MARGIN) * 0.62;
  const timeColW = (mid - gap - MARGIN) * 0.32;
  const dateX2 = mid + gap;
  const dateColW2 = (right - mid - gap) * 0.62;
  const timeX = MARGIN + dateColW + 12;
  const timeX2 = dateX2 + dateColW2 + 12;

  if (date) {
    ctx.page.drawText(dateStr(date), { x: MARGIN, y: ctx.y + 6, size: 8.5, font: ctx.regular, color: BODY_TEXT });
    ctx.page.drawText(dateStr(date), { x: dateX2, y: ctx.y + 6, size: 8.5, font: ctx.regular, color: BODY_TEXT });
  }
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: MARGIN + dateColW, y: ctx.y }, thickness: 0.5, color: RULE });
  ctx.page.drawLine({ start: { x: timeX, y: ctx.y }, end: { x: mid - gap, y: ctx.y }, thickness: 0.5, color: RULE });
  ctx.page.drawLine({ start: { x: dateX2, y: ctx.y }, end: { x: dateX2 + dateColW2, y: ctx.y }, thickness: 0.5, color: RULE });
  ctx.page.drawLine({ start: { x: timeX2, y: ctx.y }, end: { x: right, y: ctx.y }, thickness: 0.5, color: RULE });
  ctx.y -= 10;
  text(ctx, "DATE", { size: 7, bold: true, color: FAINT });
  text(ctx, "TIME", { x: timeX, size: 7, bold: true, color: FAINT });
  text(ctx, "DATE", { x: dateX2, size: 7, bold: true, color: FAINT });
  text(ctx, "TIME", { x: timeX2, size: 7, bold: true, color: FAINT });
}

/* ── page footer ────────────────────────────────────────────────────────── */

function pageFooter(ctx: Ctx, d: DealerLetterhead, docNumber: string, thankYouNote?: string) {
  if (thankYouNote) {
    ctx.y -= 12;
    const tw = ctx.regular.widthOfTextAtSize(thankYouNote, 9);
    ctx.page.drawText(thankYouNote, {
      x: MARGIN + (CONTENT_W - tw) / 2,
      y: ctx.y,
      size: 9,
      font: ctx.regular,
      color: BODY_TEXT,
    });
    ctx.y -= 18;
  }

  ctx.y -= 6;
  hRule(ctx);
  ctx.y -= 10;
  const regLine = [
    d.name,
    d.registrationNumber ? `Reg ${d.registrationNumber}` : "",
    d.vatNumber ? `VAT ${d.vatNumber}` : "",
  ].filter(Boolean).join("  ·  ");
  text(ctx, regLine, { size: 7.5, color: FAINT });
  textRight(ctx, docNumber, PAGE.w - MARGIN, { size: 7.5, color: FAINT });
}

/* ── 1. Proforma Invoice ─────────────────────────────────────────────────── */

export interface ProformaInput {
  dealer: DealerLetterhead;
  buyer: BuyerBlock;
  vehicle: PropertyBlock;
  proformaNumber: string;
  issuedAt: Date;
  validUntil: string;
  lines: { label: string; amountIncl: number }[];
  totalIncl: number;
  docSettings?: DocSettings;
}

export async function renderProforma(input: ProformaInput): Promise<Uint8Array> {
  const { doc, ctx } = await createDoc();
  const right = PAGE.w - MARGIN;

  dealerHeader(ctx, input.dealer);

  const titleY = ctx.y;
  docTitle(ctx, "Proforma Invoice");

  metaGrid(ctx, [
    { label: "PROFORMA NO.", value: input.proformaNumber },
    { label: "DATE", value: dateStr(input.issuedAt) },
    { label: "VALID UNTIL", value: input.validUntil, accent: true },
  ], titleY);

  ctx.y -= 10;
  partiesBox(ctx, input.buyer, input.vehicle, "PREPARED FOR");

  ctx.y -= 18;
  lineItemsTable(ctx, input.lines);

  ctx.y -= 6;
  const excl = input.totalIncl / (1 + VAT_RATE);
  const vat = input.totalIncl - excl;
  const totalsX = PAGE.w - MARGIN - 240;

  text(ctx, "Total excluding VAT", { x: totalsX, size: 9, color: MUTED });
  textRight(ctx, money(excl), right, { size: 9 });
  ctx.y -= 14;
  text(ctx, `VAT @ ${(VAT_RATE * 100).toFixed(0)}%`, { x: totalsX, size: 9, color: MUTED });
  textRight(ctx, money(vat), right, { size: 9 });
  ctx.y -= 6;
  hRule(ctx, RULE, totalsX, right);
  ctx.y -= 10;
  totalBar(ctx, "TOTAL INCLUDING VAT", money(input.totalIncl));

  ctx.y -= 10;
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 40, width: CONTENT_W, height: 40, color: TINT });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 40, width: CONTENT_W, height: 40, borderColor: RULE, borderWidth: 0.75 });
  ctx.y -= 14;
  paragraphWrap(ctx, "This proforma invoice is an estimate only and does not constitute a binding offer. " +
    "Prices are subject to change until a formal Offer to Purchase is signed by both parties.",
    { size: 8.5, color: BODY_TEXT, x: MARGIN + 14, maxW: CONTENT_W - 28 });
  ctx.y -= 8;

  pageFooter(ctx, input.dealer, input.proformaNumber, input.docSettings?.footerNote);

  return doc.save();
}

/* ── 2. Offer to Purchase ────────────────────────────────────────────────── */

export interface OfferInput {
  dealer: DealerLetterhead;
  buyer: BuyerBlock;
  vehicle: PropertyBlock;
  offerNumber: string;
  issuedAt: Date;
  lines: { label: string; amountIncl: number }[];
  totalIncl: number;
  depositAmount?: number;
  balanceDue?: number;
  tradeIn?: { description: string; allowance: number };
  disclosedDefects?: string[];
  docSettings?: DocSettings;
}

export async function renderOffer(input: OfferInput): Promise<Uint8Array> {
  const { doc, ctx } = await createDoc();
  const right = PAGE.w - MARGIN;

  dealerHeader(ctx, input.dealer);

  const titleY = ctx.y;
  docTitle(ctx, "Offer to Purchase");

  metaGrid(ctx, [
    { label: "OFFER NO.", value: input.offerNumber },
    { label: "DATE", value: dateStr(input.issuedAt) },
    { label: "LISTING NO.", value: input.vehicle.listingRef || input.vehicle.address || "" },
  ], titleY);

  ctx.y -= 10;
  partiesBox(ctx, input.buyer, input.vehicle, "BUYER");

  ctx.y -= 18;
  lineItemsTable(ctx, input.lines);

  ctx.y -= 6;
  const totalsX = PAGE.w - MARGIN - 240;

  text(ctx, "Purchase price (incl. VAT)", { x: totalsX, size: 9, bold: true });
  textRight(ctx, money(input.totalIncl), right, { size: 9, bold: true });
  ctx.y -= 14;

  if (input.tradeIn) {
    text(ctx, `Trade-in -- ${input.tradeIn.description}`, { x: totalsX, size: 9, color: MUTED });
    textRight(ctx, `- ${money(input.tradeIn.allowance)}`, right, { size: 9, color: MUTED });
    ctx.y -= 14;
  }
  if (typeof input.depositAmount === "number" && input.depositAmount > 0) {
    text(ctx, "Deposit", { x: totalsX, size: 9, color: MUTED });
    textRight(ctx, `- ${money(input.depositAmount)}`, right, { size: 9, color: MUTED });
    ctx.y -= 6;
    hRule(ctx, RULE, totalsX, right);
    ctx.y -= 10;
  }
  if (typeof input.balanceDue === "number") {
    totalBar(ctx, "BALANCE DUE ON DELIVERY", money(input.balanceDue));
  }

  // Disclosed defects
  ctx.y -= 10;
  const defectBoxTop = ctx.y;
  const hasDefects = input.disclosedDefects && input.disclosedDefects.length > 0;

  ctx.page.drawRectangle({ x: MARGIN, y: 0, width: CONTENT_W, height: 1, color: TINT });
  const innerX = MARGIN + 14;
  const innerW = CONTENT_W - 28;

  const measureY = ctx.y;
  ctx.y -= 14;
  ctx.y -= 14;
  if (hasDefects) {
    for (const defect of input.disclosedDefects!) {
      ctx.y -= 13;
    }
    ctx.y -= 6;
    paragraphWrap(ctx, "The Buyer acknowledges having been informed of the above defects and accepts " +
      "the vehicle subject to them, in accordance with section 55(6) of the Consumer Protection Act.",
      { size: 8, color: MUTED, x: innerX, maxW: innerW });
  } else {
    paragraphWrap(ctx, "The Seller declares that, to the best of its knowledge, the vehicle has no known defects " +
      "as at the date of this offer. The Buyer's rights under sections 55 and 56 of the Consumer Protection Act are not affected.",
      { size: 8, color: MUTED, x: innerX, maxW: innerW });
  }
  const defectBoxH = measureY - ctx.y + 28;

  ctx.page.drawRectangle({ x: MARGIN, y: measureY - defectBoxH + 14, width: CONTENT_W, height: defectBoxH, color: TINT });
  ctx.page.drawRectangle({ x: MARGIN, y: measureY - defectBoxH + 14, width: CONTENT_W, height: defectBoxH, borderColor: RULE, borderWidth: 0.75 });

  ctx.y = measureY;
  ctx.y -= 14;
  text(ctx, "DISCLOSED DEFECTS  ·  CPA s55/s56", { x: innerX, size: 7, bold: true, color: ACCENT });
  ctx.y -= 14;
  if (hasDefects) {
    for (const defect of input.disclosedDefects!) {
      text(ctx, `·  ${defect}`, { x: innerX, size: 9 });
      ctx.y -= 13;
    }
    ctx.y -= 6;
    paragraphWrap(ctx, "The Buyer acknowledges having been informed of the above defects and accepts " +
      "the vehicle subject to them, in accordance with section 55(6) of the Consumer Protection Act.",
      { size: 8, color: MUTED, x: innerX, maxW: innerW });
  } else {
    paragraphWrap(ctx, "The Seller declares that, to the best of its knowledge, the vehicle has no known defects " +
      "as at the date of this offer. The Buyer's rights under sections 55 and 56 of the Consumer Protection Act are not affected.",
      { size: 8, color: MUTED, x: innerX, maxW: innerW });
  }
  ctx.y -= 14;

  // Terms
  const terms = input.docSettings?.saleTerms?.filter(Boolean);
  if (terms && terms.length > 0) {
    hRule(ctx, RULE);
    ctx.y -= 12;
    text(ctx, "TERMS AND CONDITIONS", { size: 7, bold: true, color: FAINT });
    ctx.y -= 14;
    for (let i = 0; i < terms.length; i++) {
      paragraphWrap(ctx, `${i + 1}. ${terms[i]}`, { size: 9, lead: 12, color: BODY_TEXT });
      ctx.y -= 4;
    }
  }

  signatureBlock(ctx, "BUYER SIGNATURE", "SELLER SIGNATURE", input.issuedAt);

  pageFooter(ctx, input.dealer, input.offerNumber, input.docSettings?.footerNote);

  return doc.save();
}

/* ── 3. Tax Invoice ──────────────────────────────────────────────────────── */

export interface TaxInvoiceInput {
  dealer: DealerLetterhead;
  buyer: BuyerBlock;
  vehicle: PropertyBlock;
  invoiceNumber: string;
  issuedAt: Date;
  totalIncl: number;
  lines?: { label: string; amountIncl: number }[];
  docSettings?: DocSettings;
}

export async function renderTaxInvoice(input: TaxInvoiceInput): Promise<Uint8Array> {
  const { doc, ctx } = await createDoc();
  const right = PAGE.w - MARGIN;

  dealerHeader(ctx, input.dealer);

  const titleY = ctx.y;
  docTitle(ctx, "Tax Invoice");

  metaGrid(ctx, [
    { label: "INVOICE NO.", value: input.invoiceNumber },
    { label: "DATE", value: dateStr(input.issuedAt) },
    { label: "VAT NO.", value: input.dealer.vatNumber || "" },
  ], titleY);

  ctx.y -= 10;
  partiesBox(ctx, input.buyer, input.vehicle);

  ctx.y -= 18;
  const lines = input.lines?.length
    ? input.lines
    : [{ label: input.vehicle.address || input.vehicle.suburb || "Property", amountIncl: input.totalIncl }];
  lineItemsTable(ctx, lines);

  ctx.y -= 6;
  const excl = input.totalIncl / (1 + VAT_RATE);
  const vat = input.totalIncl - excl;
  const totalsX = PAGE.w - MARGIN - 240;

  text(ctx, "Total excluding VAT", { x: totalsX, size: 9, color: MUTED });
  textRight(ctx, money(excl), right, { size: 9 });
  ctx.y -= 14;
  text(ctx, `VAT @ ${(VAT_RATE * 100).toFixed(0)}%`, { x: totalsX, size: 9, color: MUTED });
  textRight(ctx, money(vat), right, { size: 9 });
  ctx.y -= 6;
  hRule(ctx, RULE, totalsX, right);
  ctx.y -= 10;
  totalBar(ctx, "TOTAL DUE", money(input.totalIncl));

  // Banking details + Ownership side by side
  const bd = input.docSettings?.bankingDetails;
  ctx.y -= 10;
  const sectionTop = ctx.y;

  if (bd?.bankName || bd?.accountNumber) {
    const bankBoxX = MARGIN;
    const bankBoxW = CONTENT_W * 0.42;
    const bankPad = 14;
    const bankInnerX = bankBoxX + bankPad;

    const bankLines = [
      bd.bankName ? { label: "Bank", value: bd.bankName } : null,
      bd.branchCode ? { label: "Branch code", value: bd.branchCode } : null,
      bd.accountNumber ? { label: "Account no.", value: bd.accountNumber } : null,
      bd.accountType ? { label: "Type", value: bd.accountType } : null,
      { label: "Reference", value: input.invoiceNumber },
    ].filter(Boolean) as { label: string; value: string }[];

    const bankBoxH = bankLines.length * 14 + 42;
    ctx.page.drawRectangle({ x: bankBoxX, y: sectionTop - bankBoxH, width: bankBoxW, height: bankBoxH, color: TINT });
    ctx.page.drawRectangle({ x: bankBoxX, y: sectionTop - bankBoxH, width: bankBoxW, height: bankBoxH, borderColor: RULE, borderWidth: 0.75 });

    ctx.y = sectionTop - bankPad;
    text(ctx, "BANKING DETAILS", { x: bankInnerX, size: 7, bold: true, color: ACCENT });
    ctx.y -= 16;
    for (const bl of bankLines) {
      text(ctx, bl.label, { x: bankInnerX, size: 8, color: MUTED });
      const isRef = bl.label === "Reference";
      text(ctx, bl.value, { x: bankInnerX + 72, size: 8.5, bold: isRef, color: isRef ? ACCENT : INK });
      ctx.y -= 14;
    }
  }

  // Ownership on the right
  const ownX = MARGIN + CONTENT_W * 0.42 + 16;
  const ownW = CONTENT_W * 0.58 - 16;
  const bankBottom = ctx.y;
  ctx.y = sectionTop;
  ctx.y -= 14;
  text(ctx, "OWNERSHIP", { x: ownX, size: 7, bold: true, color: FAINT });
  ctx.y -= 16;
  paragraphWrap(ctx, input.docSettings?.ownershipClause || DEFAULT_OWNERSHIP,
    { size: 8.5, lead: 12, color: BODY_TEXT, x: ownX, maxW: ownW });

  ctx.y = Math.min(ctx.y, bankBottom) - 6;
  pageFooter(ctx, input.dealer, input.invoiceNumber, input.docSettings?.footerNote);

  return doc.save();
}

/* ── 4. Handover Certificate ─────────────────────────────────────────────── */

export interface HandoverInput {
  dealer: DealerLetterhead;
  buyer: BuyerBlock;
  vehicle: PropertyBlock;
  handoverNumber: string;
  issuedAt: Date;
  invoiceRef?: string;
  checklist?: { label: string; checked: boolean }[];
  docSettings?: DocSettings;
}

export async function renderHandover(input: HandoverInput): Promise<Uint8Array> {
  const { doc, ctx } = await createDoc();
  const right = PAGE.w - MARGIN;

  dealerHeader(ctx, input.dealer);

  const titleY = ctx.y;
  docTitle(ctx, "Handover Certificate");

  metaGrid(ctx, [
    { label: "HANDOVER REF.", value: input.handoverNumber },
    { label: "DATE", value: dateStr(input.issuedAt) },
    ...(input.invoiceRef ? [{ label: "INVOICE", value: input.invoiceRef }] : []),
  ], titleY);

  ctx.y -= 10;
  partiesBox(ctx, input.buyer, input.vehicle, "RECEIVED BY");

  // Checklist
  ctx.y -= 18;
  darkRule(ctx);
  ctx.y -= 12;
  text(ctx, "HANDOVER CHECKLIST", { size: 7, bold: true, color: FAINT });
  ctx.y -= 16;

  const items = input.checklist?.length ? input.checklist : [
    { label: "Vehicle keys (all sets) handed over", checked: false },
    { label: "Spare wheel and jack present", checked: false },
    { label: "Owner's manual / service book", checked: false },
    { label: "NATIS document (registration certificate) handed to buyer", checked: false },
    { label: "Roadworthy certificate provided", checked: false },
    { label: "Licence disc valid and in windscreen", checked: false },
    { label: "Vehicle condition walkthrough completed with buyer", checked: false },
  ];
  for (const item of items) {
    const boxSize = 9;
    const boxY = ctx.y - 1;
    if (item.checked) {
      ctx.page.drawRectangle({ x: MARGIN, y: boxY, width: boxSize, height: boxSize, color: ACCENT });
      ctx.page.drawText("x", { x: MARGIN + 2, y: boxY + 1.5, size: 7, font: ctx.bold, color: WHITE });
    } else {
      ctx.page.drawRectangle({ x: MARGIN, y: boxY, width: boxSize, height: boxSize, borderColor: MUTED, borderWidth: 0.75 });
    }
    text(ctx, item.label, { x: MARGIN + 18, size: 9.5 });
    ctx.y -= 4;
    hRule(ctx, HAIR);
    ctx.y -= 12;
  }

  // Warranty + Buyer acknowledgement side by side
  ctx.y -= 10;
  const sectionTop = ctx.y;

  const warrantyBoxX = MARGIN;
  const warrantyBoxW = CONTENT_W * 0.42;
  const wPad = 14;
  const wInnerX = warrantyBoxX + wPad;
  const wt = input.docSettings?.warrantyTerms;

  const warrantyText = wt || "As per the terms agreed in the Offer to Purchase.";
  ctx.y = sectionTop - wPad;
  text(ctx, "WARRANTY", { x: wInnerX, size: 7, bold: true, color: ACCENT });
  ctx.y -= 14;
  const wTextTop = ctx.y;
  paragraphWrap(ctx, warrantyText, { size: 9, lead: 13, color: INK, x: wInnerX, maxW: warrantyBoxW - wPad * 2 });
  const warrantyBoxH = sectionTop - ctx.y + wPad;

  ctx.page.drawRectangle({ x: warrantyBoxX, y: sectionTop - warrantyBoxH, width: warrantyBoxW, height: warrantyBoxH, color: TINT });
  ctx.page.drawRectangle({ x: warrantyBoxX, y: sectionTop - warrantyBoxH, width: warrantyBoxW, height: warrantyBoxH, borderColor: RULE, borderWidth: 0.75 });

  ctx.y = sectionTop - wPad;
  text(ctx, "WARRANTY", { x: wInnerX, size: 7, bold: true, color: ACCENT });
  ctx.y -= 14;
  paragraphWrap(ctx, warrantyText, { size: 9, lead: 13, color: INK, x: wInnerX, maxW: warrantyBoxW - wPad * 2 });

  // Buyer acknowledgement on the right
  const ackX = MARGIN + CONTENT_W * 0.42 + 16;
  const ackW = CONTENT_W * 0.58 - 16;
  ctx.y = sectionTop;
  ctx.y -= 14;
  text(ctx, "BUYER ACKNOWLEDGEMENT", { x: ackX, size: 7, bold: true, color: FAINT });
  ctx.y -= 14;
  paragraphWrap(ctx, "I, the Buyer, confirm that I have received the vehicle described above in the condition " +
    "disclosed at the time of sale, have inspected it to my satisfaction, and have received " +
    "all items marked above. I understand my rights under the Consumer Protection Act 68 of 2008.",
    { size: 8.5, lead: 12, color: BODY_TEXT, x: ackX, maxW: ackW });
  ctx.y -= 4;
  paragraphWrap(ctx, "From the moment of taking physical delivery, the Buyer assumes all risk and liability " +
    "for the vehicle, including but not limited to traffic fines, toll charges, and third-party claims.",
    { size: 8.5, lead: 12, color: BODY_TEXT, x: ackX, maxW: ackW });

  signatureBlock(ctx, "BUYER SIGNATURE", "DEALER REPRESENTATIVE", input.issuedAt);

  pageFooter(ctx, input.dealer, input.handoverNumber, input.docSettings?.footerNote);

  return doc.save();
}
