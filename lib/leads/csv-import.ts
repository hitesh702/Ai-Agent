import { z } from "zod";

export const CSV_IMPORT_MAX_BYTES = 1024 * 1024;
export const CSV_IMPORT_MAX_ROWS = 5000;
export const CSV_IMPORT_COLUMNS = ["name", "phone", "email"] as const;
const MAX_REPORTED_ISSUES = 200;

export type CsvImportIssue = {
  row: number;
  reason: string;
  kind: "invalid" | "duplicate";
};

export type CsvImportRow = {
  row: number;
  name: string;
  phone: string;
  email: string;
};

export type CsvImportPlan = {
  totalRows: number;
  valid: CsvImportRow[];
  skipped: number;
  invalid: number;
  duplicates: number;
  issues: CsvImportIssue[];
};

export class CsvImportError extends Error {}

const emailSchema = z.string().email();

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new CsvImportError("CSV has an unclosed quoted field");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Accepts a 10-digit Indian mobile number (starting 6–9), optionally written
 * with +91 / 91 / 0 in front and spaces or dashes. Returns it as +91XXXXXXXXXX
 * (the format the calling system uses) or null if it is not a valid number.
 */
export function normalizeImportPhone(raw: string): string | null {
  const compact = raw.trim().replace(/[\s-]/g, "");
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1]}` : null;
}

export function planCsvImport(
  text: string,
  existingPhones: Iterable<string>,
): CsvImportPlan {
  const rows = parseCsv(text);
  const isBlank = (cells: string[]) => cells.every((c) => c.trim() === "");
  const header = rows[0]?.map((h) => h.trim().toLowerCase());
  if (!header || isBlank(header) || rows.slice(1).every(isBlank)) {
    throw new CsvImportError("CSV file is empty. Add a header row and at least one lead.");
  }

  const expected = [...CSV_IMPORT_COLUMNS].sort().join(",");
  if ([...header].sort().join(",") !== expected) {
    throw new CsvImportError(
      `CSV header must be exactly: ${CSV_IMPORT_COLUMNS.join(",")}`,
    );
  }
  const nameIdx = header.indexOf("name");
  const phoneIdx = header.indexOf("phone");
  const emailIdx = header.indexOf("email");

  const body = rows.slice(1);
  if (body.length > CSV_IMPORT_MAX_ROWS) {
    throw new CsvImportError(
      `CSV has ${body.length} rows; the limit is ${CSV_IMPORT_MAX_ROWS} per import`,
    );
  }

  const known = new Set<string>();
  for (const phone of existingPhones) {
    const normalized = normalizeImportPhone(phone);
    if (normalized) known.add(normalized);
  }
  const seenInFile = new Map<string, number>();

  const plan: CsvImportPlan = {
    totalRows: 0,
    valid: [],
    skipped: 0,
    invalid: 0,
    duplicates: 0,
    issues: [],
  };

  const report = (issue: CsvImportIssue) => {
    if (plan.issues.length < MAX_REPORTED_ISSUES) plan.issues.push(issue);
  };

  body.forEach((cells, i) => {
    const rowNumber = i + 2;
    if (isBlank(cells)) {
      plan.skipped++;
      return;
    }
    plan.totalRows++;

    if (cells.length !== header.length) {
      plan.invalid++;
      report({
        row: rowNumber,
        kind: "invalid",
        reason: `Row has ${cells.length} columns, expected ${header.length} (name,phone,email)`,
      });
      return;
    }

    const name = cells[nameIdx].trim();
    const rawPhone = cells[phoneIdx].trim();
    const email = cells[emailIdx].trim();

    const problems: string[] = [];
    if (!name) problems.push("Name is required");
    else if (name.length < 2 || name.length > 120) {
      problems.push("Name must be 2–120 characters");
    }
    const phone = rawPhone ? normalizeImportPhone(rawPhone) : null;
    if (!rawPhone) problems.push("Phone number is required");
    else if (!phone) problems.push("Invalid phone number (use a 10-digit Indian mobile number)");
    if (!email) problems.push("Email is required");
    else if (email.length > 254 || !emailSchema.safeParse(email).success) {
      problems.push("Invalid email address");
    }

    if (problems.length > 0 || !phone) {
      plan.invalid++;
      report({ row: rowNumber, kind: "invalid", reason: problems.join(", ") });
      return;
    }

    if (known.has(phone)) {
      plan.duplicates++;
      report({ row: rowNumber, kind: "duplicate", reason: "Lead already exists" });
      return;
    }
    const firstRow = seenInFile.get(phone);
    if (firstRow !== undefined) {
      plan.duplicates++;
      report({
        row: rowNumber,
        kind: "duplicate",
        reason: `Duplicate phone number (same as row ${firstRow})`,
      });
      return;
    }

    seenInFile.set(phone, rowNumber);
    plan.valid.push({ row: rowNumber, name, phone, email });
  });

  return plan;
}
