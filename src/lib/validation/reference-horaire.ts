import { z } from "zod";

const heureSchema = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? 0 : v),
  z.coerce.number({ error: "Nombre invalide." }),
);

export const referenceHoraireSchema = z.object({
  designation: z.string().trim().min(1, "La désignation est obligatoire."),
  type_equipement1: z.string().trim().default(""),
  type_equipement2: z.string().trim().default(""),
  type_equipement3: z.string().trim().default(""),
  hrs_tech_an: heureSchema,
  hrs_assistant_an: heureSchema,
  hrs_tech_sem: heureSchema,
  hrs_assistant_sem: heureSchema,
  hrs_tech_tri: heureSchema,
  hrs_assistant_tri: heureSchema,
  hrs_tech_men: heureSchema,
  hrs_assistant_men: heureSchema,
});
export type ReferenceHoraireInput = z.infer<typeof referenceHoraireSchema>;

export const champsReferenceHoraire: { cle: keyof ReferenceHoraireInput; label: string }[] = [
  { cle: "type_equipement1", label: "Type Equipement 1 (famille)" },
  { cle: "type_equipement2", label: "Type Equipement 2 (sous-type)" },
  { cle: "type_equipement3", label: "Type Equipement 3 (puissance)" },
  { cle: "designation", label: "Désignation" },
  { cle: "hrs_tech_an", label: "Hrs Tech Annuelle" },
  { cle: "hrs_assistant_an", label: "Hrs Assistant Annuelle" },
  { cle: "hrs_tech_sem", label: "Hrs Tech Semestrielle" },
  { cle: "hrs_assistant_sem", label: "Hrs Assistant Semestrielle" },
  { cle: "hrs_tech_tri", label: "Hrs Tech Trimestrielle" },
  { cle: "hrs_assistant_tri", label: "Hrs Assistant Trimestrielle" },
  { cle: "hrs_tech_men", label: "Hrs Tech Mensuelle" },
  { cle: "hrs_assistant_men", label: "Hrs Assistant Mensuelle" },
];
