import { requireAdmin } from "@/lib/auth";
import { ImporterFournisseursClient } from "./importer-client";

export default async function ImporterFournisseursPage() {
  await requireAdmin();
  return <ImporterFournisseursClient />;
}
