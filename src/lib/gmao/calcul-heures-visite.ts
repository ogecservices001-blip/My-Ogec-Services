import type { Equipement, ReferenceHoraire } from "./types";
import { trouverReferenceExacte } from "./suggestion-reference-horaire";

export type HeuresVisite = { heuresTech: number; heuresAssistant: number };

function additionner(a: HeuresVisite, b: HeuresVisite): HeuresVisite {
  return { heuresTech: a.heuresTech + b.heuresTech, heuresAssistant: a.heuresAssistant + b.heuresAssistant };
}

/// Heures prévues (total annuel complet) / déjà effectuées / restant à
/// faire, cumulées sur un ensemble d'équipements.
export type HeuresAnnee = { prevues: HeuresVisite; effectuees: HeuresVisite; restantes: HeuresVisite };

/// Calcule les heures Tech/Assistant prévues pour la visite en cours,
/// selon la séquence : une visite "Annuelle" toujours en 1ère position,
/// puis en alternance selon la fréquence (1, 2 ou 4 visites/an).
/// `null` si la fréquence/visite en cours n'est pas reconnue. Port
/// fidèle de `calculerHeuresVisite` (calcul_heures_visite.dart).
export function calculerHeuresVisite(
  freqEntretienAnnuelle: number,
  freqCourante: number,
  reference: ReferenceHoraire,
): HeuresVisite | null {
  const courante = freqEntretienAnnuelle > 0 ? ((freqCourante - 1) % freqEntretienAnnuelle) + 1 : freqCourante;

  switch (freqEntretienAnnuelle) {
    case 1:
      return courante === 1 ? { heuresTech: reference.hrs_tech_an, heuresAssistant: reference.hrs_assistant_an } : null;
    case 2:
      if (courante === 1) return { heuresTech: reference.hrs_tech_an, heuresAssistant: reference.hrs_assistant_an };
      if (courante === 2) return { heuresTech: reference.hrs_tech_sem, heuresAssistant: reference.hrs_assistant_sem };
      return null;
    case 4:
      if (courante === 1) return { heuresTech: reference.hrs_tech_an, heuresAssistant: reference.hrs_assistant_an };
      if (courante === 2) return { heuresTech: reference.hrs_tech_tri, heuresAssistant: reference.hrs_assistant_tri };
      if (courante === 3) return { heuresTech: reference.hrs_tech_sem, heuresAssistant: reference.hrs_assistant_sem };
      if (courante === 4) return { heuresTech: reference.hrs_tech_tri, heuresAssistant: reference.hrs_assistant_tri };
      return null;
    default:
      return null;
  }
}

/// Heures cumulées de TOUTES les visites prévues dans l'année pour un
/// équipement — indépendant de la visite en cours. `null` si la
/// fréquence n'est pas reconnue (1/2/4).
export function heuresCumulAnnee(freqEntretienAnnuelle: number, reference: ReferenceHoraire): HeuresVisite | null {
  let total: HeuresVisite = { heuresTech: 0, heuresAssistant: 0 };
  let trouve = false;
  for (let i = 1; i <= freqEntretienAnnuelle; i++) {
    const h = calculerHeuresVisite(freqEntretienAnnuelle, i, reference);
    if (h) {
      total = additionner(total, h);
      trouve = true;
    }
  }
  return trouve ? total : null;
}

/// Heures des visites déjà effectuées cette année (positions 1 à
/// `freqCourante - 1`, avant la visite en cours).
export function heuresEffectueesEquipement(
  freqEntretienAnnuelle: number,
  freqCourante: number,
  reference: ReferenceHoraire,
): HeuresVisite {
  let total: HeuresVisite = { heuresTech: 0, heuresAssistant: 0 };
  for (let k = 1; k < freqCourante; k++) {
    const h = calculerHeuresVisite(freqEntretienAnnuelle, k, reference);
    if (h) total = additionner(total, h);
  }
  return total;
}

function positif(v: number): number {
  return v < 0 ? 0 : v;
}

/// Additionne heures prévues/effectuées/restantes de tous les
/// équipements dont la fréquence est renseignée — pour les compteurs
/// par groupe/site. La référence de chaque équipement est recalculée
/// en direct depuis Type Equipement 1/2/3 (jamais depuis
/// `reference_horaire_id` stocké). `freqCouranteParEquipement` vient de
/// `freqCouranteCalculeeBatch` (un seul aller-retour réseau pour tous
/// les équipements, plutôt qu'un appel par équipement comme dans
/// `sommeHeuresAnnee` côté Flutter). Port fidèle du calcul lui-même.
export function sommeHeuresAnnee(
  equipements: Equipement[],
  references: ReferenceHoraire[],
  freqCouranteParEquipement: Map<string, number | null>,
): HeuresAnnee {
  let prevues: HeuresVisite = { heuresTech: 0, heuresAssistant: 0 };
  let effectuees: HeuresVisite = { heuresTech: 0, heuresAssistant: 0 };

  for (const eq of equipements) {
    const reference = trouverReferenceExacte(eq.champs_en_tete, references);
    if (!reference) continue;
    const freqBrut = eq.champs_en_tete.freqEntretienAnnuelle;
    const freqAnnuelle = typeof freqBrut === "string" ? parseInt(freqBrut, 10) : NaN;
    if (!Number.isFinite(freqAnnuelle)) continue;
    const freqCourante = freqCouranteParEquipement.get(eq.id);
    if (freqCourante === null || freqCourante === undefined) continue;

    const cumul = heuresCumulAnnee(freqAnnuelle, reference);
    if (cumul) prevues = additionner(prevues, cumul);
    effectuees = additionner(effectuees, heuresEffectueesEquipement(freqAnnuelle, freqCourante, reference));
  }

  return {
    prevues,
    effectuees,
    restantes: {
      heuresTech: positif(prevues.heuresTech - effectuees.heuresTech),
      heuresAssistant: positif(prevues.heuresAssistant - effectuees.heuresAssistant),
    },
  };
}
