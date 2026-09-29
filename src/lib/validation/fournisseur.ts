import { z } from "zod";

const optionnel = () => z.string().trim().default("");

export const fournisseurSchema = z.object({
  nom: z.string().trim().min(1, "Le nom du fournisseur est obligatoire"),
  denomination_courte: optionnel(),
  interlocuteurs: optionnel(),
  tel: optionnel(),
  portable: optionnel(),
  courriel: optionnel(),
  site_web: optionnel(),
  commune: optionnel(),
  code_postal: optionnel(),
  adresse: optionnel(),
  complement_adresse: optionnel(),
  produits_cles: optionnel(),
  remarques: optionnel(),
});

export type FournisseurInput = z.infer<typeof fournisseurSchema>;

export const champsFournisseur: { cle: keyof FournisseurInput; label: string }[] = [
  { cle: "nom", label: "Nom" },
  { cle: "denomination_courte", label: "Dénomination courte" },
  { cle: "interlocuteurs", label: "Interlocuteurs" },
  { cle: "tel", label: "Tél fixe" },
  { cle: "portable", label: "Portable" },
  { cle: "courriel", label: "Courriel" },
  { cle: "site_web", label: "Site web" },
  { cle: "commune", label: "Commune" },
  { cle: "code_postal", label: "Code postal" },
  { cle: "adresse", label: "Adresse" },
  { cle: "complement_adresse", label: "Complément d'adresse" },
  { cle: "produits_cles", label: "Produits clés" },
  { cle: "remarques", label: "Remarques" },
];
