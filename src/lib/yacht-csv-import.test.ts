import { describe, expect, test } from "vitest";
import {
  buildImportedPhoto,
  normalizeYachtImageRows,
  normalizeYachtImport,
} from "./yacht-csv-import";

describe("yacht CSV import mapping", () => {
  test("normalizes a scraped yacht row into the current asset fields", () => {
    const yacht = normalizeYachtImport({
      id: "000dcfdc-eec1-4fd8-90e3-fe9a6e37721b",
      manufacturer: "Galeon",
      model: "350HTC",
      propulsion: "Motor",
      start_of_production: "2012",
      country: "Poland",
      condition: "used",
      price: "200000",
      currency: "EUR",
      description: "Owner description",
      source_url: "https://example.com/yacht",
      slug: "galeon-350htc-2012",
      scraped_sections: JSON.stringify({
        capacities: { cabins: "3" },
        dimensions: { length_overall: "11.60 m" },
        description: { title: "Galeon 350HTC", location: "Poland » Oder" },
        engines: { engine_power: "2 x 350 hp / 257 kW" },
        primaryInformation: { vat_status: "excl. VAT" },
      }),
    });

    expect(yacht).toMatchObject({
      assetId: "imported-yacht-000dcfdc-eec1-4fd8-90e3-fe9a6e37721b",
      builder: "Galeon",
      model: "350HTC",
      year: 2012,
      priceEur: 200000,
      cabins: 3,
      condition: "Used",
      propulsion: "Motor",
      location: "Poland » Oder",
      vatStatus: "Not Paid",
    });
    expect(yacht?.lengthFt).toBeCloseTo(38, 0);
    expect(yacht?.coreFacts.map((fact) => fact.label)).toContain("Propulsion");
  });

  test("groups image rows by source yacht id and preserves position order", () => {
    const grouped = normalizeYachtImageRows([
      { id: "image-2", yacht_id: "yacht-1", image_url: "https://example.com/2.jpg", position: "2" },
      { id: "image-1", yacht_id: "yacht-1", image_url: "https://example.com/1.jpg", position: "1" },
    ]);
    const photo = buildImportedPhoto(grouped.get("yacht-1")?.[0] ?? {}, "https://example.com/1.jpg", "user/listing/photo.jpg");

    expect(grouped.get("yacht-1")?.map((row) => row.id)).toEqual(["image-1", "image-2"]);
    expect(photo).toMatchObject({
      id: "imported-photo-image-1",
      name: "photo.jpg",
      storagePath: "user/listing/photo.jpg",
    });
  });
});
