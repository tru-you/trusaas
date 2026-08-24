export interface GuideStep {
  title: string;
  detail: string;
}

export interface Guide {
  id: string;
  title: string;
  goal: string;
  blurb: string;
  section?: string;
  spine?: boolean;
  steps: GuideStep[];
}

const GUIDES: Guide[] = [
  {
    id: "full-inspection",
    title: "Run a full inspection",
    goal: "Walk around a vehicle, photograph every angle, complete the checklist, and produce a signed-off inspection report.",
    blurb: "Select vehicle, shoot, checklist, damage, report.",
    section: "inventory",
    spine: true,
    steps: [
      { title: "Select a vehicle", detail: "Tap any vehicle card in the catalogue. Unsigned vehicles show how many photos and checklist items are outstanding." },
      { title: "Follow the camera guide", detail: "The camera opens on the first empty slot. Frame the car to match the overlay and tap the shutter." },
      { title: "Complete the checklist", detail: "After photos, the checklist covers tyres, lights, fluids, bodywork and interior. Mark each item Pass, Fail, or N/A." },
      { title: "Tag any damage", detail: "Tap the damage icon to mark scratches, dents, or chips on the photo. You place every tag yourself — nothing is auto-detected, so the report only contains what you saw." },
      { title: "Review and sign off", detail: "Once every core slot and checklist item is filled, the completion screen shows a summary. Submit to generate the report." },
      { title: "Share the report", detail: "The signed-off report is available as a PDF. Download it or share directly from the app." },
    ],
  },
  {
    id: "checklist",
    title: "Work through the checklist",
    goal: "Understand the inspection checklist categories and how each item affects the final report.",
    blurb: "Categories, pass/fail/N/A, report impact.",
    section: "checklist",
    steps: [
      { title: "Open the checklist", detail: "From the camera guide, tap the checklist icon. Items are grouped: exterior, glass & lights, wheels & tyres, interior, engine & underbody, identity & documents." },
      { title: "Mark each item", detail: "Items are marked OK, Noted or Damaged (or working / not working for function checks). Flagged items show in the report." },
      { title: "Add notes where needed", detail: "Each item has an optional notes field. Use it for anything the pass/fail alone does not capture." },
      { title: "Check your progress", detail: "The header shows how many items are done. All items must be marked before the inspection can be signed off." },
    ],
  },
  {
    id: "damage",
    title: "Log and review damage",
    goal: "Pin every scratch, dent and chip to the exact spot on the photo so the report shows what you saw.",
    blurb: "Manual pinning, severity levels, close-ups.",
    section: "damage",
    steps: [
      { title: "Open damage view", detail: "From the camera guide, tap the damage icon. Nothing is highlighted for you — tagging is the inspector's call, which is what keeps the report defensible." },
      { title: "Tap the exact spot", detail: "Tap anywhere on the photo to place a marker where the damage actually is. The report plots it back on the same image." },
      { title: "Choose type and severity", detail: "Pick the damage type — scratch, dent, chip, rust, crack, paint, wear, missing — and grade severity from 1 (Cosmetic) to 5 (Structural)." },
      { title: "Add close-ups", detail: "Shoot close-up photos of the damage right there. They attach to the finding and print with it in the report." },
      { title: "Review the damage log", detail: "All tagged damage is listed below the photo and appears in the final inspection report. If you didn't tag it, it doesn't appear." },
    ],
  },
  {
    id: "trade-in",
    title: "Do a trade-in valuation",
    goal: "A trade-in has a documented condition walk-around and an offer you can defend line by line.",
    blurb: "Walk-around, live prices, margin, signed offer.",
    section: "trade-in",
    steps: [
      { title: "Start a trade-in", detail: "From the vehicle card, tap the trade-in button. This opens the condition assessment form." },
      { title: "Complete all items", detail: "Work each panel and item — flag anything damaged with an estimated recon cost. The offer is built from what you enter." },
      { title: "Pull live prices", detail: "Fetch Live Market Value shows what similar cars are asking on AutoTrader and Cars.co.za right now (free). TransUnion Valuation gives the official trade/retail figure when you need it — uses one credit." },
      { title: "Set your margin", detail: "The offer calculates as retail minus recon costs minus your margin %. Adjust the margin on the spot while the customer watches." },
      { title: "Save or share the summary", detail: "The appraisal carries your branding and T&Cs with a drawn signature. Save it to the vehicle record or export as PDF." },
    ],
  },
  {
    id: "report",
    title: "Generate and share the report",
    goal: "Produce the final inspection PDF and send it where it needs to go.",
    blurb: "What the PDF contains, generate, share.",
    section: "report",
    steps: [
      { title: "Sign off the inspection", detail: "The report generates once every core photo and checklist item is completed. Tap Submit on the completion screen." },
      { title: "Review the PDF", detail: "The report shows all photos, checklist results, damage markers, and the overall condition summary." },
      { title: "Download or share", detail: "Tap Download to save the PDF, or Share to send it via WhatsApp, email, or any other app on your phone." },
    ],
  },
  {
    id: "signoff",
    title: "Understand sign-off status",
    goal: "Know at a glance which vehicles are fully inspected and which still need work.",
    blurb: "Signed-off vs unsigned, completeness badges.",
    section: "inventory",
    steps: [
      { title: "Check the catalogue", detail: "Each vehicle card shows its inspection status: signed-off (complete) or unsigned (work remaining)." },
      { title: "Signed-off vehicles", detail: "A signed-off vehicle has all core photos, a completed checklist, and a generated report. No further action needed." },
      { title: "Unsigned vehicles", detail: "These still need photos, checklist items, or both. The card shows what is missing." },
      { title: "Re-inspect if needed", detail: "You can reopen a signed-off vehicle to update photos or checklist items. The report regenerates automatically." },
    ],
  },
  {
    id: "verify-vehicle",
    title: "Verify a car while adding it",
    goal: "A car has a TransUnion background check and claims history before the inspection even starts.",
    blurb: "Reg check and accident report in Add Vehicle.",
    section: "inventory",
    steps: [
      { title: "Capture the VIN or stock number", detail: "In Add Vehicle, enter the VIN (or scan the disc). The verification buttons use it to look the car up." },
      { title: "Tap Verify Registration", detail: "Runs a live TransUnion check — stolen and finance-pending flags come back in seconds as Clear / Stolen / Finance pending chips." },
      { title: "Run Accident Report", detail: "Needs the VIN. Returns the claims history so a rebuilt unit never surprises you mid-appraisal." },
      { title: "Credits apply", detail: "Each check uses one credit from your yard's balance; the count shows on the button. Out of credits? Your TruSaaS account manager tops you up — everything else in Inspect stays unlimited." },
    ],
  },
  {
    id: "brand-your-reports",
    title: "Brand your reports",
    goal: "Every inspection report and trade-in document carries your yard's name, contact details and terms.",
    blurb: "Set identity once — printed on everything.",
    section: "settings",
    steps: [
      { title: "Open Settings", detail: "Desktop: Settings in the sidebar. Phone: the Settings tab. The fields are the same on both." },
      { title: "Fill the identity fields", detail: "Dealership name, address, email and VAT/reg number are printed on every report and trade-in document. Name, email and address are the must-haves." },
      { title: "Add your trade-in T&Cs", detail: "Optional but recommended: your own terms print on the appraisal and offer instead of nothing." },
      { title: "It syncs", detail: "Settings persist per dealership on this instance — sign in on another computer and they're already there. Reports still render instantly offline from this device's copy." },
    ],
  },
];

export function guidesForSection(section: string): Guide[] {
  return GUIDES.filter((g) => g.section === section);
}

export function allGuides(): Guide[] {
  return GUIDES;
}
