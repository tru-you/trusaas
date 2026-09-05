/*  Cape Auto Collection — MID tier demo stock
    Mainstream family / lifestyle pre-owned. Real SA models, Aug-2026 pricing.
    Defines global MOCK_STOCK consumed by index.html. */

const MOCK_STOCK = [
  { id:"cac-001", make:"Hyundai", model:"Creta", variant:"1.5 Executive", year:2023, mileage:31500, price:419900, body:"SUV", color:"Phantom Black", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=640&q=80", specs:["1.5L","85kW","IVT Auto"], truPrice:428000, virScore:95 },
  { id:"cac-002", make:"Volkswagen", model:"T-Cross", variant:"1.0 TSI Comfortline", year:2022, mileage:44100, price:359900, body:"SUV", color:"Makena Turquoise", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=640&q=80", specs:["1.0T","85kW","7-Speed DSG"], truPrice:368000, virScore:93 },
  { id:"cac-003", make:"Toyota", model:"Corolla Cross", variant:"1.8 XS", year:2023, mileage:38900, price:429900, body:"SUV", color:"Glacier White", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=640&q=80", specs:["1.8L","103kW","CVT"], truPrice:439000, virScore:96 },
  { id:"cac-004", make:"Toyota", model:"Hilux", variant:"2.4 GD-6 Raider", year:2021, mileage:78400, price:489900, body:"Bakkie", color:"Attitude Black", transmission:"Manual", fuel:"Diesel",
    img:"https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=640&q=80", specs:["2.4L Diesel","110kW","6-Speed"], truPrice:499000, virScore:90 },
  { id:"cac-005", make:"Ford", model:"Ranger", variant:"2.0 SiT XLT D/Cab", year:2022, mileage:64200, price:559900, body:"Bakkie", color:"Meteor Grey", transmission:"Automatic", fuel:"Diesel",
    img:"https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=640&q=80", specs:["2.0L Bi-Turbo","125kW","10-Speed"], truPrice:572000, virScore:92 },
  { id:"cac-006", make:"Volkswagen", model:"Golf", variant:"1.4 TSI Comfortline", year:2019, mileage:96700, price:319900, body:"Hatchback", color:"Tornado Red", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80", specs:["1.4T","110kW","DSG"], truPrice:328000, virScore:89 },
  { id:"cac-007", make:"Toyota", model:"Fortuner", variant:"2.4 GD-6 Auto", year:2021, mileage:87300, price:579900, body:"SUV", color:"Avant-Garde Bronze", transmission:"Automatic", fuel:"Diesel",
    img:"https://images.unsplash.com/photo-1625231334401-6162a6ce0b88?w=640&q=80", specs:["2.4L Diesel","110kW","6-Speed Auto"], truPrice:592000, virScore:91 },
  { id:"cac-008", make:"Kia", model:"Seltos", variant:"1.5 EX Auto", year:2023, mileage:29800, price:449900, body:"SUV", color:"Gravity Grey", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=640&q=80", specs:["1.5L","85kW","CVT"], truPrice:458000, virScore:94 },
  { id:"cac-009", make:"Haval", model:"Jolion", variant:"1.5T Luxury", year:2022, mileage:41600, price:329900, body:"SUV", color:"Hamilton White", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=640&q=80", specs:["1.5T","105kW","7-DCT"], truPrice:338000, virScore:88 },
  { id:"cac-010", make:"Volkswagen", model:"Polo", variant:"1.0 TSI Life", year:2023, mileage:33200, price:299900, body:"Hatchback", color:"Reef Blue", transmission:"Manual", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80", specs:["1.0T","70kW","5-Speed"], truPrice:306000, virScore:95 },
  { id:"cac-011", make:"Isuzu", model:"D-Max", variant:"1.9 Ddi LSE D/Cab", year:2022, mileage:71400, price:519900, body:"Bakkie", color:"Splash White", transmission:"Automatic", fuel:"Diesel",
    img:"https://images.unsplash.com/photo-1590362891991-f776e747a588?w=640&q=80", specs:["1.9L Diesel","110kW","6-Speed Auto"], truPrice:529000, virScore:89 },
  { id:"cac-012", make:"Hyundai", model:"Tucson", variant:"2.0 Premium", year:2021, mileage:82900, price:439900, body:"SUV", color:"Amazon Grey", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=640&q=80", specs:["2.0L","115kW","6-Speed Auto"], truPrice:449000, virScore:90 },
  { id:"cac-013", make:"Suzuki", model:"Vitara Brezza", variant:"1.5 GLX Auto", year:2023, mileage:26700, price:329900, body:"SUV", color:"Sizzle Orange", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1551830820-330a71b99659?w=640&q=80", specs:["1.5L","77kW","4-Speed Auto"], truPrice:336000, virScore:93 },
  { id:"cac-014", make:"Toyota", model:"Starlet Cross", variant:"1.5 XR Auto", year:2023, mileage:22400, price:339900, body:"SUV", color:"Celestite Grey", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=640&q=80", specs:["1.5L","77kW","CVT"], truPrice:346000, virScore:94 },
  { id:"cac-015", make:"Volkswagen", model:"Tiguan", variant:"1.4 TSI Comfortline", year:2021, mileage:74800, price:479900, body:"SUV", color:"Pyrit Silver", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=640&q=80", specs:["1.4T","110kW","DSG"], truPrice:489000, virScore:90 }
];
