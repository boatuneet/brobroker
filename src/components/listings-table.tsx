"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Edit01 } from "@untitledui/icons";
import { Building2, CarFront, Ship } from "lucide-react";
import type { SortDescriptor } from "react-aria-components";
import { PaginationPageMinimalCenter } from "@/components/application/pagination/pagination";
import { Table, TableCard } from "@/components/application/table/table";
import type { BadgeTypes } from "@/components/base/badges/badge-types";
import { Badge, type BadgeColor, BadgeWithDot } from "@/components/base/badges/badges";
import { ButtonUtility } from "@/components/base/buttons/button-utility";
import {
  type BrokerSegment,
} from "@/lib/broker-segments";
import { getDocumentCompleteness, getListingAssetType, getListingSpecSummary } from "@/lib/services";
import type { ListingStatus, YachtListing } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type ListingRow = YachtListing & {
  assetType: BrokerSegment;
  completenessPercent: number;
  locationLabel: string;
  specSummary: string;
  openTasks: number;
};

const segmentIcons = {
  Yacht: Ship,
  Car: CarFront,
  "Real Estate": Building2,
} satisfies Record<BrokerSegment, typeof Ship>;

function ListingSegmentMark({ assetType }: { assetType: BrokerSegment }) {
  const Icon = segmentIcons[assetType];

  return (
    <span
      aria-hidden="true"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1F2EE] text-[#5F625E] transition-colors duration-200 ease-out group-hover:bg-[#DFE1DB] group-hover:text-[#171719]"
    >
      <Icon className="size-[18px] stroke-[1.75]" />
    </span>
  );
}

function statusBadgeColor(status: ListingStatus): BadgeColor<BadgeTypes> {
  if (status === "Active") return "success";
  if (status === "Under Offer") return "warning";
  if (status === "Pre-Market") return "blue";
  if (status === "Coming Soon") return "purple";
  return "gray";
}

function highlightBadgeColor(index: number): BadgeColor<BadgeTypes> {
  const palette: BadgeColor<BadgeTypes>[] = ["brand", "blue", "success", "purple", "orange", "gray"];
  return palette[index % palette.length];
}

function compareRows(first: ListingRow, second: ListingRow, column: keyof ListingRow, direction: SortDescriptor["direction"]) {
  const a = first[column];
  const b = second[column];

  if ((typeof a === "number" && typeof b === "number") || (typeof a === "boolean" && typeof b === "boolean")) {
    return direction === "descending" ? (b as number) - (a as number) : (a as number) - (b as number);
  }

  if (typeof a === "string" && typeof b === "string") {
    const cmp = a.localeCompare(b);
    return direction === "descending" ? -cmp : cmp;
  }

  return 0;
}

