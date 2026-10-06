import { requireAdmin } from "@/lib/auth";
import { ImporterDevisClient } from "./importer-devis";

export default async function ImporterDevisPage() {
  await requireAdmin();
  return <ImporterDevisClient />;
}
