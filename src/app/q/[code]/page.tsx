import { createAdminClient } from "@/lib/supabase/admin";
import { chargerEquipementEtSite } from "@/lib/gmao/depannage";
import { EquipementPublicClient } from "./public-client";

export const dynamic = "force-dynamic";

/// Page publique d'un équipement, ouverte SANS connexion en scannant son QR
/// code. Seule son identité (comme une plaque sur la machine) est envoyée
/// au navigateur ; la déclaration de panne vérifie l'adresse côté serveur
/// et la consultation passe par « Mon contrat OGEC ».
export default async function EquipementPublicPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const chargement = await chargerEquipementEtSite(createAdminClient(), code);
  if (!chargement.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          Équipement introuvable. Contactez OGEC Services : ogec.services@orange.fr
        </p>
      </div>
    );
  }
  const { equipement, site, type } = chargement.donnees;
  return (
    <EquipementPublicClient
      codeQr={code}
      identite={{
        equipement: equipement.nom,
        localisation: [equipement.groupe, equipement.localisation].filter(Boolean).join(" — "),
        famille: type ? type.nom : "",
        client: site.nom,
        site: site.site,
      }}
    />
  );
}
