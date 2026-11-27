import { BoutonConnexion } from "./bouton-connexion";

/// Le lien reçu par mail n'est consommé qu'au clic sur « Se connecter » :
/// l'aperçu automatique d'un lien par une messagerie ne le grille pas.
export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">Bienvenue sur Mon contrat OGEC</h1>
      <p className="mt-2 text-sm text-slate-600">Cliquez ci-dessous pour ouvrir votre espace sur cet appareil.</p>
      <BoutonConnexion jeton={t ?? ""} />
    </div>
  );
}
