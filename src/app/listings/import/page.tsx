import { AppShell } from "@/components/app-shell";
import { YachtCsvImportPanel } from "@/components/listing-intake/yacht-csv-import-panel";
import { YachtPdfImportPanel } from "@/components/listing-intake/yacht-pdf-import-panel";
import { Card, PageHeader } from "@/components/ui";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";

export const metadata = {
  title: "Custom import · BroBroker",
  description: "Import listings from CSV files or a single listing PDF.",
};

export default function ListingsImportPage() {
  return (
    <AppShell
      active="Listings"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Listings", href: "/listings" },
            { label: "Custom import" },
          ]}
        />
      }
    >
      <div className="mx-auto w-full max-w-[1536px] px-6 py-8 sm:px-10 lg:px-14 lg:py-10">
        {/* Header on a card surface so it stays legible over the dotted backdrop. */}
        <Card className="px-6 py-6 sm:px-8 sm:py-7">
          <PageHeader
            title="Custom import"
            description="Bring listings into your workspace two ways: bulk-upload yacht CSVs, or import one boat at a time from a detail PDF. Everything is created under your broker account."
          />
        </Card>

        <div className="mt-8 grid gap-8">
          <YachtCsvImportPanel />
          <YachtPdfImportPanel />
        </div>
      </div>
    </AppShell>
  );
}
