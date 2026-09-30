import { requireApiBusiness } from "@/lib/api/http";
import { handleCsvImportRequest } from "@/lib/leads/csv-import-service";

export async function POST(request: Request) {
  return handleCsvImportRequest(request, async () => {
    const { business } = await requireApiBusiness();
    return business.id;
  });
}
