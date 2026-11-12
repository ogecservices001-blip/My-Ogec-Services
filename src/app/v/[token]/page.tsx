import { chargerDemandePublique } from "./actions";
import { ValidationClient } from "./validation-client";

export const metadata = { title: "Confirmation de passage — OGEC Services" };

export default async function ValidationCreneauPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const demande = await chargerDemandePublique(token);
  return <ValidationClient token={token} demande={demande} />;
}
