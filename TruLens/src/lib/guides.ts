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
    id: "first-shoot",
    title: "Shoot a car for the first time",
    goal: "Walk through every angle on a vehicle, get quality scores, and send the photos to your DMS.",
    blurb: "Open a vehicle, complete the guided slots, review scores, export.",
    section: "inventory",
    spine: true,
    steps: [
      { title: "Open a vehicle", detail: "Tap any vehicle card in the catalogue. Vehicles with missing photos show a progress bar." },
      { title: "Follow the shot guide", detail: "The camera opens on the first empty slot. Frame the car to match the overlay, then tap the shutter. Each shot is scored instantly." },
      { title: "Review or retake", detail: "After each shot you can Keep or Redo. If the score is low, redo before moving on — it only takes a second." },
      { title: "Complete all core slots", detail: "Core slots are the minimum for a listing-ready vehicle. Optional slots (engine bay, boot, etc.) improve the listing but are not required." },
      { title: "Check the readiness badge", detail: "Once every core slot has a photo the vehicle shows Listing-ready. You can still add optional shots." },
      { title: "Export to DMS", detail: "Tap Publish when all core shots are done. The photos are sent to TruFlow where they appear on your website." },
    ],
  },
  {
    id: "reshoot",
    title: "Reshoot or replace a photo",
    goal: "Replace a single shot without redoing the whole vehicle.",
    blurb: "Find the slot, retake, edit if needed, re-export.",
    section: "camera",
    steps: [
      { title: "Open the vehicle", detail: "Tap the vehicle card in the catalogue to enter the camera guide." },
      { title: "Tap the slot to replace", detail: "Scroll the slot strip at the top. Completed slots show a thumbnail — tap the one you want to redo." },
      { title: "Retake the photo", detail: "The camera opens on that slot. Shoot and choose Keep or Redo." },
      { title: "Edit if needed", detail: "After keeping, tap the edit icon to crop, adjust brightness, or tweak contrast before saving." },
      { title: "Re-export", detail: "The updated photo replaces the old one. Export again to push the change to your website." },
    ],
  },
  {
    id: "readiness",
    title: "Understand the readiness badges",
    goal: "Know at a glance which cars are ready to list and which still need work.",
    blurb: "Listing-ready vs need-photos, progress bars explained.",
    section: "inventory",
    steps: [
      { title: "Check the progress bar", detail: "Each vehicle card shows a thin bar tracking core-slot completion. A full bar means every required angle is covered." },
      { title: "Listing-ready badge", detail: "When all core slots have photos the vehicle is marked Listing-ready. It can be exported to your website." },
      { title: "Need-photos badge", detail: "Vehicles missing one or more core slots show how many are left. Tap to jump straight into the camera." },
      { title: "Optional slots", detail: "Shots beyond the core set (engine bay, boot, detail) improve the listing but do not affect the readiness badge." },
    ],
  },
  {
    id: "editor",
    title: "Use the photo editor",
    goal: "Fine-tune a shot after capture — crop, brightness, contrast — without leaving the app.",
    blurb: "Crop, adjust, save — quick touch-ups in the app.",
    section: "editor",
    steps: [
      { title: "Open a photo for editing", detail: "After keeping a shot, tap the edit icon on the slot thumbnail in the camera guide." },
      { title: "Crop and straighten", detail: "Drag the corners to crop. Use the rotation slider to straighten a tilted shot." },
      { title: "Adjust brightness and contrast", detail: "Slide the brightness and contrast controls until the car pops against its background." },
      { title: "Save", detail: "Tap Save. The edited version replaces the original in that slot and will be the one exported to your DMS." },
    ],
  },
  {
    id: "damage",
    title: "Tag damage on your photos",
    goal: "Pin scratches, dents and chips to the exact spot on the photo so buyers see honest condition.",
    blurb: "Manual pinning, severity levels, close-ups.",
    section: "damage",
    steps: [
      { title: "Open damage view", detail: "From the camera guide, tap the damage icon. Tagging is entirely yours — nothing is auto-detected, so the listing only reports what a human confirmed." },
      { title: "Tap the exact spot", detail: "Tap anywhere on the photo to place a marker where the damage is. Choose the damage type — scratch, dent, chip, rust, crack — and severity from 1 (Cosmetic) to 5 (Structural)." },
      { title: "Add close-ups", detail: "Shoot close-up photos of the finding right there so the report shows both context and detail." },
      { title: "Check the vehicle record", detail: "Pinned damage is saved to the vehicle, appears in reports and stays visible on the 360 spin at every angle." },
    ],
  },
  {
    id: "orbit-360",
    title: "Build the 360 spin",
    goal: "The car gets a drag-to-spin view built from the walk-around shots you already took.",
    blurb: "Shoot the lap, export once — TruOrbit builds itself.",
    section: "inventory",
    steps: [
      { title: "Shoot the clockwise lap", detail: "Complete the exterior panel slots of the walk-around — front bumper around to both fenders. Those panels are exactly what the spin is built from; wheels and roof shots stay out of it." },
      { title: "Export to DMS", detail: "With six or more orbit frames captured, Export to DMS also builds the TruOrbit Web3D spin automatically as part of the same push — no extra step." },
      { title: "Preview it", detail: "The report screen has 3D buttons once a spin exists. Open it to drag-spin, play the turntable or scrub frame-by-frame before it goes live." },
    ],
  },
  {
    id: "publish",
    title: "Publish photos to your website",
    goal: "Get your photos from TruLens onto your dealership website via TruFlow.",
    blurb: "Export to DMS, then go live in TruFlow.",
    section: "inventory",
    steps: [
      { title: "Finish core shots", detail: "Make sure the vehicle is Listing-ready — all core slots filled and scored." },
      { title: "Tap Publish", detail: "The publish button appears once core shots are complete. Tap it to send photos to TruFlow." },
      { title: "Photos land in TruFlow", detail: "Your shots appear on the vehicle record in TruFlow within a few seconds." },
      { title: "Go live", detail: "In TruFlow, flip the Website toggle to On. The vehicle and its photos are now on your dealership site." },
    ],
  },
  {
    id: "verify-before-export",
    title: "Verify a car while adding it",
    goal: "A car has a TransUnion background check and claims history before it ever leaves the yard.",
    blurb: "Reg check and accident report in Add Vehicle.",
    section: "inventory",
    steps: [
      { title: "Fill the VIN or stock number", detail: "In Add Vehicle, capture the VIN (or scan the licence disc). The verification buttons use it to look the car up." },
      { title: "Tap Verify Registration", detail: "Runs a live TransUnion check — stolen and finance-pending flags come back in seconds as a Clear / Stolen / Finance pending chip." },
      { title: "Run Accident Report", detail: "Needs the VIN. Returns the vehicle's claims history so a rebuilt unit never surprises you at resale." },
      { title: "Credits apply", detail: "Each check uses one credit from your yard's balance; the count shows on the button. Out of credits? Your TruSaaS account manager tops you up — everything else in Lens stays unlimited." },
    ],
  },
  {
    id: "scan-a-disc",
    title: "Scan a licence disc instead of typing",
    goal: "The car's details are captured from its disc photo — make, VIN, registration — with nothing mistyped.",
    blurb: "Point at the disc, check the fields, done.",
    section: "inventory",
    steps: [
      { title: "Open Add Vehicle → Scan disc", detail: "The scanner opens your camera. Hold the disc steady inside the frame until it reads." },
      { title: "Check the extracted fields", detail: "Make, model, colour, VIN and registration are filled automatically — everything stays editable if the disc is worn or misread." },
      { title: "Continue as normal", detail: "Add price, mileage and shoot photos. Scanning only fills fields; nothing else about the flow changes." },
    ],
  },
];

export function guidesForSection(section: string): Guide[] {
  return GUIDES.filter((g) => g.section === section);
}

export function allGuides(): Guide[] {
  return GUIDES;
}
