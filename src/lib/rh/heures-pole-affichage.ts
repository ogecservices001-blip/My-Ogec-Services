import { labelPole } from "@/lib/bi/constants";
import { POLE_HORS_CLIENT } from "./annuel";

export const MOIS_COURTS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

export function libellePole(pole: string): string {
  return pole === POLE_HORS_CLIENT ? "Hors client" : `${pole} · ${labelPole(pole)}`;
}
