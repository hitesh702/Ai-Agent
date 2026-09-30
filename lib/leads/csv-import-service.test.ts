/**
 * CSV import request/DB tests against the local database.
 * Test users are created with a unique suffix and deleted afterwards.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "../db";
import { ApiError } from "../api/http";
import { CSV_IMPORT_MAX_BYTES } from "./csv-import";
import { handleCsvImportRequest } from "./csv-import-service";

const suffix = `csvimp_${Date.now()}`;
const userIds: string[] = [];
let businessA = "";
let businessB = "";

async function createBusiness(tag: string) {
  const user = await prisma.user.create({
    data: { name: "CSV", email: `csv-${tag}-${suffix}@example.com`, passwordHash: "x" },
  });
  userIds.push(user.id);
  const business = await prisma.business.create({
    data: { ownerId: user.id, name: `CSV ${tag}` },
  });
  return business.id;
}

function upload(text: string, options: { confirm?: boolean; filename?: string } = {}) {
  const form = new FormData();
  form.append("file", new File([text], options.filename ?? "leads.csv", { type: "text/csv" }));
  if (options.confirm) form.append("confirm", "true");
  return new Request("http://localhost/api/leads/import", { method: "POST", body: form });
}

type Envelope = { ok: boolean; error?: string; data?: Record<string, unknown> };

async function send(request: Request, businessId: string) {
  const res = await handleCsvImportRequest(request, async () => businessId);
  return { status: res.status, body: (await res.json()) as Envelope };
}

const leadCount = (businessId: string) => prisma.lead.count({ where: { businessId } });

before(async () => {
  businessA = await createBusiness("a");
  businessB = await createBusiness("b");
  await prisma.lead.create({
    data: { businessId: businessB, name: "Rahul (B)", phone: "+919876543210", email: "b@x.com" },
  });
  await prisma.lead.create({
    data: { businessId: businessA, name: "Existing A", phone: "9811111111", email: "a@x.com" },
  });
});

after(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

const SAMPLE = [
  "name,phone,email",
  "Rahul Sharma,9876543210,rahul@gmail.com",
  "Priya Singh,9123456789,priya@gmail.com",
  "Bad Phone,12345,bad@gmail.com",
  "Existing Again,+91 98111 11111,e@gmail.com",
  "Priya Copy,9123456789,copy@gmail.com",
].join("\n");

describe("CSV import request", () => {
  it("12. rejects an unauthorized request before reading the file", async () => {
    const res = await handleCsvImportRequest(upload(SAMPLE, { confirm: true }), async () => {
      throw new ApiError(401, "Unauthorized");
    });
    assert.equal(res.status, 401);
    assert.equal(await leadCount(businessA), 1);
  });

  it("rejects a missing file, wrong file type, empty file and oversized file", async () => {
    const noFile = new Request("http://localhost/api/leads/import", {
      method: "POST",
      body: new FormData(),
    });
    const cases: [Request, RegExp][] = [
      [noFile, /choose a CSV file/],
      [upload(SAMPLE, { filename: "leads.xlsx" }), /Only \.csv/],
      [upload(""), /empty/],
      [upload("x".repeat(CSV_IMPORT_MAX_BYTES + 1)), /too large/],
      [upload("name,phone\nRahul,9876543210"), /header must be exactly/],
    ];
    for (const [request, message] of cases) {
      const { status, body } = await send(request, businessA);
      assert.equal(status, 400);
      assert.match(body.error ?? "", message);
    }
  });

  it("preview validates and saves nothing", async () => {
    const { status, body } = await send(upload(SAMPLE), businessA);
    assert.equal(status, 200);
    assert.equal(body.data?.confirmed, false);
    assert.equal(body.data?.readyToImport, 2);
    assert.equal(body.data?.imported, 0);
    assert.equal(body.data?.invalid, 1);
    assert.equal(body.data?.duplicates, 2);
    assert.equal((body.data?.validLeads as unknown[]).length, 2);
    assert.equal(await leadCount(businessA), 1);
  });

  it("13. business isolation: B's lead does not block A, and B is untouched", async () => {
    const { body } = await send(upload(SAMPLE), businessA);
    const issues = body.data?.issues as { row: number; reason: string }[];
    assert.ok(!issues.some((i) => i.row === 2), "Rahul exists only in B, so A may import him");
    assert.equal(await leadCount(businessB), 1);
  });

  it("14. confirm saves only the valid rows as NEW CSV leads", async () => {
    const { status, body } = await send(upload(SAMPLE, { confirm: true }), businessA);
    assert.equal(status, 200);
    assert.equal(body.data?.confirmed, true);
    assert.equal(body.data?.imported, 2);

    const leads = await prisma.lead.findMany({
      where: { businessId: businessA, source: "CSV Import" },
      orderBy: { name: "asc" },
    });
    assert.deepEqual(
      leads.map((l) => [l.name, l.phone, l.email, l.status]),
      [
        ["Priya Singh", "+919123456789", "priya@gmail.com", "NEW"],
        ["Rahul Sharma", "+919876543210", "rahul@gmail.com", "NEW"],
      ],
    );
    assert.equal(await leadCount(businessB), 1);
  });

  it("8. re-uploading the same file reports every lead as already existing", async () => {
    const { body } = await send(upload(SAMPLE, { confirm: true }), businessA);
    assert.equal(body.data?.imported, 0);
    assert.equal(body.data?.duplicates, 4);
    assert.equal(await leadCount(businessA), 3);
  });

  it("15. upload never starts calls or campaigns", async () => {
    for (const businessId of [businessA, businessB]) {
      assert.equal(await prisma.call.count({ where: { businessId } }), 0);
      assert.equal(await prisma.campaign.count({ where: { businessId } }), 0);
    }
    const leadIds = (
      await prisma.lead.findMany({ where: { businessId: businessA }, select: { id: true } })
    ).map((l) => l.id);
    assert.equal(await prisma.campaignLead.count({ where: { leadId: { in: leadIds } } }), 0);
  });
});
