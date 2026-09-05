"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/shared/page-header";
import VehicleCard from "@/components/vehicles/vehicle-card";
import ChipFilter from "@/components/vehicles/chip-filter";
import { fetchVMGStock, VEHICLES } from "@/data/mock-stock";
import { showSkeletons, hideSkeletons, getSavedCars } from "@/lib/showroom";
import SavedRecentDrawer from "@/components/widgets/saved-recent-drawer";
import type { Vehicle } from "@/data/mock-stock";

export default function VehiclesPage() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [savedCars, setSavedCars] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Restore URL filter + saved cars on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const makeFilter = params.get("make");
    setSavedCars(getSavedCars());
    setActiveFilter(makeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch whenever the active make changes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      showSkeletons("stock-grid", 8);
      try {
        const { vehicles: stock } = await fetchVMGStock({
          limit: 50,
          filters: activeFilter ? { makes: [activeFilter] } : undefined,
        });
        setVehicles(stock);
      } catch {
        setVehicles(VEHICLES);
      } finally {
        hideSkeletons("stock-grid");
        setLoading(false);
      }
    };
    load();
  }, [activeFilter]);

  const selectMake = (make: string | null) => {
    setActiveFilter(make);
    router.replace(make ? `/vehicles?make=${encodeURIComponent(make)}` : "/vehicles");
  };

  // Make list + counts for filter chips (from the unfiltered catalogue)
  const makes = Array.from(new Set(VEHICLES.map((v) => v.make))).sort();
  const countFor = (make: string) => VEHICLES.filter((v) => v.make === make).length;

  const handleSave = (id: string) => {
    const next = savedCars.includes(id)
      ? savedCars.filter((c) => c !== id)
      : [id, ...savedCars];
    setSavedCars(next);
    localStorage.setItem("ycg-saved-cars", JSON.stringify(next));
  };

  return (
    <>
      <PageHeader title="Browse Our Stock" subtitle="Hand-picked quality pre-owned vehicles" count={vehicles.length} />

      {/* Saved / Recent drawers */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 pb-2">
          <SavedRecentDrawer mode="saved" vehicles={vehicles.filter((v) => savedCars.includes(v.id))} />
          <SavedRecentDrawer mode="recent" vehicles={vehicles.slice(-6).reverse()} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="border-b border-border bg-surface-alt sticky top-[72px] z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <ChipFilter
            label="All Makes"
            active={!activeFilter}
            count={VEHICLES.length}
            onClick={() => selectMake(null)}
          />
          {makes.map((make) => (
            <ChipFilter
              key={make}
              label={make}
              active={activeFilter === make}
              count={countFor(make)}
              onClick={() => selectMake(make)}
            />
          ))}
        </div>
      </div>

      {/* Vehicle grid with skeleton states */}
      <div className="px-4 pb-16 sm:pb-24">
        <div className="max-w-7xl mx-auto" id="stock-grid">
          {!loading && vehicles.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-ink-muted text-lg">No vehicles match your filters.</p>
              <a href="/vehicles" className="inline-block mt-4 text-brand font-medium hover:underline">Clear all filters</a>
            </div>
          ) : !loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 stagger">
              {vehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onSave={handleSave}
                  saved={savedCars.includes(v.id)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}