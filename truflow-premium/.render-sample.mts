import { renderProforma, renderOffer, renderTaxInvoice, renderHandover } from "./docPdf";
import { writeFileSync } from "fs";

const OUT = "C:/Users/pgdeb/AppData/Local/Temp/claude/C--Users-pgdeb-OneDrive-Documents-Desktop-Paulie-Hub-projects-Mel-Art/6ef448ef-a08d-4427-a12d-bc965ad577c4/scratchpad";

const dealer = {
  name: "Sipho Auto (Pty) Ltd",
  tradingAs: "Sipho Motors",
  address: "12 Main Rd, Kariega, 6229",
  registrationNumber: "2015/123456/07",
  vatNumber: "4001234567",
  contactEmail: "sales@siphomotors.co.za",
  websiteUrl: "https://siphomotors.co.za",
};
const buyer = {
  name: "Annelie Botha",
  address: "45 Oak Avenue, Gqeberha, 6001",
  idOrBrn: "8506150012089",
  phone: "082 000 0002",
};
const vehicle = {
  description: "2019 Mercedes-Benz C-Class C200 AMG Line Auto Sedan",
  vin: "WDD2050091R123456",
  engineNumber: "27492030654321",
  mmCode: "00730360",
  stockNumber: "STK-2026-045",
  mileage: 48500,
  colour: "Obsidian Black",
  registrationNumber: "CA 123-456",
};
const docSettings = {
  bankingDetails: { bankName: "FNB", branchCode: "250655", accountNumber: "62012345678", accountType: "Business Cheque" },
  saleTerms: [
    "A non-refundable deposit of 10% of the purchase price is payable upon signing of this offer.",
    "The balance of the purchase price shall be paid within 7 (seven) business days of acceptance.",
    "The vehicle is sold with a 6-month / 10 000 km mechanical warranty.",
  ],
  footerNote: "Thank you for choosing Sipho Motors — where service meets excellence.",
  warrantyTerms: "6-month / 10 000 km mechanical warranty provided by MotorHappy. Contact 0800 002 222.",
};
const now = new Date("2026-08-07T10:00:00Z");

const p = await renderProforma({ dealer, buyer, vehicle, proformaNumber: "PRO-2026-00001", issuedAt: now, validUntil: "14 August 2026", lines: [{ label: "2019 Mercedes-Benz C200 AMG Line Auto Sedan", amountIncl: 449900 }, { label: "Tow bar", amountIncl: 4500 }, { label: "Tinting", amountIncl: 3500 }], totalIncl: 457900, docSettings });
writeFileSync(`${OUT}/proforma.pdf`, p);
console.log("proforma", p.length);

const o = await renderOffer({ dealer, buyer, vehicle, offerNumber: "OTP-2026-00001", issuedAt: now, lines: [{ label: "Vehicle", amountIncl: 449900 }, { label: "Tow bar", amountIncl: 4500 }, { label: "Tinting", amountIncl: 3500 }, { label: "Warranty", amountIncl: 8900 }], totalIncl: 466800, depositAmount: 46680, balanceDue: 420120, tradeIn: { description: "2015 VW Polo 1.2 TSI", allowance: 95000 }, disclosedDefects: ["Minor scratches on front bumper", "Slight wear on driver seat bolster"], docSettings });
writeFileSync(`${OUT}/offer.pdf`, o);
console.log("offer", o.length);

const inv = await renderTaxInvoice({ dealer, buyer, vehicle, invoiceNumber: "INV-2026-00005", issuedAt: now, totalIncl: 466800, lines: [{ label: "Vehicle", amountIncl: 449900 }, { label: "Tow bar", amountIncl: 4500 }, { label: "Tinting", amountIncl: 3500 }, { label: "Warranty", amountIncl: 8900 }], docSettings });
writeFileSync(`${OUT}/tax-invoice.pdf`, inv);
console.log("invoice", inv.length);

const h = await renderHandover({ dealer, buyer, vehicle, handoverNumber: "HND-2026-00001", issuedAt: now, invoiceRef: "INV-2026-00005", docSettings });
writeFileSync(`${OUT}/handover.pdf`, h);
console.log("handover", h.length);

console.log("done");
