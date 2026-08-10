import { CarDealership } from '../types/carDealer';

/* ============================================================================
   Market Intel starts clean — no built-in dealerships. Dealerships are added
   by the user (Prospect Finder, website scraper, CSV/manual) and persist to
   localStorage until then.
   ========================================================================== */

export const initialCarDealerships: CarDealership[] = [];
