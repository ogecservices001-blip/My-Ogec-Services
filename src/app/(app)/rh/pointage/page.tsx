import { requireAdmin } from "@/lib/auth";
import { lignesDuMois } from "../actions";
import { PointageVue } from "./vue";

export default async function PointagePage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  await requireAdmin();
  const { mois: brut } = await searchParams;
  const mois = brut && /^\d{4}-(0[1-9]|1[0-2])$/.test(brut) ? brut : new Date().toISOString().slice(0, 7);
  const { lignes, cloture } = await lignesDuMois(mois);
  return <PointageVue key={mois} mois={mois} lignes={lignes} cloture={cloture} />;
}
