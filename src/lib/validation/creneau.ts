import { z } from "zod";

/// Validation d'un créneau de planning — un créneau "intervention" doit
/// avoir un site (et éventuellement un devis = affaire sur devis) ; un
/// créneau "absence" n'a ni site ni devis, juste un motif libre. Au
/// moins un technicien est obligatoire dans les deux cas (un créneau
/// sans personne assignée n'a pas de sens).
export const creneauSchema = z
  .object({
    type_creneau: z.enum(["intervention", "absence"]),
    site_id: z.string().uuid().nullable(),
    devis_id: z.string().uuid().nullable(),
    client_nom: z.string().trim().default(""),
    site: z.string().trim().default(""),
    motif_absence: z.string().trim().default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    heure_debut: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable(),
    heures_prevues: z.coerce.number().positive("Les heures prévues doivent être supérieures à 0"),
    observations: z.string().trim().default(""),
    technicien_ids: z.array(z.string().uuid()).min(1, "Au moins un technicien est obligatoire"),
  })
  .refine((v) => v.type_creneau !== "intervention" || !!v.site_id, {
    message: "Le site est obligatoire pour une intervention",
    path: ["site_id"],
  });

export type CreneauInput = z.infer<typeof creneauSchema>;
