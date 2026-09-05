/*  Atlantic Prestige — PREMIUM (Enterprise / Dealer Group) demo stock
    Approved luxury & performance. Real SA models, Aug-2026 market pricing.
    Defines global MOCK_STOCK consumed by index.html. */

const MOCK_STOCK = [
  { id:"apx-001", make:"BMW", model:"M340i", variant:"xDrive M Sport", year:2022, mileage:38400, price:989900, body:"Sedan", color:"Portimao Blue", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1555215695-3004980ad54e?w=640&q=80", specs:["3.0L Turbo","275kW","8-Speed Steptronic"], truPrice:1010000, virScore:96 },
  { id:"apx-002", make:"Mercedes-Benz", model:"C43 AMG", variant:"4MATIC", year:2023, mileage:24600, price:1249900, body:"Sedan", color:"Obsidian Black", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&q=80", specs:["2.0L Turbo","300kW","9G-Tronic"], truPrice:1275000, virScore:97 },
  { id:"apx-003", make:"Audi", model:"RS3", variant:"Sportback quattro", year:2022, mileage:31200, price:1099900, body:"Hatchback", color:"Kyalami Green", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80", specs:["2.5L TFSI","294kW","7-Speed S tronic"], truPrice:1125000, virScore:95 },
  { id:"apx-004", make:"Porsche", model:"Macan", variant:"S", year:2021, mileage:52800, price:1189900, body:"SUV", color:"Carrara White", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=640&q=80", specs:["2.9L V6 Turbo","280kW","7-Speed PDK"], truPrice:1215000, virScore:94 },
  { id:"apx-005", make:"Land Rover", model:"Range Rover Velar", variant:"D300 R-Dynamic", year:2021, mileage:61400, price:1049900, body:"SUV", color:"Santorini Black", transmission:"Automatic", fuel:"Diesel",
    img:"https://images.unsplash.com/photo-1625231334401-6162a6ce0b88?w=640&q=80", specs:["3.0L Diesel","221kW","8-Speed Auto"], truPrice:1075000, virScore:92 },
  { id:"apx-006", make:"BMW", model:"X5", variant:"xDrive30d M Sport", year:2022, mileage:44700, price:1329900, body:"SUV", color:"Mineral White", transmission:"Automatic", fuel:"Diesel",
    img:"https://images.unsplash.com/photo-1555215695-3004980ad54e?w=640&q=80", specs:["3.0L Diesel","210kW","8-Speed Steptronic"], truPrice:1360000, virScore:95 },
  { id:"apx-007", make:"Mercedes-Benz", model:"GLE400d", variant:"4MATIC AMG Line", year:2021, mileage:58900, price:1189900, body:"SUV", color:"Selenite Grey", transmission:"Automatic", fuel:"Diesel",
    img:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&q=80", specs:["3.0L Diesel","243kW","9G-Tronic"], truPrice:1215000, virScore:93 },
  { id:"apx-008", make:"Audi", model:"Q5", variant:"45 TFSI quattro S line", year:2022, mileage:39600, price:849900, body:"SUV", color:"Navarra Blue", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=640&q=80", specs:["2.0L TFSI","183kW","7-Speed S tronic"], truPrice:869000, virScore:94 },
  { id:"apx-009", make:"Porsche", model:"911 Carrera", variant:"992 PDK", year:2021, mileage:28400, price:2399900, body:"Coupe", color:"GT Silver", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=640&q=80", specs:["3.0L Flat-6","283kW","8-Speed PDK"], truPrice:2450000, virScore:98 },
  { id:"apx-010", make:"BMW", model:"M2", variant:"Coupé", year:2023, mileage:19800, price:1349900, body:"Coupe", color:"Zandvoort Blue", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=640&q=80", specs:["3.0L Turbo","338kW","8-Speed M Steptronic"], truPrice:1380000, virScore:97 },
  { id:"apx-011", make:"Mercedes-Benz", model:"A45 S", variant:"4MATIC+", year:2022, mileage:33100, price:1099900, body:"Hatchback", color:"Mountain Grey", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=640&q=80", specs:["2.0L Turbo","310kW","8-Speed DCT"], truPrice:1125000, virScore:96 },
  { id:"apx-012", make:"Jaguar", model:"F-Pace", variant:"P250 R-Dynamic SE", year:2021, mileage:54200, price:799900, body:"SUV", color:"Firenze Red", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1625231334401-6162a6ce0b88?w=640&q=80", specs:["2.0L Turbo","183kW","8-Speed Auto"], truPrice:819000, virScore:90 },
  { id:"apx-013", make:"Volvo", model:"XC60", variant:"B5 R-Design", year:2022, mileage:41800, price:829900, body:"SUV", color:"Onyx Black", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=640&q=80", specs:["2.0L Mild-Hybrid","184kW","8-Speed Auto"], truPrice:849000, virScore:93 },
  { id:"apx-014", make:"Audi", model:"A5", variant:"40 TFSI S line Coupé", year:2021, mileage:47300, price:729900, body:"Coupe", color:"Daytona Grey", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=640&q=80", specs:["2.0L TFSI","150kW","7-Speed S tronic"], truPrice:749000, virScore:92 },
  { id:"apx-015", make:"Mercedes-Benz", model:"C200", variant:"AMG Line", year:2022, mileage:36900, price:749900, body:"Sedan", color:"Spectral Blue", transmission:"Automatic", fuel:"Petrol",
    img:"https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=640&q=80", specs:["1.5L Turbo","150kW","9G-Tronic"], truPrice:769000, virScore:94 }
];
