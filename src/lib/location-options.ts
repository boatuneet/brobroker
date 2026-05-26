import type { AssetType, ListingCoordinates, YachtListing } from "@/lib/types";

export type LocationPrecision = "Exact" | "Area" | "Private";

export type LocationOption = {
  id: string;
  segment: AssetType | "Any";
  label: string;
  secondaryLabel: string;
  searchText: string;
  coordinates?: ListingCoordinates;
  precision: LocationPrecision;
};

export const locationOptions: LocationOption[] = [
  {
    id: "palma-marina",
    segment: "Yacht",
    label: "Palma, Mallorca",
    secondaryLabel: "Marina / Balearic Islands",
    searchText: "palma mallorca marina port balearic yacht",
    coordinates: { lat: 39.5696, lng: 2.6502 },
    precision: "Area",
  },
  {
    id: "portals-mallorca",
    segment: "Yacht",
    label: "Portals, Mallorca",
    secondaryLabel: "Puerto Portals marina",
    searchText: "portals mallorca puerto portals marina yacht",
    coordinates: { lat: 39.5315, lng: 2.5681 },
    precision: "Area",
  },
  {
    id: "monaco-port",
    segment: "Yacht",
    label: "Monaco",
    secondaryLabel: "Port Hercules / Monaco",
    searchText: "monaco port hercules marina yacht",
    coordinates: { lat: 43.7347, lng: 7.4217 },
    precision: "Area",
  },
  {
    id: "athens-marina",
    segment: "Yacht",
    label: "Athens, Greece",
    secondaryLabel: "Athens Riviera marina area",
    searchText: "athens greece riviera marina yacht",
    coordinates: { lat: 37.9375, lng: 23.666 },
    precision: "Area",
  },
  {
    id: "munich-showroom",
    segment: "Car",
    label: "Munich, Germany",
    secondaryLabel: "Private showroom area",
    searchText: "munich germany showroom car automotive",
    coordinates: { lat: 48.1351, lng: 11.582 },
    precision: "Area",
  },
  {
    id: "stuttgart-storage",
    segment: "Car",
    label: "Stuttgart, Germany",
    secondaryLabel: "Dealer storage / Baden-Wurttemberg",
    searchText: "stuttgart germany dealer storage porsche car",
    coordinates: { lat: 48.7758, lng: 9.1829 },
    precision: "Private",
  },
  {
    id: "london-private-garage",
    segment: "Car",
    label: "London, United Kingdom",
    secondaryLabel: "Private garage / central London",
    searchText: "london united kingdom private garage car",
    coordinates: { lat: 51.5072, lng: -0.1276 },
    precision: "Private",
  },
  {
    id: "port-hercules-penthouse",
    segment: "Real Estate",
    label: "Port Hercules, Monaco",
    secondaryLabel: "Private address label / harbor district",
    searchText: "port hercules monaco harbor penthouse real estate",
    coordinates: { lat: 43.7353, lng: 7.4211 },
    precision: "Private",
  },
  {
    id: "gordes-provence",
    segment: "Real Estate",
    label: "Gordes, France",
    secondaryLabel: "Private estate area / Provence",
    searchText: "gordes france provence estate real estate",
    coordinates: { lat: 43.912, lng: 5.2007 },
    precision: "Area",
  },
  {
    id: "palm-jumeirah-dubai",
    segment: "Real Estate",
    label: "Palm Jumeirah, Dubai",
    secondaryLabel: "Private tower / Palm Jumeirah",
    searchText: "palm jumeirah dubai sky villa real estate",
    coordinates: { lat: 25.1124, lng: 55.139 },
    precision: "Private",
  },
];

export function getLocationOptionsForSegment(segment: AssetType) {
  return locationOptions.filter((option) => option.segment === segment || option.segment === "Any");
}

export function filterLocationOptions(segment: AssetType, query: string, limit = 6) {
  const normalized = query.trim().toLowerCase();
  const options = getLocationOptionsForSegment(segment);

  if (!normalized) return options.slice(0, limit);

  return options
    .filter((option) => `${option.label} ${option.secondaryLabel} ${option.searchText}`.toLowerCase().includes(normalized))
    .slice(0, limit);
}

export function findLocationOption(segment: AssetType, value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;

  return getLocationOptionsForSegment(segment).find(
    (option) => option.label.toLowerCase() === normalized || option.searchText.toLowerCase().includes(normalized),
  );
}

export function getListingMapLocation(listing: YachtListing) {
  const segment = listing.assetType ?? "Yacht";
  const matched = findLocationOption(segment, listing.locationLabel ?? listing.address ?? listing.location);

  return {
    coordinates: listing.coordinates ?? matched?.coordinates,
    label: listing.locationLabel ?? listing.address ?? listing.location,
    precision: listing.locationPrecision ?? matched?.precision ?? "Area",
  };
}
