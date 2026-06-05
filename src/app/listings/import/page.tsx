import { AppShell } from "@/components/app-shell";
import { YachtCsvImportPanel } from "@/components/listing-intake/yacht-csv-import-panel";
import { PageHeader } from "@/components/ui";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";

export const metadata = {
  title: "Bulk import listings · BroBroker",
  description: "Upload yacht rows and image rows CSVs to create listings in bulk.",
};

export default function ListingsImportPage() {
  return (
    <AppShell
      active="Listings"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Listings", href: "/listings" },
            { label: "Bulk import" },
          ]}
        />
      }
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <PageHeader
          title="Bulk upload listings"
          description="Upload your yacht rows CSV and matching image rows CSV. Yachts are imported as Active listings under your broker account, with images mirrored to the avatars storage bucket."
        />
        <div className="mt-10">
          <YachtCsvImportPanel />
        </div>
      </div>
    </AppShell>
  );
}
