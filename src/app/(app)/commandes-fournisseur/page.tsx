import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CommandesFournisseurListe, type CommandeResume } from "./liste";

export default async function CommandesFournisseurPage() {
  await requireAdminOuAccueil();
  const supabase = await createClient();

  const [{ data: commandes }, { data: devis }, { data: fournisseurs }] = await Promise.all([
    supabase.from("commandes_fournisseur").select("*").order("created_at", { ascending: false }),
    supabase.from("devis").select("id, numero, site_id"),
    supabase.from("fournisseurs").select("id, nom"),
  ]);
  const sitesIds = [...new Set((devis ?? []).map((d) => d.site_id))];
  const { data: sites } = sitesIds.length > 0
    ? await supabase.from("sites").select("id, nom, site").in("id", sitesIds)
    : { data: [] };

  const devisParId = new Map((devis ?? []).map((d) => [d.id, d]));
  const siteParId = new Map((sites ?? []).map((s) => [s.id, s]));
  const fournisseurParId = new Map((fournisseurs ?? []).map((f) => [f.id, f.nom]));

  const lignes: CommandeResume[] = (commandes ?? []).map((c) => {
    const d = devisParId.get(c.devis_id);
    const site = d ? siteParId.get(d.site_id) : null;
    return {
      id: c.id,
      numero: c.numero,
      fournisseurNom: fournisseurParId.get(c.fournisseur_id) ?? "",
      devisNumero: d?.numero ?? "",
      clientNom: [site?.nom, site?.site].filter(Boolean).join(" — "),
      dateCommande: c.date_commande,
      lignes: c.lignes,
      tauxTva: c.taux_tva,
      livre: c.livre,
      envoyeeLe: c.envoyee_le,
    };
  });

  return <CommandesFournisseurListe commandes={lignes} />;
}
