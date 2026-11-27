import { createAdminClient } from "@/lib/supabase/admin";

export type SourceIncident = "gmao_bi" | "archive_bi" | "mail" | "notification" | "relance_auto";

export const LIBELLE_SOURCE_INCIDENT: Record<SourceIncident, string> = {
  gmao_bi: "Mise à jour GMAO",
  archive_bi: "Archivage PDF du BI",
  mail: "Mail non envoyé",
  notification: "Notification non envoyée",
  relance_auto: "Relance automatique",
};

export function messageErreur(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/// Journal des erreurs du bureau (page « Erreurs à traiter ») : tout ce qui
/// échoue en arrière-plan sans bloquer l'action en cours. Client admin :
/// l'erreur peut venir d'un visiteur non connecté (QR, lien client) ou d'une
/// tâche automatique. Ne lève jamais d'erreur.
export async function signalerIncident(params: {
  source: SourceIncident;
  titre: string;
  detail?: string;
  objetType?: string;
  objetId?: string | null;
  lien?: string;
}): Promise<void> {
  try {
    await createAdminClient()
      .from("incidents")
      .insert({
        source: params.source,
        titre: params.titre.slice(0, 300),
        detail: (params.detail ?? "").slice(0, 4000),
        objet_type: params.objetType ?? "",
        objet_id: params.objetId ?? null,
        lien: params.lien ?? "",
      });
  } catch (e) {
    console.error("Incident non enregistré", params.titre, e);
  }
}