export function ListingsTable({
  listings,
  page,
  pageCount,
  pageSize,
  onPageChange,
  filters,
  emptyState,
}: {
  listings: ListingRow[];
  page: number;
  pageCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Search + status chips, rendered as a toolbar inside the card. */
  filters?: ReactNode;
  /** Shown in place of the table when there are no rows. */
  emptyState?: ReactNode;
}) {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });

  const sortedItems = useMemo(() => {
    const column = sortDescriptor.column as keyof ListingRow;
    return [...listings].sort((a, b) => compareRows(a, b, column, sortDescriptor.direction));
  }, [listings, sortDescriptor]);

  const pageStart = (page - 1) * pageSize;
  const pageItems = sortedItems.slice(pageStart, pageStart + pageSize);

  return (
    <TableCard.Root className="shadow-none">
      <TableCard.Header
        badge={
          <Badge color="gray" size="sm" type="pill-color">
            {`${listings.length} listing${listings.length === 1 ? "" : "s"}`}
          </Badge>
        }
        title="Inventory"
      />
      {filters ? (
        <div className="border-b border-secondary bg-primary px-4 py-3 md:px-6">{filters}</div>
      ) : null}
      {listings.length === 0 ? (
        <div className="px-6 py-14">{emptyState}</div>
      ) : (
      <Table
        aria-label="Listings"
        className="min-w-[1480px] w-max"
        onSortChange={setSortDescriptor}
        sortDescriptor={sortDescriptor}
      >
        <Table.Header>
          <Table.Head allowsSorting className="min-w-[320px]" id="name" isRowHeader label="Asset" />
          <Table.Head allowsSorting className="min-w-[140px]" id="status" label="Status" />
          <Table.Head allowsSorting className="min-w-[280px]" id="locationLabel" label="Location" />
          <Table.Head allowsSorting className="min-w-[340px]" id="specSummary" label="Specs" />
          <Table.Head allowsSorting className="min-w-[128px]" id="priceEur" label="Price" />
          <Table.Head className="min-w-[320px]" id="highlights" label="Highlights" />
          <Table.Head className="min-w-[72px]" id="actions" />
        </Table.Header>

        <Table.Body items={pageItems}>
          {(item) => (
            <Table.Row id={item.id}>
              <Table.Cell className="!align-middle">
                <Link
                  className="group flex items-center gap-3 outline-hidden"
                  href={`/listings/${item.id}`}
                >
                  <ListingSegmentMark assetType={item.assetType} />
                  <div className="whitespace-nowrap transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                    <p className="text-sm font-medium text-primary">
                      {item.name}
                    </p>
                    <p className="text-sm text-tertiary">
                      {item.builder} {item.model}
                    </p>
                  </div>
                </Link>
              </Table.Cell>
              <Table.Cell className="!align-middle">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <BadgeWithDot color={statusBadgeColor(item.status)} size="sm" type="pill-color">
                    {item.status}
                  </BadgeWithDot>
                  {item.missingInfo.length > 0 ? (
                    <span className="text-xs text-tertiary">
                      {item.missingInfo.length} gap{item.missingInfo.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
              </Table.Cell>
              <Table.Cell className="!align-middle whitespace-nowrap">{item.locationLabel}</Table.Cell>
              <Table.Cell className="!align-middle whitespace-nowrap">{item.specSummary}</Table.Cell>
              <Table.Cell className="!align-middle whitespace-nowrap font-medium tabular-nums text-primary">
                {formatCurrency(item.priceEur)}
              </Table.Cell>
              <Table.Cell className="!align-middle">
                <div className="flex flex-nowrap items-center gap-1.5">
                  {item.highlights.slice(0, 4).map((highlight, index) => (
                    <Badge color={highlightBadgeColor(index)} key={highlight} size="sm" type="pill-color">
                      {highlight}
                    </Badge>
                  ))}
                  {item.highlights.length > 4 ? (
                    <Badge color="gray" size="sm" type="pill-color">
                      +{item.highlights.length - 4}
                    </Badge>
                  ) : null}
                </div>
              </Table.Cell>
              <Table.Cell className="!align-middle px-4">
                <div className="flex justify-end">
                  <ButtonUtility
                    color="tertiary"
                    href={`/listings/${item.id}/edit`}
                    icon={Edit01}
                    size="xs"
                    tooltip="Edit"
                  />
                </div>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      )}

      {listings.length > 0 && pageCount > 1 ? (
        <PaginationPageMinimalCenter
          className="border-secondary px-4 py-3 md:px-6 md:pt-3 md:pb-4"
          onPageChange={onPageChange}
          page={page}
          total={pageCount}
        />
      ) : null}
    </TableCard.Root>
  );
}

export function toListingRows(
  listings: YachtListing[],
  openTaskCounts: Map<string, number>,
): ListingRow[] {
  return listings.map((listing) => ({
    ...listing,
    assetType: getListingAssetType(listing),
    completenessPercent: getDocumentCompleteness(listing).percent,
    locationLabel: listing.locationLabel ?? listing.location,
    openTasks: openTaskCounts.get(listing.id) ?? 0,
    specSummary: getListingSpecSummary(listing),
  }));
}
