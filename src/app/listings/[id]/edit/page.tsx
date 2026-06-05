import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ListingEditForm } from "@/components/listing-edit-form";
import { PageBreadcrumb } from "@/components/ui/page-breadcrumb";
import { getListingAssetType } from "@/lib/services";
import { getListingBrain } from "@/lib/services";
import { getStoredListingById } from "@/lib/supabase/listings";

export const metadata = {
  title: "Edit listing · BroBroker",
  description: "Edit a broker listing record.",
};

export const dynamic = "force-dynamic";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storedListing = await getStoredListingById(id);
  const demoListing = getListingBrain(id)?.listing;
  const listing = storedListing ?? demoListing;

  if (!listing) {
    notFound();
  }

  return (
    <AppShell
      active="Listings"
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: "Listings", href: "/listings" },
            { label: listing.name, href: `/listings/${id}` },
            { label: "Edit" },
          ]}
        />
      }
    >
      <ListingEditForm listing={listing} segment={getListingAssetType(listing)} />
    </AppShell>
  );
}
