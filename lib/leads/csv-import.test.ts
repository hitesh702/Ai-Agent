import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CSV_IMPORT_MAX_ROWS,
  CsvImportError,
  normalizeImportPhone,
  parseCsv,
  planCsvImport,
} from "./csv-import";

const HEADER = "name,phone,email";
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and BOM", () => {
    const rows = parseCsv('\ufeffname,phone\r\n"Sharma, Ravi","98765 43210"\r\n"Say ""hi""",1\n');
    assert.deepEqual(rows, [
      ["name", "phone"],
      ["Sharma, Ravi", "98765 43210"],
      ['Say "hi"', "1"],
    ]);
  });

  it("rejects unclosed quotes (malformed CSV)", () => {
    assert.throws(() => parseCsv('name,phone\n"Ravi,9876543210'), CsvImportError);
  });
});

describe("normalizeImportPhone", () => {
  it("accepts Indian 10-digit mobiles, with or without +91 / 0", () => {
    assert.equal(normalizeImportPhone("9876543210"), "+919876543210");
    assert.equal(normalizeImportPhone("+91 98765-43210"), "+919876543210");
    assert.equal(normalizeImportPhone("919876543210"), "+919876543210");
    assert.equal(normalizeImportPhone("09876543210"), "+919876543210");
  });

  it("rejects everything else instead of guessing", () => {
    for (const bad of [
      "12345",
      "98765abc10",
      "5876543210",
      "98765432101",
      "+1 415 555 2671",
      "(987) 654-3210",
      "98+76543210",
      "",
    ]) {
      assert.equal(normalizeImportPhone(bad), null, bad);
    }
  });
});

describe("planCsvImport", () => {
  it("1. imports a valid CSV", () => {
    const plan = planCsvImport(
      csv("Rahul Sharma,9876543210,rahul@gmail.com", "Priya Singh,9123456789,priya@gmail.com"),
      [],
    );
    assert.equal(plan.invalid, 0);
    assert.equal(plan.duplicates, 0);
    assert.deepEqual(plan.valid, [
      { row: 2, name: "Rahul Sharma", phone: "+919876543210", email: "rahul@gmail.com" },
      { row: 3, name: "Priya Singh", phone: "+919123456789", email: "priya@gmail.com" },
    ]);
  });

  it("accepts columns in any order and any letter case", () => {
    const plan = planCsvImport("Email,NAME,Phone\nrahul@gmail.com,Rahul,9876543210", []);
    assert.equal(plan.valid[0].name, "Rahul");
  });

  const invalidCases: [string, string, RegExp][] = [
    ["2. missing name", ",9876543210,a@b.com", /Name is required/],
    ["3. missing phone", "Rahul,,a@b.com", /Phone number is required/],
    ["4. missing email", "Rahul,9876543210,", /Email is required/],
    ["5. invalid phone", "Rahul,12345,a@b.com", /Invalid phone number/],
    ["6. invalid email", "Rahul,9876543210,not-an-email", /Invalid email address/],
    ["malformed row", "Rahul,9876543210", /2 columns, expected 3/],
  ];
  for (const [label, row, reason] of invalidCases) {
    it(`${label} → invalid`, () => {
      const plan = planCsvImport(csv(row), []);
      assert.equal(plan.valid.length, 0);
      assert.equal(plan.invalid, 1);
      assert.equal(plan.issues[0].row, 2);
      assert.equal(plan.issues[0].kind, "invalid");
      assert.match(plan.issues[0].reason, reason);
    });
  }

  it("7. flags a duplicate phone inside the CSV, even written differently", () => {
    const plan = planCsvImport(
      csv("Rahul,9876543210,r@x.com", "Rahul Again,+91 98765 43210,r2@x.com"),
      [],
    );
    assert.equal(plan.valid.length, 1);
    assert.equal(plan.duplicates, 1);
    assert.deepEqual(plan.issues[0], {
      row: 3,
      kind: "duplicate",
      reason: "Duplicate phone number (same as row 2)",
    });
  });

  it("8. flags a phone that already exists in the business", () => {
    const plan = planCsvImport(csv("Rahul,9876543210,r@x.com"), ["+919876543210"]);
    assert.equal(plan.valid.length, 0);
    assert.equal(plan.duplicates, 1);
    assert.equal(plan.issues[0].reason, "Lead already exists");
  });

  it("9. handles mixed valid, invalid, duplicate and blank rows without failing", () => {
    const plan = planCsvImport(
      csv(
        "Ravi Kumar,9876543210,ravi@example.com",
        "Asha,+91 91234 56789,asha@example.com",
        ",9000000001,x@example.com",
        "Neha,12345,neha@example.com",
        "Kiran,9123456780,not-an-email",
        "Ravi Again,+919876543210,ravi2@example.com",
        "Existing,9811111111,e@example.com",
        "",
        " , , ",
      ),
      ["98111 11111"],
    );
    assert.equal(plan.totalRows, 7);
    assert.deepEqual(plan.valid.map((r) => r.row), [2, 3]);
    assert.equal(plan.invalid, 3);
    assert.equal(plan.duplicates, 2);
    assert.equal(plan.skipped, 2);
    assert.deepEqual(
      plan.issues.map((i) => [i.row, i.kind]),
      [
        [4, "invalid"],
        [5, "invalid"],
        [6, "invalid"],
        [7, "duplicate"],
        [8, "duplicate"],
      ],
    );
  });

  it("10. rejects an empty CSV", () => {
    for (const text of ["", "\n\n", HEADER, `${HEADER}\n\n , , \n`]) {
      assert.throws(() => planCsvImport(text, []), /empty/, JSON.stringify(text));
    }
  });

  it("11. rejects invalid headers", () => {
    for (const header of ["name,phone", "name,mobile,email", "name,phone,email,city", "Rahul,9876543210,r@x.com"]) {
      assert.throws(
        () => planCsvImport(`${header}\nRahul,9876543210,r@x.com`, []),
        /header must be exactly: name,phone,email/,
        header,
      );
    }
  });

  it("enforces the row limit", () => {
    const body = Array.from(
      { length: CSV_IMPORT_MAX_ROWS + 1 },
      (_, i) => `L${i},9${String(i).padStart(9, "0")},l${i}@x.com`,
    );
    assert.throws(() => planCsvImport(csv(...body), []), /limit/);
  });
});
