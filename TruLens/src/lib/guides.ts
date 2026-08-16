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
    title: "Review the damage report",
    goal: "Understand the AI damage flags on your photos and confirm or dismiss them.",
    blurb: "AI flags, confirm or dismiss, update the vehicle record.",
    section: "damage",
    steps: [
      { title: "Open damage view", detail: "From the camera guide, tap the damage icon. Any AI-detected issues are highlighted on the photo." },
      { title: "Review each flag", detail: "Each flag shows what the AI detected — scratches, dents, chips. Tap a flag to see the detail." },
      { title: "Confirm or dismiss", detail: "If the flag is real, confirm it. If it is a false positive (shadow, reflection), dismiss it." },
      { title: "Check the vehicle record", detail: "Confirmed damage is saved to the vehicle and appears in reports. Dismissed flags are hidden." },
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
];

export function guidesForSection(section: string): Guide[] {
  return GUIDES.filter((g) => g.section === section);
}

export function allGuides(): Guide[] {
  return GUIDES;
}
