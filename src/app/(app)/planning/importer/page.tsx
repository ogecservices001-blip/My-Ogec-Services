import { requireAdmin } from "@/lib/auth";
import { ImporterPlanningClient } from "./importer-client";

export default async function ImporterPlanningPage() {
  await requireAdmin();
  return <ImporterPlanningClient />;
}
