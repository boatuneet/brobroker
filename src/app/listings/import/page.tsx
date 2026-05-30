import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { YachtCsvImportPanel } from "@/components/listing-intake/yacht-csv-import-panel";
import { PageHeader } from "@/components/ui";

export const metadata = {
  title: "Bulk import listings · BroBroker",
  description: "Upload yacht rows and image rows CSVs to create listings in bulk.",
};

export default function ListingsImportPage() {
  return (
    <AppShell active="Listings">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <Link
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#5F625E] hover:text-[#171719]"
          href="/listings"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to listings
        </Link>
        <div className="mt-3">
          <PageHeader
            title="Bulk upload listings"
            description="Upload your yacht rows CSV and matching image rows CSV. Yachts are imported as Active listings under your broker account, with images mirrored to the avatars storage bucket."
          />
        </div>
        <div className="mt-10">
          <YachtCsvImportPanel />
        </div>
      </div>
    </AppShell>
  );
}
