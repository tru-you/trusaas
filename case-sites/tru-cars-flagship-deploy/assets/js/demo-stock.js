/* ============================================================
   TRUE-CARS SA — demonstration stock
   ------------------------------------------------------------
   This is a DEMO showroom, so invented stock is the correct choice —
   unlike a real dealer site, where painting cars that don't exist is how
   buyers end up WhatsApping about a car that was never on the floor.
   The distinction is that this yard does not exist and says so: the badge
   in the masthead reads "Demonstration showroom" and never claims live.

   Every car below is matched to a real cutout already in assets/img/cars/,
   priced to the 2026 South African used market, and carries the same
   field shapes the live TruFlow / TruLens feed emits — optionalExtras,
   virReport, truPrice, photoCount — so every feature on the page is
   exercising the real code path, not a special demo branch.

   Live stock on the `true-cars` slug OVERRIDES all of this when present
   (see the loader in index.html). This is the fallback, not the source.
   ============================================================ */
window.TC_DEMO_STOCK = (function () {
  var IMG = "assets/img/cars/";

  /* Extras use the canonical TruLens vocabulary character for character —
     the same 22-item checklist the capture app writes. Anything invented
     here would rank wrong the moment real stock arrives. */
  function car(o) {
    o.images = o.images || [IMG + o.art];
    o.photoCount = o.images.length;
    return o;
  }

  return [
    car({
      stockNumber: "TC-1041", year: 2023, make: "Toyota", model: "Hilux",
      trim: "2.8 GD-6 Legend 4x4", art: "hilux-legend-23-side.png",
      price: 689900, truPrice: 719900, mileage: 41250, bodyType: "Bakkie / Truck",
      transmission: "Automatic", fuelType: "Diesel", color: "Graphite Grey",
      category: "select",
      optionalExtras: ["Towbar", "Leather Seats", "Reverse Camera", "Navigation",
                       "Apple CarPlay / Android Auto", "AWD / 4WD", "Alloy Wheels"],
      virReport: [{ section: "Front Bumper", rating: "note", note: "Light stone chipping" },
                  { section: "Bonnet", rating: "ok" }, { section: "Roof", rating: "ok" },
                  { section: "Tailgate", rating: "ok" }, { section: "Wheels", rating: "ok" }],
      description: "One owner from new, full Toyota service history, and the canopy comes with it."
    }),
    car({
      stockNumber: "TC-1042", year: 2022, make: "Ford", model: "Ranger",
      trim: "2.0 BiTurbo Wildtrak 4x4", art: "ranger-wildtrak-22-side.png",
      price: 659900, truPrice: 689900, mileage: 63400, bodyType: "Bakkie / Truck",
      transmission: "Automatic", fuelType: "Diesel", color: "Sea Grey",
      category: "select",
      optionalExtras: ["Towbar", "Leather Seats", "Adaptive Cruise Control",
                       "Reverse Camera", "Roof Rails", "LED / Xenon Headlights"],
      virReport: [{ section: "Load Bin", rating: "note", note: "Liner scuffed — normal use" },
                  { section: "Front Bumper", rating: "ok" }, { section: "Doors", rating: "ok" },
                  { section: "Roof", rating: "ok" }],
      description: "Wildtrak with the load-bin liner and tow pack already fitted."
    }),
    car({
      stockNumber: "TC-1043", year: 2022, make: "Toyota", model: "Hilux",
      trim: "2.4 GD-6 SRX", art: "hilux-2831-22-side.png",
      price: 459900, truPrice: 474900, mileage: 88900, bodyType: "Bakkie / Truck",
      transmission: "Manual", fuelType: "Diesel", color: "White",
      optionalExtras: ["Towbar", "Bluetooth", "Alloy Wheels"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Doors", rating: "ok" },
                  { section: "Wheels", rating: "ok" }, { section: "Roof", rating: "ok" }],
      description: "Honest workhorse, service book stamped, ready to go on the farm run."
    }),
    car({
      stockNumber: "TC-1044", year: 2023, make: "Toyota", model: "Fortuner",
      trim: "2.8 GD-6 4x4 VX", art: "fortuner-23-side.png",
      price: 629900, truPrice: 659900, mileage: 52100, bodyType: "SUV",
      transmission: "Automatic", fuelType: "Diesel", color: "Attitude Black",
      category: "select",
      optionalExtras: ["Leather Seats", "Electric Seats", "Reverse Camera", "Navigation",
                       "AWD / 4WD", "Park Distance Control", "Tinted Windows"],
      virReport: [{ section: "Front Bumper", rating: "ok" }, { section: "Bonnet", rating: "ok" },
                  { section: "Tailgate", rating: "ok" }, { section: "Wheels", rating: "ok" },
                  { section: "Roof", rating: "ok" }, { section: "Doors", rating: "ok" }]
    }),
    car({
      stockNumber: "TC-1045", year: 2023, make: "Toyota", model: "Corolla Cross",
      trim: "1.8 Hybrid XR", art: "corolla-cross-23-side.png",
      price: 379900, truPrice: 394900, mileage: 34700, bodyType: "Crossover",
      transmission: "Automatic", fuelType: "Hybrid", color: "Silver",
      optionalExtras: ["Apple CarPlay / Android Auto", "Reverse Camera",
                       "Keyless Entry & Start", "Alloy Wheels", "Lane Assist"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Doors", rating: "ok" },
                  { section: "Roof", rating: "ok" }, { section: "Wheels", rating: "ok" }],
      description: "Hybrid, so the town running is nearly free. Still under factory warranty."
    }),
    car({
      stockNumber: "TC-1046", year: 2023, make: "Volkswagen", model: "Polo",
      trim: "1.0 TSI Life", art: "polo-tsi-23-side.png",
      price: 289900, truPrice: 299900, mileage: 29800, bodyType: "Hatchback",
      transmission: "Manual", fuelType: "Petrol", color: "Reef Blue",
      optionalExtras: ["Apple CarPlay / Android Auto", "Bluetooth",
                       "Park Distance Control", "Alloy Wheels"],
      virReport: [{ section: "Front Bumper", rating: "ok" }, { section: "Doors", rating: "ok" },
                  { section: "Roof", rating: "ok" }]
    }),
    car({
      stockNumber: "TC-1047", year: 2022, make: "Volkswagen", model: "Polo Vivo",
      trim: "1.4 Comfortline", art: "polo-vivo-22-side.png",
      price: 209900, truPrice: 214900, mileage: 61200, bodyType: "Hatchback",
      transmission: "Manual", fuelType: "Petrol", color: "Candy White",
      optionalExtras: ["Bluetooth", "Alloy Wheels"],
      /* Deliberately no virReport and no conditionLabel — this is the
         "Condition on request" state, and a demo that never shows it is
         hiding the honest half of the feature. */
      virReport: []
    }),
    car({
      stockNumber: "TC-1048", year: 2022, make: "Volkswagen", model: "Golf",
      trim: "2.0 TSI GTI", art: "golf-gti-22-side.png",
      price: 589900, truPrice: 619900, mileage: 47600, bodyType: "Hatchback",
      transmission: "Automatic", fuelType: "Petrol", color: "Kings Red",
      category: "performance",
      optionalExtras: ["Leather Seats", "Digital Cockpit", "Navigation",
                       "Adaptive Cruise Control", "LED / Xenon Headlights", "Alloy Wheels"],
      virReport: [{ section: "Front Bumper", rating: "note", note: "Kerb mark, front left splitter" },
                  { section: "Bonnet", rating: "ok" }, { section: "Wheels", rating: "note", note: "Light kerbing, front left" },
                  { section: "Roof", rating: "ok" }, { section: "Doors", rating: "ok" }],
      description: "GTI with the full digital cockpit. Two marks noted and photographed — nothing hidden."
    }),
    car({
      stockNumber: "TC-1049", year: 2023, make: "Volkswagen", model: "Golf",
      trim: "2.0 TSI R 4Motion", art: "golf-r-23-side.png",
      price: 799900, truPrice: 829900, mileage: 26400, bodyType: "Hatchback",
      transmission: "Automatic", fuelType: "Petrol", color: "Lapiz Blue",
      category: "performance",
      optionalExtras: ["Leather Seats", "Heated Seats", "Digital Cockpit", "Navigation",
                       "AWD / 4WD", "Adaptive Cruise Control", "Sunroof / Panoramic Roof"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Roof", rating: "ok" },
                  { section: "Wheels", rating: "ok" }, { section: "Doors", rating: "ok" },
                  { section: "Front Bumper", rating: "ok" }]
    }),
    car({
      stockNumber: "TC-1050", year: 2023, make: "BYD", model: "Atto 3",
      trim: "Extended Range", art: "byd-atto3-23-side.png",
      price: 649900, truPrice: 669900, mileage: 18900, bodyType: "Crossover",
      transmission: "Automatic", fuelType: "Electric", color: "Surf Blue",
      optionalExtras: ["Apple CarPlay / Android Auto", "360° Camera", "Electric Seats",
                       "Keyless Entry & Start", "Sunroof / Panoramic Roof", "Blind Spot Monitor"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Doors", rating: "ok" },
                  { section: "Roof", rating: "ok" }, { section: "Wheels", rating: "ok" }],
      description: "Still on the battery warranty. Charges to 80% in well under an hour."
    }),
    car({
      stockNumber: "TC-1051", year: 2024, make: "BYD", model: "Dolphin",
      trim: "Premium", art: "byd-dolphin-24-side.png",
      price: 539900, truPrice: 549900, mileage: 9400, bodyType: "Hatchback",
      transmission: "Automatic", fuelType: "Electric", color: "Coral Pink",
      optionalExtras: ["Apple CarPlay / Android Auto", "Reverse Camera",
                       "Keyless Entry & Start", "Alloy Wheels"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Doors", rating: "ok" },
                  { section: "Roof", rating: "ok" }]
    }),
    car({
      stockNumber: "TC-1052", year: 2024, make: "BYD", model: "Seal",
      trim: "Performance AWD", art: "byd-seal-24-side.png",
      price: 799900, truPrice: 819900, mileage: 12600, bodyType: "Sedan",
      transmission: "Automatic", fuelType: "Electric", color: "Arctic Blue",
      category: "performance",
      optionalExtras: ["Leather Seats", "Heated Seats", "360° Camera", "Navigation",
                       "AWD / 4WD", "Adaptive Cruise Control", "Sunroof / Panoramic Roof"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Roof", rating: "ok" },
                  { section: "Doors", rating: "ok" }, { section: "Wheels", rating: "ok" }]
    }),
    car({
      stockNumber: "TC-1053", year: 2022, make: "BMW", model: "M4",
      trim: "Competition xDrive", art: "m4-comp-22-side.png",
      price: 1649900, truPrice: 1699900, mileage: 31800, bodyType: "Coupe",
      transmission: "Automatic", fuelType: "Petrol", color: "Isle of Man Green",
      category: "performance",
      optionalExtras: ["Leather Seats", "Heated Seats", "Electric Seats", "Digital Cockpit",
                       "Navigation", "AWD / 4WD", "360° Camera", "LED / Xenon Headlights"],
      virReport: [{ section: "Front Bumper", rating: "ok" }, { section: "Bonnet", rating: "ok" },
                  { section: "Roof", rating: "ok" }, { section: "Wheels", rating: "ok" },
                  { section: "Doors", rating: "ok" }],
      description: "Full BMW Motorsport history, carbon bucket seats, never tracked."
    }),
    car({
      stockNumber: "TC-1054", year: 2021, make: "Porsche", model: "911",
      trim: "Carrera 3.0", art: "911-carrera-21-side.png",
      price: 2149900, truPrice: 2199900, mileage: 24500, bodyType: "Coupe",
      transmission: "Automatic", fuelType: "Petrol", color: "GT Silver",
      category: "performance",
      optionalExtras: ["Leather Seats", "Heated Seats", "Electric Seats", "Navigation",
                       "Park Distance Control", "Sunroof / Panoramic Roof"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Roof", rating: "ok" },
                  { section: "Doors", rating: "ok" }, { section: "Wheels", rating: "ok" },
                  { section: "Front Bumper", rating: "ok" }]
    }),
    car({
      stockNumber: "TC-1055", year: 2022, make: "Mercedes-Benz", model: "G-Class",
      trim: "G 400 d AMG Line", art: "gwagen-22-side.png",
      price: 3299900, truPrice: 3349900, mileage: 28700, bodyType: "SUV",
      transmission: "Automatic", fuelType: "Diesel", color: "Obsidian Black",
      category: "select",
      optionalExtras: ["Leather Seats", "Heated Seats", "Electric Seats", "360° Camera",
                       "Navigation", "AWD / 4WD", "Sunroof / Panoramic Roof", "Towbar"],
      virReport: [{ section: "Bonnet", rating: "ok" }, { section: "Roof", rating: "ok" },
                  { section: "Doors", rating: "ok" }, { section: "Wheels", rating: "ok" }]
    }),
    car({
      stockNumber: "TC-1056", year: 2022, make: "Land Rover", model: "Range Rover Sport",
      trim: "D300 HSE Dynamic", art: "rangerover-sport-22-side.png",
      price: 1899900, truPrice: 1949900, mileage: 44300, bodyType: "SUV",
      transmission: "Automatic", fuelType: "Diesel", color: "Santorini Black",
      category: "select",
      optionalExtras: ["Leather Seats", "Heated Seats", "Electric Seats", "360° Camera",
                       "Navigation", "AWD / 4WD", "Adaptive Cruise Control", "Roof Rails"],
      virReport: [{ section: "Front Bumper", rating: "note", note: "Sensor surround resprayed" },
                  { section: "Bonnet", rating: "ok" }, { section: "Roof", rating: "ok" },
                  { section: "Wheels", rating: "ok" }, { section: "Doors", rating: "ok" }]
    })
  ];
})();
