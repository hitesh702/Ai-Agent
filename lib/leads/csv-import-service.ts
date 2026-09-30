import { LeadStatus } from "@prisma/client";
import { ApiError, handleApiError, jsonError, jsonOk } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import {
  CSV_IMPORT_MAX_BYTES,
  CsvImportError,
  planCsvImport,
  type CsvImportIssue,
  type CsvImportRow,
} from "./csv-import";

export const CSV_IMPORT_FAILED_MESSAGE =
  "Unable to import CSV. Please check the file and try again.";

export type CsvImportResult = {
  confirmed: boolean;
  totalRows: number;
  readyToImport: number;
  imported: number;
  skipped: number;
  invalid: number;
  duplicates: number;
  issues: CsvImportIssue[];
  validLeads: CsvImportRow[];
};

type CsvUpload = { text: string; confirm: boolean };

async function readCsvUpload(request: Request): Promise<CsvUpload> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, "Please choose a CSV file to upload.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new ApiError(400, "Please choose a CSV file to upload.");
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    throw new ApiError(400, "Only .csv files are supported.");
  }
  if (file.size === 0) {
    throw new ApiError(400, "CSV file is empty. Add a header row and at least one lead.");
  }
  if (file.size > CSV_IMPORT_MAX_BYTES) {
    throw new ApiError(400, "CSV file is too large. The limit is 1 MB per upload.");
  }

  return { text: await file.text(), confirm: form.get("confirm") === "true" };
}

/**
 * Validates the CSV against this business's leads only.
 * Without `confirm` nothing is written. With `confirm` the valid rows are
 * saved as NEW leads. This never places calls or creates campaigns.
 */
export async function importCsvLeads(
  businessId: string,
  text: string,
  confirm: boolean,
): Promise<CsvImportResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.lead.findMany({
      where: { businessId },
      select: { phone: true },
    });

    let plan;
    try {
      plan = planCsvImport(text, existing.map((lead) => lead.phone));
    } catch (error) {
      if (error instanceof CsvImportError) throw new ApiError(400, error.message);
      throw error;
    }

    let imported = 0;
    if (confirm && plan.valid.length > 0) {
      const created = await tx.lead.createMany({
        data: plan.valid.map((row) => ({
          businessId,
          name: row.name,
          phone: row.phone,
          email: row.email,
          source: "CSV Import",
          status: LeadStatus.NEW,
        })),
      });
      imported = created.count;
    }

    return {
      confirmed: confirm,
      totalRows: plan.totalRows,
      readyToImport: plan.valid.length,
      imported,
      skipped: plan.skipped,
      invalid: plan.invalid,
      duplicates: plan.duplicates,
      issues: plan.issues,
      validLeads: plan.valid,
    };
  });
}

export async function handleCsvImportRequest(
  request: Request,
  getBusinessId: () => Promise<string>,
): Promise<Response> {
  try {
    const businessId = await getBusinessId();
    const { text, confirm } = await readCsvUpload(request);
    return jsonOk(await importCsvLeads(businessId, text, confirm));
  } catch (error) {
    if (error instanceof ApiError) return handleApiError(error);
    console.error("[leads/import] CSV import failed", error);
    return jsonError(500, CSV_IMPORT_FAILED_MESSAGE);
  }
}
