export const KNOWLEDGE_CATEGORIES = [
  {
    key: "COURSES",
    title: "Courses",
    label: "Courses",
    placeholder:
      "e.g. JEE Main/Advanced foundation, NEET, Board crash course — list what you offer",
    rows: 4,
  },
  {
    key: "FEES",
    title: "Fees",
    label: "Fees",
    placeholder: "e.g. JEE full year ₹X, NEET ₹Y — only amounts you approve the AI to say",
    rows: 3,
  },
  {
    key: "DURATION",
    title: "Duration",
    label: "Duration",
    placeholder: "e.g. 1 year, 6 months, weekend batch length",
    rows: 2,
  },
  {
    key: "BATCH_TIMING",
    title: "Batch timing",
    label: "Batch timing",
    placeholder: "e.g. Morning 7–10 AM, Evening 5–8 PM, Weekend batches",
    rows: 3,
  },
  {
    key: "LOCATION",
    title: "Location",
    label: "Location",
    placeholder: "Full address / city / landmark the AI may share",
    rows: 2,
  },
  {
    key: "CONTACT",
    title: "Contact information",
    label: "Contact information",
    placeholder: "Phone, WhatsApp, email the AI may share",
    rows: 2,
  },
  {
    key: "OFFERS",
    title: "Offers",
    label: "Offers",
    placeholder: "Current discounts or scholarships — leave blank if none",
    rows: 3,
  },
  {
    key: "FAQS",
    title: "FAQs",
    label: "FAQs",
    placeholder: "Q: …\nA: …\n(only answers you approve)",
    rows: 6,
  },
  {
    key: "POLICIES",
    title: "Policies",
    label: "Policies",
    placeholder: "Refund, attendance, trial class rules — only what AI may state",
    rows: 4,
  },
] as const;

export type KnowledgeCategoryKey = (typeof KNOWLEDGE_CATEGORIES)[number]["key"];

/** Map stored rows into form defaults by category key. */
export function knowledgeItemsToFormValues(
  items: Array<{
    category: string;
    title: string;
    content: string;
    active: boolean;
  }>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const cat of KNOWLEDGE_CATEGORIES) {
    const match = items.find(
      (i) => i.category === cat.key && i.title === cat.title && i.active,
    );
    values[cat.key] = match?.content ?? "";
  }
  return values;
}
