/// Lien "Ajouter à mon calendrier Google" — pas d'intégration API
/// (OAuth) jugée disproportionnée pour l'instant : un simple lien
/// `calendar.google.com/calendar/render` pré-rempli, ouvert dans un
/// nouvel onglet, que le technicien ajoute lui-même en un tap depuis
/// son téléphone Android. Pas d'heure d'été à La Réunion : décalage
/// fixe UTC+4 toute l'année.
const DECALAGE_REUNION_UTC = 4;

function formaterDateUTC(d: Date): string {
  return d.toISOString().replace(/[-:]|\.\d{3}/g, "");
}

export function lienGoogleCalendar(creneau: {
  date: string; // "YYYY-MM-DD"
  heureDebut: string | null; // "HH:mm" ou null
  heuresPrevues: number;
  titre: string;
  lieu: string;
  observations: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: creneau.titre,
    details: creneau.observations,
    location: creneau.lieu,
  });

  if (creneau.heureDebut) {
    const [h, m] = creneau.heureDebut.split(":").map(Number);
    const debutUTC = new Date(`${creneau.date}T00:00:00Z`);
    debutUTC.setUTCHours(h + DECALAGE_REUNION_UTC, m);
    const finUTC = new Date(debutUTC.getTime() + creneau.heuresPrevues * 3_600_000);
    params.set("dates", `${formaterDateUTC(debutUTC)}/${formaterDateUTC(finUTC)}`);
  } else {
    // Pas d'heure précise -> évènement "journée entière" (borne de fin
    // exclusive = lendemain, format YYYYMMDD sans heure).
    const jour = creneau.date.replaceAll("-", "");
    const lendemain = new Date(`${creneau.date}T00:00:00Z`);
    lendemain.setUTCDate(lendemain.getUTCDate() + 1);
    params.set("dates", `${jour}/${lendemain.toISOString().slice(0, 10).replaceAll("-", "")}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
