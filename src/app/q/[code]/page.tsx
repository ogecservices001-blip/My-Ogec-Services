import { EquipementPublicClient } from "./public-client";

/// Page publique d'un équipement, ouverte SANS connexion en scannant
/// son QR code — voir le format d'URL décidé dans docs/MIGRATION.md §6.
/// Aucun accès Supabase direct ici : tout passe par les Server Actions
/// (actions.ts), qui vérifient côté serveur que l'email saisi est bien
/// connu du site avant de renvoyer quoi que ce soit.
export default async function EquipementPublicPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <EquipementPublicClient codeQr={code} />;
}
