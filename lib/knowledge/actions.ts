"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/workspace";
import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge/categories";

export type KnowledgeActionState = {
  error?: string;
  success?: boolean;
};

async function requireOwnedBusiness() {
  const session = await requireSession();
  const business = await prisma.business.findFirst({
    where: { id: session.businessId, ownerId: session.userId },
  });
  if (!business) redirect("/login");
  return business;
}

const saveSchema = z.object({
  businessName: z.string().trim().min(2, "Business name is required"),
  courses: z.string().optional(),
  fees: z.string().optional(),
  duration: z.string().optional(),
  batchTiming: z.string().optional(),
  location: z.string().optional(),
  contact: z.string().optional(),
  offers: z.string().optional(),
  faqs: z.string().optional(),
  policies: z.string().optional(),
});

function optionalText(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

const FIELD_TO_CATEGORY: Record<string, (typeof KNOWLEDGE_CATEGORIES)[number]["key"]> =
  {
    courses: "COURSES",
    fees: "FEES",
    duration: "DURATION",
    batchTiming: "BATCH_TIMING",
    location: "LOCATION",
    contact: "CONTACT",
    offers: "OFFERS",
    faqs: "FAQS",
    policies: "POLICIES",
  };

export async function saveBusinessKnowledgeAction(
  _prev: KnowledgeActionState,
  formData: FormData,
): Promise<KnowledgeActionState> {
  const business = await requireOwnedBusiness();

  const parsed = saveSchema.safeParse({
    businessName: formData.get("businessName"),
    courses: optionalText(formData.get("courses")),
    fees: optionalText(formData.get("fees")),
    duration: optionalText(formData.get("duration")),
    batchTiming: optionalText(formData.get("batchTiming")),
    location: optionalText(formData.get("location")),
    contact: optionalText(formData.get("contact")),
    offers: optionalText(formData.get("offers")),
    faqs: optionalText(formData.get("faqs")),
    policies: optionalText(formData.get("policies")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;

  await prisma.business.update({
    where: { id: business.id },
    data: {
      name: data.businessName,
      ...(data.location ? { address: data.location } : {}),
    },
  });

  const categoryMeta = Object.fromEntries(
    KNOWLEDGE_CATEGORIES.map((c) => [c.key, c]),
  );

  for (const [field, categoryKey] of Object.entries(FIELD_TO_CATEGORY)) {
    const content = (data as Record<string, string>)[field]?.trim() ?? "";
    const meta = categoryMeta[categoryKey];
    if (!meta) continue;

    const existing = await prisma.businessKnowledge.findFirst({
      where: {
        businessId: business.id,
        category: categoryKey,
        title: meta.title,
      },
    });

    if (!content) {
      if (existing) {
        await prisma.businessKnowledge.update({
          where: { id: existing.id },
          data: { active: false, content: "" },
        });
      }
      continue;
    }

    if (existing) {
      await prisma.businessKnowledge.update({
        where: { id: existing.id },
        data: { content, active: true },
      });
    } else {
      await prisma.businessKnowledge.create({
        data: {
          businessId: business.id,
          category: categoryKey,
          title: meta.title,
          content,
          active: true,
        },
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/knowledge");
  revalidatePath("/dashboard/business");
  revalidatePath("/dashboard/agents");
  return { success: true };
}

export async function listKnowledgeForWorkspace() {
  const business = await requireOwnedBusiness();
  const items = await prisma.businessKnowledge.findMany({
    where: { businessId: business.id },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
  });
  return { business, items };
}
