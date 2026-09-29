import { requireAdmin } from "@/lib/auth";
import { ImporterEquipementsClient } from "./importer-client";

export default async function ImporterEquipementsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  return <ImporterEquipementsClient siteId={id} />;
}
