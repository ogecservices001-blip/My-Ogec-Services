/// Étiquettes "1/N, 2/N..." représentant toutes les visites prévues
/// dans l'année pour une fréquence d'entretien donnée — celle qui est
/// la prochaine à faire (fréquence courante) est surlignée en bleu.
/// Port de visite_chips.dart.
export function VisiteChips({ freqAnnuelle, freqCourante }: { freqAnnuelle: number; freqCourante: number }) {
  if (freqAnnuelle <= 0) return null;
  const courante = ((freqCourante - 1) % freqAnnuelle) + 1;

  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: freqAnnuelle }, (_, i) => i + 1).map((i) => (
        <span
          key={i}
          className={`rounded-md px-1.5 py-0.5 text-[11px] ${
            i === courante ? "bg-blue-100 font-bold text-blue-800" : "bg-slate-100 text-slate-500"
          }`}
        >
          {i}/{freqAnnuelle}
        </span>
      ))}
    </div>
  );
}
