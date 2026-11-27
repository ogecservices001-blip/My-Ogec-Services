import { createAdminClient } from "@/lib/supabase/admin";
import { Poles } from "@/lib/bi/constants";
import { STATUTS_BI_VALIDES } from "@/lib/facturation/ca-facturable";

type Admin = ReturnType<typeof createAdminClient>;

/// Ce que « Mon contrat OGEC » montre d'un site : uniquement des données
/// destinées au client (aucune note interne, heure de contrat ni montant).

export function aujourdhuiReunion(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Indian/Reunion" }).format(new Date());
}

function isoDepuisFr(d: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export type Passage = {
  id: string;
  date: string;
  heure: string;
  objet: string;
  /// attente = à confirmer par le client (avec le lien), valide, autre_date.
  validation: { statut: string; lien: string | null } | null;
};

export async function prochainsPassages(admin: Admin, siteId: string): Promise<Passage[]> {
  const [{ data: creneaux }, { data: demandes }] = await Promise.all([
    admin
      .from("creneaux_planning")
      .select("id, date, heure_debut, visite_numero, visite_total, devis_id")
      .eq("site_id", siteId)
      .eq("annule", false)
      .gte("date", aujourdhuiReunion())
      .order("date")
      .limit(8),
    admin
      .from("demandes_validation_client")
      .select("creneau_ids, statut, token, envoye_le")
      .eq("site_id", siteId)
      .in("statut", ["attente", "valide", "autre_date"])
      .order("envoye_le", { ascending: false }),
  ]);
  const validationParCreneau = new Map<string, { statut: string; lien: string | null }>();
  for (const d of demandes ?? []) {
    for (const id of (d.creneau_ids as string[] | null) ?? []) {
      if (validationParCreneau.has(id)) continue;
      validationParCreneau.set(id, { statut: d.statut, lien: d.statut === "attente" ? `/v/${d.token}` : null });
    }
  }
  return (creneaux ?? []).map((c) => ({
    id: c.id,
    date: c.date,
    heure: c.heure_debut ? String(c.heure_debut).slice(0, 5).replace(":", "h") : "",
    objet: c.visite_numero
      ? `Visite d'entretien ${c.visite_numero}${c.visite_total ? ` de ${c.visite_total}` : ""}`
      : c.devis_id
        ? "Intervention sur devis"
        : "Intervention",
    validation: validationParCreneau.get(c.id) ?? null,
  }));
}

export type VisiteRealisee = {
  biId: string;
  numero: string;
  date: string;
  visite: string;
  annee: number | null;
  visiteNumero: number | null;
  visiteTotal: number | null;
};

/// Visites d'entretien validées par le bureau, la plus récente d'abord.
export async function visitesRealisees(admin: Admin, siteId: string): Promise<VisiteRealisee[]> {
  const { data: bons } = await admin
    .from("bons_intervention")
    .select("id, numero, date_debut, date_fin, date_intervention, visite_numero, visite_total, visite_annee")
    .eq("site_id", siteId)
    .eq("pole", Poles.entretienSousContrat)
    .in("statut", STATUTS_BI_VALIDES);
  return (bons ?? [])
    .map((b) => ({
      biId: b.id,
      numero: b.numero,
      date: isoDepuisFr(b.date_fin || b.date_intervention || b.date_debut),
      visite: b.visite_numero ? `Visite ${b.visite_numero}${b.visite_total ? ` de ${b.visite_total}` : ""}` : "Visite d'entretien",
      annee: b.visite_annee,
      visiteNumero: b.visite_numero,
      visiteTotal: b.visite_total,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/// « 2 visites réalisées sur 4 en 2026 », d'après les BI d'entretien validés.
export function avancementAnnee(visites: VisiteRealisee[], annee: number): { faites: number; total: number | null } {
  const delAnnee = visites.filter((v) => v.annee === annee);
  const faites = new Set(delAnnee.map((v) => v.visiteNumero).filter((n): n is number => n !== null)).size;
  const total = delAnnee.reduce<number | null>((m, v) => (v.visiteTotal && (m === null || v.visiteTotal > m) ? v.visiteTotal : m), null);
  return { faites, total };
}
