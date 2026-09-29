import { z } from "zod";

export const equipementSchema = z.object({
  site_id: z.uuid(),
  type_equipement_id: z.string().trim().min(1, "La famille est obligatoire."),
  nom: z.string().trim().min(1, "Le nom est obligatoire."),
  numero_equipement: z.string().trim().default(""),
  localisation: z.string().trim().default(""),
  groupe: z.string().trim().default(""),
});
export type EquipementInput = z.infer<typeof equipementSchema>;
