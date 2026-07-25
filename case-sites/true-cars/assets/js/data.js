/* ============================================================
   TRUECAR SA — Inventory Data Model
   Powers home, inventory, vehicle detail, finance, chatbot.
   Prices in ZAR. "truecarPrice" = market-fair benchmark (transparency DNA).
   Stock sourced from Getworth, Milnerton, Cape Town.
   ============================================================ */
window.TCSA = window.TCSA || {};

TCSA.brandPhone = "+27620502091";
TCSA.brandPhoneDisplay = "+27 62 050 2091";

/* Body-type SVG silhouettes used as fallback placeholders */
TCSA.silhouette = function(kind){
  const c = {suv:'M18 62 L18 50 Q18 44 26 42 L44 36 Q52 30 66 30 L104 30 Q120 30 130 42 L150 44 Q168 46 172 54 L172 62',
    bakkie:'M12 62 L12 48 Q12 44 20 44 L60 44 Q66 34 82 34 L104 34 Q112 34 116 44 L176 44 L182 50 L182 62',
    hatch:'M20 62 L20 50 Q22 44 34 42 L54 34 Q64 28 82 28 L112 28 Q132 30 142 42 L162 46 Q172 48 172 56 L172 62',
    sedan:'M14 62 L16 50 Q18 44 32 42 L56 32 Q68 26 92 26 L124 26 Q144 28 156 42 L176 48 Q182 50 182 56 L182 62',
    coupe:'M16 62 L18 52 Q22 44 38 42 L64 30 Q80 24 104 26 L140 28 Q162 32 172 46 L180 52 L180 62'};
  return `<svg viewBox="0 0 196 78" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:62%;opacity:.20">
    <path d="${c[kind]||c.sedan}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="58" cy="62" r="11" stroke="currentColor" stroke-width="2.4"/>
    <circle cx="140" cy="62" r="11" stroke="currentColor" stroke-width="2.4"/>
  </svg>`;
};

