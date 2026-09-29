/// URL publique (sans connexion) d'un équipement, encodée dans son QR
/// code — format décidé dans docs/MIGRATION.md §6 : court, indépendant
/// de Firebase, jamais l'ancienne URL `.../equipement/{id}`.
export function urlPubliqueEquipement(codeQr: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/q/${codeQr}`;
}
