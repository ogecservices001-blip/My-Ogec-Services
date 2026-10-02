import { z } from "zod";

const optionnel = () => z.string().trim().default("");

export const profilSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire"),
  qualite: optionnel(),
  portable: optionnel(),
  email_perso: optionnel(),
  commune_habitation: optionnel(),
  vehicule: optionnel(),
});

export type ProfilInput = z.infer<typeof profilSchema>;
