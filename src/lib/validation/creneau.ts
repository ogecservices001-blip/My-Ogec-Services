import { z } from "zod";

/// Validation d'un créneau de planning — soit une intervention client
/// (site obligatoire, devis optionnel = affaire sur devis), soit un
/// poste hors client (formation, bureau, absence... voir migration
/// 0040) — jamais les deux, jamais aucun des deux. Au moins un
/// technicien est obligatoire dans les deux cas.
export const creneauSchema = z
  .object({
    site_id: z.string().uuid().nullable(),
    devis_id: z.string().uuid().nullable(),
    poste_hors_client_id: z.string().uuid().nullable(),
    client_nom: z.string().trim().default(""),
    site: z.string().trim().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    heure_debut: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    heures_prevues: z.coerce.number().positive("Les heures prévues doivent être supérieures à 0"),
    observations: z.string().trim().default(""),
    technicien_ids: z.array(z.string().uuid()).min(1, "Au moins un technicien est obligatoire"),
  })
  .refine((v) => !!v.site_id !== !!v.poste_hors_client_id, {
    message: "Choisis soit un site, soit un poste hors client",
    path: ["site_id"],
  });

export type CreneauInput = z.infer<typeof creneauSchema>;
