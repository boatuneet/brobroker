"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Database, FileSpreadsheet, UploadCloud } from "lucide-react";
import {
  YACHT_CSV_REQUIRED_HEADERS,
  YACHT_IMAGE_CSV_REQUIRED_HEADERS,
  normalizeYachtImageRows,
  validateHeaders,
  type YachtCsvRow,
  type YachtImageCsvRow,
} from "@/lib/yacht-csv-import";
import { Badge, Button, Card, CardHeader, ProgressBar } from "@/components/ui";

const IMPORT_BATCH_SIZE = 10;

type ParsedCsv<T> = {
  rows: T[];
  headers: string[];
};

type ImportStats = {
  imported: number;
  requested: number;
  imagesCopied: number;
  imagesFailed: number;
  failureCount: number;
  failures: Array<{ id: string; reason: string }>;
};

export function YachtCsvImportPanel() {
  const router = useRouter();
  const [yachts, setYachts] = useState<ParsedCsv<YachtCsvRow> | null>(null);
  const [images, setImages] = useState<ParsedCsv<YachtImageCsvRow> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);

  const yachtHeaderErrors = yachts ? validateHeaders(yachts.headers, YACHT_CSV_REQUIRED_HEADERS) : [];
  const imageHeaderErrors = images ? validateHeaders(images.headers, YACHT_IMAGE_CSV_REQUIRED_HEADERS) : [];
  const imagesByYachtId = useMemo(() => normalizeYachtImageRows(images?.rows ?? []), [images]);
  const matchedImageCount = useMemo(() => {
    if (!yachts) return 0;
    return yachts.rows.reduce((count, row) => count + (imagesByYachtId.get(row.id ?? "")?.length ?? 0), 0);
  }, [imagesByYachtId, yachts]);
  const totalBatches = yachts ? Math.ceil(yachts.rows.length / IMPORT_BATCH_SIZE) : 0;
  const progress = totalBatches ? Math.round((completedBatches / totalBatches) * 100) : 0;
  const canImport =
    Boolean(yachts?.rows.length) &&
    Boolean(images?.rows.length) &&
    yachtHeaderErrors.length === 0 &&
    imageHeaderErrors.length === 0 &&
    !isImporting;

  async function handleCsvFile<T>(file: File | null, onParsed: (parsed: ParsedCsv<T>) => void) {
    setParseError(null);
    setStats(null);
    setCompletedBatches(0);
    if (!file) return;

    try {
      const parsed = await parseCsvFile<T>(file);
      onParsed(parsed);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Could not parse CSV file.");
    }
  }

  async function startImport() {
    if (!yachts || !images || !canImport) return;

    setIsImporting(true);
    setStats(null);
    setCompletedBatches(0);

    const nextStats: ImportStats = {
      imported: 0,
      requested: yachts.rows.length,
      imagesCopied: 0,
      imagesFailed: 0,
      failureCount: 0,
      failures: [],
    };

    try {
      for (let index = 0; index < yachts.rows.length; index += IMPORT_BATCH_SIZE) {
        const batch = yachts.rows.slice(index, index + IMPORT_BATCH_SIZE);
        const batchIds = new Set(batch.map((row) => row.id).filter(Boolean));
        const batchImages = images.rows.filter((row) => row.yacht_id && batchIds.has(row.yacht_id));
        const response = await fetch("/api/listings/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ yachts: batch, images: batchImages }),
        });
        const payload = (await response.json()) as Partial<ImportStats> & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Import batch failed.");
        }

        nextStats.imported += payload.imported ?? 0;
        nextStats.imagesCopied += payload.imagesCopied ?? 0;
        nextStats.imagesFailed += payload.imagesFailed ?? 0;
        nextStats.failureCount += payload.failureCount ?? 0;
        nextStats.failures = [...nextStats.failures, ...(payload.failures ?? [])].slice(0, 10);
        setStats({ ...nextStats });
        setCompletedBatches(Math.ceil((index + batch.length) / IMPORT_BATCH_SIZE));
      }

      router.refresh();
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        eyebrow="Temporary import"
        title="Bulk upload yacht database"
        description="Upload the yacht rows CSV and matching image rows CSV. Imported yachts are created as Active listings owned by your signed-in broker account."
        action={<Badge tone="info">Yachts only</Badge>}
      />
      <div className="grid gap-5 px-6 py-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <CsvFileInput
            description="Expected file: public/new_yachts_rows.csv"
            icon={FileSpreadsheet}
            label="Yacht rows CSV"
            onChange={(file) => void handleCsvFile<YachtCsvRow>(file, setYachts)}
            value={yachts ? `${yachts.rows.length} yachts loaded` : "No file selected"}
          />
          <CsvFileInput
            description="Expected file: public/new_yacht_images_rows.csv"
            icon={UploadCloud}
            label="Yacht image rows CSV"
            onChange={(file) => void handleCsvFile<YachtImageCsvRow>(file, setImages)}
            value={images ? `${images.rows.length} images loaded` : "No file selected"}
          />
        </div>

        {yachtHeaderErrors.length || imageHeaderErrors.length ? (
          <ImportNotice
            tone="error"
            title="CSV headers do not match"
            detail={[
              yachtHeaderErrors.length ? `Yacht CSV missing: ${yachtHeaderErrors.join(", ")}` : "",
              imageHeaderErrors.length ? `Image CSV missing: ${imageHeaderErrors.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        ) : null}

        {parseError ? <ImportNotice tone="error" title="Import issue" detail={parseError} /> : null}

        {yachts && images && !yachtHeaderErrors.length && !imageHeaderErrors.length ? (
          <div className="grid gap-3 rounded-[12px] border border-[#E7E7E7] bg-[#F1F2EE] p-4 sm:grid-cols-3">
            <PreviewMetric label="Yachts" value={`${yachts.rows.length}`} />
            <PreviewMetric label="Images" value={`${images.rows.length}`} />
            <PreviewMetric label="Matched images" value={`${matchedImageCount}`} />
          </div>
        ) : null}

        {isImporting || stats ? (
          <div className="rounded-[12px] border border-[#E7E7E7] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#171719]">
                  {isImporting ? "Importing yacht batches..." : "Import complete"}
                </p>
                <p className="mt-1 text-[13px] text-[#5F625E]">
                  {completedBatches}/{totalBatches} batches processed
                </p>
              </div>
              <Badge tone={isImporting ? "info" : "success"}>{progress}%</Badge>
            </div>
            <ProgressBar className="mt-4" tone="green" value={progress} />
            {stats ? (
              <p className="mt-3 text-[13px] leading-6 text-[#5F625E]">
                Created or updated {stats.imported}/{stats.requested} yachts. Copied {stats.imagesCopied} images
                {stats.imagesFailed ? `, ${stats.imagesFailed} images failed` : ""}.
              </p>
            ) : null}
            {stats?.failures.length ? (
              <ul className="mt-3 grid gap-1 text-[12px] leading-5 text-[#A86642]">
                {stats.failures.map((failure, index) => (
                  <li key={`${failure.id}-${index}`}>{failure.id}: {failure.reason}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-[13px] leading-6 text-[#5F625E]">
            The importer stores only current BroBroker listing fields plus the raw source metadata for future cleanup.
          </p>
          <Button disabled={!canImport} onClick={() => void startImport()} type="button">
            <Database className="h-4 w-4" aria-hidden="true" />
            {isImporting ? "Importing..." : "Import active yachts"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CsvFileInput({
  description,
  icon: Icon,
  label,
  onChange,
  value,
}: {
  description: string;
  icon: typeof FileSpreadsheet;
  label: string;
  onChange: (file: File | null) => void;
  value: string;
}) {
  return (
    <label className="grid cursor-pointer gap-3 rounded-[12px] border border-dashed border-[#D9DAD4] bg-[#F1F2EE] p-5 transition-colors hover:border-[#003C33] hover:bg-[#F1F2EE]">
      <span className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#003C33]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[#171719]">{label}</span>
          <span className="mt-0.5 block text-[12px] text-[#8E918B]">{description}</span>
        </span>
      </span>
      <span className="rounded-[12px] border border-[#E7E7E7] bg-white px-3 py-2 text-[13px] font-medium text-[#5F625E]">
        {value}
      </span>
      <input
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        type="file"
      />
    </label>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="bb-mono-label">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-[#171719]">{value}</p>
    </div>
  );
}

function ImportNotice({
  detail,
  title,
  tone,
}: {
  detail: string;
  title: string;
  tone: "error" | "warning";
}) {
  return (
    <div className={tone === "error" ? "rounded-[12px] bg-red-50 px-4 py-3 text-red-700" : "rounded-[12px] bg-[#F0DDD0] px-4 py-3 text-[#A86642]"}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-[13px] leading-6">{detail}</p>
    </div>
  );
}

function parseCsvFile<T>(file: File) {
  return new Promise<ParsedCsv<T>>((resolve, reject) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length) {
          reject(new Error(result.errors[0]?.message ?? "CSV parsing failed."));
          return;
        }
        resolve({
          rows: result.data,
          headers: result.meta.fields ?? [],
        });
      },
      error: (error) => reject(error),
    });
  });
}