TCSA.vehicles = [
  /* -------- GETWORTH MILNERTON STOCK -------- */

  { id:'jeep-grandcherokee-23', make:'Jeep', model:'Grand Cherokee', variant:'3.6 4x4 Overland', year:2023,
    price:819900, truecarPrice:869000, km:36100, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'210 kW', drive:'4x4', colour:'Granite Crystal', location:'Milnerton, Cape Town',
    badges:[{t:'True-Cars Deal',c:'hot'},{t:'Great Price',c:'good'}], vir:96, lvs:true, premium:false,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'Full-size American luxury SUV with 3.6 Pentastar V6. Overland spec with air suspension and panoramic roof.', certUsed:true },

  { id:'audi-q3-sportback-23', make:'Audi', model:'Q3 Sportback', variant:'35TFSI S Line', year:2023,
    price:539900, truecarPrice:572000, km:61100, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'110 kW', drive:'FWD', colour:'Mythos Black', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:94, lvs:true, premium:false,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'Sleek coupe-SUV with S Line body kit, virtual cockpit and Matrix LED headlights.', certUsed:true },

  { id:'toyota-fortuner-28-20', make:'Toyota', model:'Fortuner', variant:'2.8GD-6 4x4 Auto', year:2020,
    price:464900, truecarPrice:489000, km:159000, fuel:'Diesel', trans:'Automatic', body:'suv',
    power:'150 kW', drive:'4x4', colour:'Attitude Black', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:91, lvs:true, premium:false,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'The go-anywhere 7-seater. High mileage but priced right — diesel longevity on full display.', certUsed:true },

  { id:'kia-seltos-25', make:'Kia', model:'Seltos', variant:'1.5CRDi LX', year:2025,
    price:409900, truecarPrice:429000, km:2400, fuel:'Diesel', trans:'Automatic', body:'suv',
    power:'85 kW', drive:'FWD', colour:'Aurora Black', location:'Milnerton, Cape Town',
    badges:[{t:'Near New',c:'hot'},{t:'Great Price',c:'good'}], vir:97, lvs:true, premium:false,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'Virtually brand-new diesel crossover with 2,400 km on the clock. Full balance of plan.', certUsed:true },

  { id:'toyota-corollacross-gr-23a', make:'Toyota', model:'Corolla Cross', variant:'1.8 GR-Sport', year:2023,
    price:396899, truecarPrice:419000, km:28500, fuel:'Hybrid', trans:'Automatic', body:'suv',
    power:'90 kW', drive:'FWD', colour:'Platinum White', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:93, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:true,
    blurb:'GR-Sport with sporty bodykit and twin-motor hybrid efficiency. Well under market.', certUsed:true },

  { id:'toyota-corollacross-gr-23b', make:'Toyota', model:'Corolla Cross', variant:'1.8 GR-Sport', year:2023,
    price:399900, truecarPrice:419000, km:22000, fuel:'Hybrid', trans:'Automatic', body:'suv',
    power:'90 kW', drive:'FWD', colour:'Emotional Red', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:94, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Lower-km GR-Sport sister car. Both are below market — choose your colour.', certUsed:true },

  { id:'toyota-rav4-19', make:'Toyota', model:'RAV4', variant:'2.0 GX Auto', year:2019,
    price:304899, truecarPrice:319000, km:117700, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'107 kW', drive:'FWD', colour:'Silver Metallic', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:89, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Proven Rav4 GX at an honest price. Smooth CVT, good service history.', certUsed:true },

  { id:'kia-sonet-lx-24', make:'Kia', model:'Sonet', variant:'1.5 LX Auto', year:2024,
    price:299900, truecarPrice:315000, km:21500, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'85 kW', drive:'FWD', colour:'Glacier White', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:93, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Compact crossover with big-car features. Auto box, reverse camera, Apple CarPlay.', certUsed:true },

  { id:'hyundai-venue-24', make:'Hyundai', model:'Venue', variant:'1.0T Fluid Manual', year:2024,
    price:279900, truecarPrice:295000, km:22600, fuel:'Petrol', trans:'Manual', body:'suv',
    power:'88 kW', drive:'FWD', colour:'Typhoon Silver', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:92, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'2024 turbo Venue — a sharp little crossover with more kit than cars twice its size.', certUsed:true },

  { id:'ford-puma-23', make:'Ford', model:'PUMA', variant:'1.0T ST-Line Vignale', year:2023,
    price:349900, truecarPrice:369000, km:25733, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'92 kW', drive:'FWD', colour:'Frozen White', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:94, lvs:true, premium:false,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'EcoBoost crossover with B&O sound, heated seats, and the MegaBox under-boot. Vignale top spec.', certUsed:true },

  { id:'mazda-cx5-22', make:'Mazda', model:'CX-5', variant:'2.0 Active Auto', year:2022,
    price:329900, truecarPrice:348000, km:79712, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'121 kW', drive:'FWD', colour:'Soul Red Crystal', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:91, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Mazda\'s premium crossover with head-up display and G-Vectoring Control Plus.', certUsed:true },

  { id:'chery-tiggo7pro-24', make:'Chery', model:'Tiggo 7 Pro', variant:'1.5T Executive', year:2024,
    price:319900, truecarPrice:335000, km:42737, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'108 kW', drive:'FWD', colour:'Ivory White', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:90, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Executive spec Tiggo with 12.3" dual screen, 360° camera and panoramic sunroof.', certUsed:true },

  { id:'kia-sonet-ls-26', make:'Kia', model:'Sonet', variant:'1.5 LS Manual', year:2026,
    price:264900, truecarPrice:279000, km:13800, fuel:'Petrol', trans:'Manual', body:'suv',
    power:'85 kW', drive:'FWD', colour:'Sparkling Silver', location:'Milnerton, Cape Town',
    badges:[{t:'Near New',c:'hot'},{t:'Great Price',c:'good'}], vir:96, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'2026 model year with just 13,800 km. Still under factory warranty. Manual for running costs.', certUsed:true },

  { id:'hyundai-exter-25', make:'Hyundai', model:'Exter', variant:'1.2 Premium Auto', year:2025,
    price:239900, truecarPrice:252000, km:18331, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'61 kW', drive:'FWD', colour:'Ranger Khaki', location:'Milnerton, Cape Town',
    badges:[{t:'Near New',c:'hot'}], vir:94, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Hyundai\'s micro-SUV with a big personality. 2025 Premium auto with sunroof and connected car tech.', certUsed:true },

  { id:'vw-polovivo-22', make:'Volkswagen', model:'Polo Vivo', variant:'1.6 Comfortline Auto', year:2022,
    price:229900, truecarPrice:242000, km:21419, fuel:'Petrol', trans:'Automatic', body:'hatch',
    power:'66 kW', drive:'FWD', colour:'Deep Black Pearl',  location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:90, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Comfortline Auto with low mileage. The sensible, re-sellable South African staple.', certUsed:true },

  { id:'mini-hatch-18', make:'MINI', model:'Hatch', variant:'Cooper Hatch 5-Door Auto', year:2018,
    price:229900, truecarPrice:245000, km:79404, fuel:'Petrol', trans:'Automatic', body:'hatch',
    power:'100 kW', drive:'FWD', colour:'Midnight Black', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:88, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'5-door Cooper with auto box — all the fun, doubled the practicality. Well-priced fun car.', certUsed:true },

  { id:'ford-ecosport-22', make:'Ford', model:'EcoSport', variant:'1.0T Trend Manual', year:2022,
    price:209900, truecarPrice:221000, km:39600, fuel:'Petrol', trans:'Manual', body:'suv',
    power:'92 kW', drive:'FWD', colour:'Lightning Blue', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:88, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Punchy EcoBoost Trend with reverse camera and SYNC3 infotainment. Low running costs.', certUsed:true },

  { id:'ford-figo-19', make:'Ford', model:'Figo', variant:'1.5 Titanium Hatch', year:2019,
    price:169900, truecarPrice:179000, km:48655, fuel:'Petrol', trans:'Manual', body:'hatch',
    power:'88 kW', drive:'FWD', colour:'Smoke Grey', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:86, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Titanium top-spec Figo with cruise, reverse camera and Ford SYNC. A first-car or commuter bargain.', certUsed:true },

  { id:'ford-ecosport-18', make:'Ford', model:'EcoSport', variant:'1.5TDCi Titanium Manual', year:2018,
    price:164900, truecarPrice:174000, km:137300, fuel:'Diesel', trans:'Manual', body:'suv',
    power:'70 kW', drive:'FWD', colour:'Moondust Silver', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:84, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Diesel EcoSport — sips fuel at the coast and lasts forever. Titanium spec at a budget price.', certUsed:true },

  { id:'renault-sandero-19', make:'Renault', model:'Sandero Stepway', variant:'66kW Turbo Expression', year:2019,
    price:139900, truecarPrice:149000, km:71200, fuel:'Petrol', trans:'Manual', body:'hatch',
    power:'66 kW', drive:'FWD', colour:'Orange Flair', location:'Milnerton, Cape Town',
    badges:[{t:'Great Price',c:'good'}], vir:85, lvs:false, premium:false,
    tags:['Tru3D','VIR'], featured:false,
    blurb:'Raised Stepway with turbo punch and all-road looks. The best-value entry on the lot.', certUsed:true },

  /* -------- TRUE PREMIUM — We Buy Supercars, Sandton -------- */

  { id:'rrcullinan-19', make:'Rolls-Royce', model:'Cullinan', variant:'6.7 V12', year:2019,
    price:18499999, truecarPrice:19200000, km:10525, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'420 kW', drive:'AWD', colour:'Black Diamond', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:98, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'The pinnacle of luxury SUV. 10,525 km from new. Spirit of Ecstasy, starlight headliner, bespoke interior.' },

  { id:'ferrari-purosangue-26', make:'Ferrari', model:'Purosangue', variant:'V12 AWD', year:2026,
    price:15499999, truecarPrice:16200000, km:300, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'533 kW', drive:'AWD', colour:'Rosso Corsa', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'},{t:'Demo',c:'hot'}], vir:99, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'Ferrari\'s first SUV. 300 km on the clock — effectively new. 6.5L NA V12, 533 kW. Collector item.' },

  { id:'rrwraith-blackbadge-17', make:'Rolls-Royce', model:'Wraith', variant:'Black Badge', year:2017,
    price:8299999, truecarPrice:8600000, km:21600, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'465 kW', drive:'RWD', colour:'Black', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:96, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'The dark side of Rolls-Royce. Black Badge V12 coupé with starlight ceiling and bespoke interior. 21,600 km.' },

  { id:'lambo-urus-s-22', make:'Lamborghini', model:'Urus S', variant:'4.0 V8 AWD', year:2022,
    price:6599999, truecarPrice:6900000, km:35000, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'478 kW', drive:'AWD', colour:'Grigio Lynx', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:96, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'The world\'s fastest SUV. Twin-turbo 4.0 V8, 478 kW, 0–100 in 3.5s. Sport Exhaust, Carbon Pack.' },

  { id:'gwagen-g63-26a', make:'Mercedes-AMG', model:'G 63', variant:'4.0 V8 BiTurbo', year:2026,
    price:5249999, truecarPrice:5500000, km:140, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'430 kW', drive:'AWD', colour:'Obsidian Black', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'},{t:'Near New',c:'hot'}], vir:99, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'140 km from new. 2026 G63 with Manufaktur exterior, Night Package and AMG Performance seats.' },

  { id:'gwagen-g63-26b', make:'Mercedes-AMG', model:'G 63', variant:'4.0 V8 BiTurbo', year:2026,
    price:5199999, truecarPrice:5500000, km:50, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'430 kW', drive:'AWD', colour:'Designo Selenite Grey', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'},{t:'Near New',c:'hot'}], vir:99, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'50 km from delivery. Selenite Grey Manufaktur with Burmester surround sound and carbon trim.' },

  { id:'gwagen-g63-19', make:'Mercedes-AMG', model:'G 63', variant:'4.0 V8 BiTurbo', year:2019,
    price:3499999, truecarPrice:3700000, km:18000, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'430 kW', drive:'AWD', colour:'Polar White', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:97, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'Low-km 2019 G63 in Polar White. AMG Night Package, panoramic roof. Service history from Mercedes-Benz.' },

  { id:'rangerover-d350-23', make:'Land Rover', model:'Range Rover', variant:'D350 HSE', year:2023,
    price:3499999, truecarPrice:3650000, km:53000, fuel:'Diesel', trans:'Automatic', body:'suv',
    power:'258 kW', drive:'AWD', colour:'Santorini Black', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:94, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'Fifth-gen Range Rover HSE. Air suspension, SV-grade interior, 23" alloys, meridian sound. Diesel mile-muncher.' },

  { id:'astonmartin-db11-18', make:'Aston Martin', model:'DB11', variant:'V12 Coupe', year:2018,
    price:2799999, truecarPrice:2950000, km:14800, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'447 kW', drive:'RWD', colour:'Skyfall Silver', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:96, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'V12-engined grand tourer with 14,800 km. The most beautiful Aston of the modern era.' },

  { id:'maybach-gls600-22', make:'Mercedes-Maybach', model:'GLS 600', variant:'4MATIC', year:2022,
    price:2999999, truecarPrice:3150000, km:33350, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'410 kW', drive:'AWD', colour:'Selenite Grey', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:96, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'The Maybach SUV. E-Active Body Control, Nappa leather, rear executive seats, Burmester 4D.' },

  { id:'porsche-911-cab-20', make:'Porsche', model:'911 Carrera S', variant:'992 Cabriolet PDK', year:2020,
    price:2299999, truecarPrice:2450000, km:51400, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'331 kW', drive:'RWD', colour:'GT Silver', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:94, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'992 Carrera S Cabriolet with Sport Chrono, PASM and Bose. Open-air 992 at a compelling price.' },

  { id:'bmw-m4-comp-23', make:'BMW', model:'M4 Competition', variant:'xDrive Coupe', year:2023,
    price:1649999, truecarPrice:1750000, km:32000, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'375 kW', drive:'AWD', colour:'Toronto Red', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:95, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'xDrive Competition with carbon bucket seats, M Driver\'s Pack and adaptive M suspension.' },

  { id:'bmw-m5-comp-24', make:'BMW', model:'M5 Competition', variant:'xDrive', year:2024,
    price:1829999, truecarPrice:1950000, km:57700, fuel:'Petrol', trans:'Automatic', body:'sedan',
    power:'460 kW', drive:'AWD', colour:'Frozen Black', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:94, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'600 hp super-saloon. Frozen Black Metallic with M Carbon ceramic brakes and Bowers & Wilkins.' },

  { id:'bentley-continental-gt-15', make:'Bentley', model:'Continental GT', variant:'V8 Coupe', year:2015,
    price:1599999, truecarPrice:1700000, km:83000, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'373 kW', drive:'AWD', colour:'Pale Brodgar', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:91, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'Twin-turbo V8 Bentley GT with Naim audio and Mulliner driving spec. Entry into handcrafted British luxury.' },

  { id:'mercedesbenz-s500-coupe-16', make:'Mercedes-Benz', model:'S 500 Coupé', variant:'AMG Line', year:2016,
    price:1199999, truecarPrice:1280000, km:78100, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'335 kW', drive:'RWD', colour:'Obsidian Black', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:90, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'The W222 S-Class Coupé — arguably the most elegant car of its era. AMG Line, Burmester, Magic Body Control.' },

  { id:'bmw-8series-m850i-24', make:'BMW', model:'8 Series', variant:'M850i xDrive Gran Coupé', year:2024,
    price:1489999, truecarPrice:1600000, km:28000, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'390 kW', drive:'AWD', colour:'Dravit Grey', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:95, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'4-door gran coupé with 530 hp V8. Laser headlights, B&W Diamond surround, carbon fibre trim.' },

  { id:'porsche-cayenne-s-19', make:'Porsche', model:'Cayenne S', variant:'2.9 V6 Turbo PDK', year:2019,
    price:999999, truecarPrice:1060000, km:93500, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'324 kW', drive:'AWD', colour:'Carrara White', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:89, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'Twin-turbo Cayenne S with PDCC, air suspension and panoramic roof. Porsche-approved service history.' },

  { id:'bmw-m3-comp-23', make:'BMW', model:'M3 Competition', variant:'xDrive Sedan', year:2023,
    price:1799990, truecarPrice:1870000, km:20000, fuel:'Petrol', trans:'Automatic', body:'sedan',
    power:'375 kW', drive:'AWD', colour:'Alpine White', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'},{t:'Great Price',c:'good'}], vir:96, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'The four-door M. S58 straight-six, 375 kW, xDrive traction in every condition. M Carbon seats and M Driver\'s Pack.' },

  { id:'amg-glc63s-19', make:'Mercedes-AMG', model:'GLC 63 S', variant:'4Matic+ AMG', year:2019,
    price:1099999, truecarPrice:1165000, km:30600, fuel:'Petrol', trans:'Automatic', body:'suv',
    power:'375 kW', drive:'AWD', colour:'Obsidian Black', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'},{t:'Great Price',c:'good'}], vir:93, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'4.0L V8 BiTurbo compact SUV. 375 kW, 700 Nm, 0–100 in 3.8s. AMG Ride Control+, ceramic brakes.' },

  { id:'audi-rs5-coupe-23', make:'Audi', model:'RS5', variant:'Coupé Quattro', year:2023,
    price:1295000, truecarPrice:1360000, km:36000, fuel:'Petrol', trans:'Automatic', body:'coupe',
    power:'331 kW', drive:'AWD', colour:'Nardo Grey', location:'Wynberg, Sandton',
    badges:[{t:'Premium Select',c:'gold'}], vir:94, lvs:true, premium:true, tags:['Tru3D','VIR','LVS'], featured:false,
    blurb:'2.9 TFSI BiTurbo coupé with quattro grip, RS sport suspension, virtual cockpit and B&O audio.' },

  { id:'byd-atto3-24', make:'BYD', model:'Atto 3', variant:'Extended Range', year:2024,
    price:564900, truecarPrice:595000, km:12200, fuel:'Electric', trans:'Automatic', body:'suv',
    power:'150 kW', drive:'FWD', colour:'Surf Blue', location:'Milnerton, Cape Town',
    badges:[{t:'Electric',c:'hot'},{t:'Great Price',c:'good'}], vir:96, lvs:true, premium:false,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'Ultra-modern electric SUV with BYD Blade Battery technology and a rotating touchscreen. R0 delivery nationwide.', certUsed:true },

  { id:'volvo-xc40-recharge-23', make:'Volvo', model:'XC40 Recharge', variant:'Single Motor Plus', year:2023,
    price:849900, truecarPrice:899000, km:18000, fuel:'Electric', trans:'Automatic', body:'suv',
    power:'170 kW', drive:'RWD', colour:'Crystal White', location:'Milnerton, Cape Town',
    badges:[{t:'Electric',c:'hot'},{t:'Premium Select',c:'gold'}], vir:95, lvs:true, premium:false,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'Premium Swedish electric luxury crossover with leather-free interior, Google built-in and clean battery range.', certUsed:true },

  { id:'byd-seal-25', make:'BYD', model:'Seal', variant:'AWD Design', year:2025,
    price:799900, truecarPrice:850000, km:3200, fuel:'Electric', trans:'Automatic', body:'sedan',
    power:'390 kW', drive:'AWD', colour:'Aurora Green', location:'Wynberg, Sandton',
    badges:[{t:'Electric',c:'hot'},{t:'Demo',c:'good'}], vir:98, lvs:true, premium:true,
    tags:['Tru3D','VIR','LVS'], featured:true,
    blurb:'High-performance electric saloon with cell-to-body technology and dual-motor AWD. 0-100 in 3.8 seconds.', certUsed:true },

];

/* AutoTrader photo galleries — GetWorth stock, Milnerton & Sandton */
const AT_GALLERY = {
  'jeep-grandcherokee-23':      ['48203127','48203128','48203129','48203130','48203131'],
  'audi-q3-sportback-23':       ['48236475','48236478','48236481','48236482','48236483'],
  'toyota-fortuner-28-20':      ['48099945','48099946','48099947','48099948','48099949'],
  'kia-seltos-25':              ['48307228','48307229','48307230','48307231','48307232'],
  'toyota-corollacross-gr-23a': ['48082561','48082562','48082563','48082564','48082565'],
  'toyota-corollacross-gr-23b': ['48082566','48082567','48082568','48082569','48082570'],
  'toyota-rav4-19':             ['48600696','48600697','48600698','48600699','48600700'],
  'kia-sonet-lx-24':            ['48490800','48490803','48490805','48490807','48490809'],
  'hyundai-venue-24':           ['48165851','48165852','48165853','48165854','48165855'],
  'ford-puma-23':               ['48634916','48634917','48634918','48634919','48634925'],
  'mazda-cx5-22':               ['48441648','48441649','48441650','48441651','48441652'],
  'chery-tiggo7pro-24':         ['48529191','48529192','48529193','48529194','48529196'],
  'kia-sonet-ls-26':            ['48529176','48529177','48529178','48529179','48529180'],
  'hyundai-exter-25':           ['48490785','48490787','48490789','48490792','48490795'],
  'vw-polovivo-22':             ['48602407','48602410','48602414','48602417','48602420'],
  'mini-hatch-18':              ['48490773','48490774','48490775','48490777','48490780'],
  'ford-ecosport-22':           ['48267156','48267157','48267158','48267159','48267160'],
  'ford-figo-19':               ['48399688','48399691','48399694','48399698','48399700'],
  'ford-ecosport-18':           ['48236415','48236416','48236417','48236418','48236419'],
  'renault-sandero-19':         ['48333478','48333479','48333480','48333481','48333482'],
  /* TRUE PREMIUM — We Buy Supercars, Sandton */
  'rrcullinan-19':              ['48164714','48164753','48164713','48164752','48164744'],
  'ferrari-purosangue-26':      ['48146427','48146416','48146405','48146345','48146442'],
  'rrwraith-blackbadge-17':     ['48163993','48163995','48164003','48164005','48163996'],
  'lambo-urus-s-22':            ['48278826','48278830','48278842','48278855','48278851'],
  'gwagen-g63-26a':             ['48395043','48395047','48395032','48395035','48395005'],
  'gwagen-g63-26b':             ['48191302','48191268','48191214','48191238','48191285'],
  'gwagen-g63-19':              ['48172826','48145657','48145506','48146351','48146271'],
  'rangerover-d350-23':         ['48199393','48199388','48199385','48199406','48199418'],
  'astonmartin-db11-18':        ['48191744','48191621','48191757','48191715','48191693'],
  'maybach-gls600-22':          ['48486817','48486820','48486762','48486814','48486804'],
  'porsche-911-cab-20':         ['48487241','48487244','48487242','48487238','48487062'],
  'bmw-m4-comp-23':             ['48176360','48176342','48176350','48176377','48176392'],
  'bmw-m5-comp-24':             ['48276652','48276647','48276639','48276646','48276641'],
  'bentley-continental-gt-15':  ['48225414','48225385','48225329','48225420','48225373'],
  'mercedesbenz-s500-coupe-16': ['48164208','48164223','48164207','48164206','48164224'],
  'bmw-8series-m850i-24':       ['48178242','48178262','48178258','48178186','48178252'],
  'porsche-cayenne-s-19':       ['48197016','48196985','48197053','48196994','48197040'],
  'bmw-m3-comp-23':             ['48081688','48081689','48081690','48081691','48081692'],
  'amg-glc63s-19':              ['48624832','48624793','48624823','48624862','48624883'],
  'audi-rs5-coupe-23':          ['47646383','47646384','47646385','47646386','47646387'],
  'byd-atto3-24':               [],
  'volvo-xc40-recharge-23':     [],
  'byd-seal-25':                [],
};
const AT_BASE = 'https://img.autotrader.co.za/';
TCSA.vehicles.forEach(function(v){
  var ids = AT_GALLERY[v.id] || [];
  // Grid thumbnails render at ~400px wide, so a 960x540 source was ~4x more
  // pixels than any card could show. The gallery and 3D viewer keep full size.
  v.img     = ids.length ? AT_BASE + ids[0] + '/Fit960x540' : null;
  v.thumb   = ids.length ? AT_BASE + ids[0] + '/Fit480x270' : null;
  v.gallery = ids.map(function(id){ return AT_BASE + id + '/Fit960x540'; });
});

const FALLBACK_IMG = {
  'byd-atto3-24':             'assets/img/fallback/generic-suv.jpg',
  'volvo-xc40-recharge-23':   'assets/img/fallback/generic-suv.jpg',
  'byd-seal-25':              'assets/img/fallback/generic-sedan.jpg'
};
TCSA.vehicles.forEach(function(v){
  if(FALLBACK_IMG[v.id]){
    if(!v.img) v.img = FALLBACK_IMG[v.id];
    if(!v.gallery.length) v.gallery = [FALLBACK_IMG[v.id]];
  }
});

/* ---------------- Formatting helpers ---------------- */
TCSA.fmtPrice = function(n){ return 'R' + n.toLocaleString('en-ZA'); };
TCSA.monthly = function(price, opts){
  opts = opts || {};
  const deposit = opts.deposit != null ? opts.deposit : price*0.10;
  const term = opts.term || 72;
  const rate = (opts.rate != null ? opts.rate : 11.75)/100/12;
  const balloon = (opts.balloon || 0)/100 * price;
  const principal = price - deposit;
  const pv = principal - balloon/Math.pow(1+rate,term);
  const m = pv * rate / (1 - Math.pow(1+rate,-term));
  return Math.round(m + balloon*rate);
};
TCSA.priceDelta = function(v){
  const d = v.truecarPrice - v.price; // positive = below market = good
  const pct = Math.round(Math.abs(d)/v.truecarPrice*100);
  return { below: d>=0, amount:Math.abs(d), pct };
};

/* ---------------- Vehicle card renderer (shared) ---------------- */
TCSA.vcard = function(v){
  const m = TCSA.monthly(v.price);
  const delta = TCSA.priceDelta(v);
  const badges = (v.badges||[]).map(b=>`<span class="vbadge ${b.c}">${b.t}</span>`).join('');
  const lvsTag = v.lvs ? `<span class="vtag lvs" title="Live Video Stream available"><span class="dot"></span><b>LVS</b></span>` : '';
  const truecar = delta.below
    ? `<span class="truecar-tag win"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg><b>${TCSA.fmtPrice(delta.amount)}</b> below TruPrice</span>`
    : `<span class="truecar-tag" style="color:var(--grey-dark);background:var(--bone);border-color:var(--line)">Fair TruPrice</span>`;
  const img = v.img
    ? `<img src="${v.thumb || v.img}" srcset="${v.thumb ? v.thumb + ' 480w, ' + v.img + ' 960w' : ''}" sizes="(max-width:760px) 92vw, 400px" alt="${v.year} ${v.make} ${v.model}" loading="lazy" decoding="async" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="vcard-fallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;color:#fff">${TCSA.silhouette(v.body)}</div>`
    : `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff">${TCSA.silhouette(v.body)}</div>`;
  const virRing = v.vir
    ? `<span class="vir-ring" title="TruVIR condition score — AI graded">
        <svg viewBox="0 0 36 36"><circle class="tr" cx="18" cy="18" r="15.5" pathLength="100"/><circle class="fg" cx="18" cy="18" r="15.5" pathLength="100" style="--vir:${v.vir}"/></svg>
        <b>${v.vir}</b><i>VIR</i>
      </span>`
    : '';
  return `<article class="vcard" data-id="${v.id}">
    <a class="vcard-media" href="vehicle.html?id=${v.id}">
      ${img}
      <div class="vcard-badges">${badges}</div>
      ${virRing}
      <div class="vcard-tags">
        ${lvsTag}
        <span class="vtag" title="Tru3D orbit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a9 9 0 100 18M3 12h4m10 0h4"/></svg><b>Tru3D</b></span>
      </div>
    </a>
    <div class="vcard-body">
      <a href="vehicle.html?id=${v.id}"><div class="vcard-title">${v.year} ${v.make} ${v.model}</div></a>
      <div class="vcard-variant">${v.variant} · ${v.colour}</div>
      <div class="vcard-price">${TCSA.fmtPrice(v.price)}<span class="pm">or ~${TCSA.fmtPrice(m)}/mo · ${v.location}</span></div>
      ${truecar}
      <div class="vcard-meta">
        <div class="m"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/><circle cx="12" cy="12" r="4"/></svg><span>${v.km.toLocaleString('en-ZA')} km</span></div>
        <div class="m"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l4-7h10l4 7M6 17h.01M18 17h.01"/></svg><span>${v.fuel}</span></div>
        <div class="m"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg><span>${v.trans==='Automatic'?'Auto':'Manual'}</span></div>
      </div>
      <div class="vcard-actions">
        <a class="btn btn-dark btn-sm" href="vehicle.html?id=${v.id}"><span>View &amp; Tru3D</span></a>
        <a class="btn btn-wa" href="https://wa.me/${TCSA.brandPhone.replace('+','')}?text=${encodeURIComponent('Hi True-Cars SA, I\'m interested in the '+v.year+' '+v.make+' '+v.model+' ('+TCSA.fmtPrice(v.price)+') — '+v.id)}" aria-label="WhatsApp" style="padding:0">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.1-.2.2-.3.2-.6.1-1.5-.8-2.6-1.4-3.6-3.1-.3-.5.3-.5.7-1.5.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3 1.8.8 2.5.8 3.4.7.5-.1 1.7-.7 1.9-1.4.2-.6.2-1.2.2-1.3-.1-.2-.3-.2-.6-.3z"/></svg>
        </a>
      </div>
    </div>
  </article>`;
};

TCSA.byId = function(id){ return TCSA.vehicles.find(v=>v.id===id); };
