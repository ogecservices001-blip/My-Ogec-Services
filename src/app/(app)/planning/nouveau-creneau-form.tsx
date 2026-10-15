"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { creerCreneau, modifierCreneau, verifierQuota, type PosteHorsClientOption } from "./actions";
import { chargerDevisDuSite, type DevisDuSite, type DevisARealiser } from "@/app/(app)/bi/nouveau/actions";
import type { CreneauAffiche } from "./creneau-carte";

type SiteOption = { id: string; nom: string; site: string; hors_contrat: boolean };
type TechnicienOption = { id: string; name: string };
type SourceClient = "sous_contrat" | "hors_contrat" | "prestation";

export function NouveauCreneauForm({
  sites,
  techniciens,
  postesHorsClient,
  devisARealiser,
  joursFeries,
  dateInitiale,
  technicienInitialId,
  creneauAModifier,
  techniciensDuCreneau,
  onFerme,
}: {
  sites: SiteOption[];
  techniciens: TechnicienOption[];
  postesHorsClient: PosteHorsClientOption[];
  devisARealiser: DevisARealiser[];
  joursFeries: string[];
  dateInitiale?: string;
  technicienInitialId?: string;
  creneauAModifier?: CreneauAffiche & { site_id: string | null; devis_id: string | null };
  techniciensDuCreneau?: string[];
  onFerme: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [typeCreneau, setTypeCreneau] = useState<"intervention" | "hors_client">(
    creneauAModifier?.poste_hors_client_id ? "hors_client" : "intervention",
  );
  const [sourceClient, setSourceClient] = useState<SourceClient>(() => {
    if (creneauAModifier?.devis_id && devisARealiser.some((d) => d.id === creneauAModifier.devis_id)) return "prestation";
    const site = sites.find((s) => s.id === creneauAModifier?.site_id);
    return site?.hors_contrat ? "hors_contrat" : "sous_contrat";
  });
  const [clientNom, setClientNom] = useState(creneauAModifier?.client_nom ?? "");
  const [siteId, setSiteId] = useState(creneauAModifier?.site_id ?? "");
  const [devisId, setDevisId] = useState(creneauAModifier?.devis_id ?? "");
  const [devisDuSite, setDevisDuSite] = useState<DevisDuSite[]>([]);
  const [recherchePrestation, setRecherchePrestation] = useState("");
  const [posteHorsClientId, setPosteHorsClientId] = useState(creneauAModifier?.poste_hors_client_id ?? "");
  const [date, setDate] = useState(creneauAModifier?.date ?? dateInitiale ?? "");
  const [heureDebut, setHeureDebut] = useState(creneauAModifier?.heure_debut ?? "");
  const [heuresPrevues, setHeuresPrevues] = useState(creneauAModifier ? String(creneauAModifier.heures_prevues) : "7.5");
  const [observations, setObservations] = useState(creneauAModifier?.observations ?? "");
  const [technicienIds, setTechnicienIds] = useState<Set<string>>(
    new Set(techniciensDuCreneau ?? (technicienInitialId ? [technicienInitialId] : [])),
  );

  const [erreur, setErreur] = useState<string | null>(null);
  const [alertesQuota, setAlertesQuota] = useState<string[] | null>(null);
  const [confirmationQuota, setConfirmationQuota] = useState(false);

  const sitesSource = useMemo(
    () => sites.filter((s) => s.hors_contrat === (sourceClient === "hors_contrat")),
    [sites, sourceClient],
  );
  const nomsClients = useMemo(() => [...new Set(sitesSource.map((s) => s.nom))].sort((a, b) => a.localeCompare(b)), [sitesSource]);
  const sitesDuClient = sitesSource.filter((s) => s.nom === clientNom);
  const affairesFiltrees = useMemo(
    () =>
      devisARealiser.filter((d) =>
        `${d.client_nom} ${d.client_site} ${d.libelle}`.toLowerCase().includes(recherchePrestation.toLowerCase()),
      ),
    [devisARealiser, recherchePrestation],
  );

  // Jour férié/week-end : bloqué en base uniquement pour une intervention
  // client (voir migration 0040) — un poste hors client (notamment une
  // absence "Férié") doit justement pouvoir y être posé.
  const dateEstJourFerie = typeCreneau === "intervention" && joursFeries.includes(date);
  const dateEstWeekEnd = useMemo(() => {
    if (typeCreneau !== "intervention" || !date) return false;
    const jour = new Date(`${date}T00:00:00`).getDay();
    return jour === 0 || jour === 6;
  }, [date, typeCreneau]);

  useEffect(() => {
    let annule = false;
    async function charger() {
      const devis = siteId && sourceClient !== "prestation" ? await chargerDevisDuSite(siteId) : [];
      if (!annule) setDevisDuSite(devis);
    }
    charger();
    return () => {
      annule = true;
    };
  }, [siteId, sourceClient]);

  function changerSourceClient(source: SourceClient) {
    setSourceClient(source);
    setClientNom("");
    setSiteId("");
    setDevisId("");
  }

  function choisirPrestation(d: DevisARealiser) {
    setClientNom(d.client_nom);
    setSiteId(d.site_id);
    setDevisId(d.id);
  }

  function toggleTechnicien(id: string) {
    setTechnicienIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function construireInput() {
    const site = sites.find((s) => s.id === siteId);
    const poste = postesHorsClient.find((p) => p.id === posteHorsClientId);
    return {
      site_id: typeCreneau === "intervention" ? siteId || null : null,
      devis_id: typeCreneau === "intervention" ? devisId || null : null,
      poste_hors_client_id: typeCreneau === "hors_client" ? posteHorsClientId || null : null,
      client_nom: typeCreneau === "intervention" ? clientNom : (poste?.client ?? ""),
      site: typeCreneau === "intervention" ? (site?.site ?? "") : (poste?.site ?? ""),
      date,
      heure_debut: heureDebut || null,
      heures_prevues: Number(heuresPrevues),
      observations,
      technicien_ids: [...technicienIds],
    };
  }

  async function soumettre() {
    setErreur(null);

    if (typeCreneau === "intervention" && !siteId) {
      setErreur("Le site est obligatoire pour une intervention.");
      return;
    }
    if (typeCreneau === "hors_client" && !posteHorsClientId) {
      setErreur("Le poste hors client est obligatoire.");
      return;
    }
    if (technicienIds.size === 0) {
      setErreur("Au moins un technicien est obligatoire.");
      return;
    }
    if (!date) {
      setErreur("La date est obligatoire.");
      return;
    }
    if (dateEstWeekEnd || dateEstJourFerie) {
      setErreur("Impossible de planifier une intervention client un week-end ou un jour férié.");
      return;
    }

    if (!confirmationQuota) {
      const alertes = await verifierQuota([...technicienIds], date, Number(heuresPrevues), creneauAModifier?.id);
      if (alertes.length > 0) {
        setAlertesQuota(alertes);
        setConfirmationQuota(true);
        return;
      }
    }

    startTransition(async () => {
      const input = construireInput();
      const res = creneauAModifier ? await modifierCreneau(creneauAModifier.id, input) : await creerCreneau(input);
      if (!res.ok) {
        setErreur(res.erreur);
        return;
      }
      router.refresh();
      onFerme();
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{creneauAModifier ? "Modifier le créneau" : "Nouveau créneau"}</h2>
          <button onClick={onFerme} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-4.5 w-4.5" strokeWidth={2} />
          </button>
        </div>

        {erreur && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

        {alertesQuota && confirmationQuota && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {alertesQuota.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
            <p className="mt-1 font-semibold">Continuer quand même ?</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setTypeCreneau("intervention")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${typeCreneau === "intervention" ? "bg-brand-green text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Intervention
            </button>
            <button
              onClick={() => setTypeCreneau("hors_client")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${typeCreneau === "hors_client" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              Poste hors client
            </button>
          </div>

          {typeCreneau === "intervention" ? (
            <>
              <div className="flex gap-1.5 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { v: "sous_contrat", l: "Sous contrat" },
                    { v: "hors_contrat", l: "Hors contrat" },
                    { v: "prestation", l: "Prestation sur commande" },
                  ] as { v: SourceClient; l: string }[]
                ).map((o) => (
                  <button
                    key={o.v}
                    onClick={() => changerSourceClient(o.v)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold ${
                      sourceClient === o.v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>

              {sourceClient === "prestation" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Affaire (devis à réaliser)</label>
                  <input
                    value={recherchePrestation}
                    onChange={(e) => setRecherchePrestation(e.target.value)}
                    placeholder="Rechercher un client, site, devis..."
                    className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
                  />
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
                    {affairesFiltrees.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Aucune affaire à réaliser trouvée</p>}
                    {affairesFiltrees.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => choisirPrestation(d)}
                        className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                          devisId === d.id ? "bg-brand-green/10 font-semibold text-brand-green-dark" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-semibold">{d.numero || "(sans référence)"}</span> — {d.client_nom} — {d.client_site}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Client</label>
                    <select
                      value={clientNom}
                      onChange={(e) => {
                        setClientNom(e.target.value);
                        const correspondants = sitesSource.filter((s) => s.nom === e.target.value);
                        setSiteId(correspondants.length === 1 ? correspondants[0].id : "");
                        setDevisId("");
                      }}
                      className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
                    >
                      <option value="">— Choisir un client —</option>
                      {nomsClients.map((nom) => (
                        <option key={nom} value={nom}>
                          {nom}
                        </option>
                      ))}
                    </select>
                    {sitesDuClient.length > 1 && (
                      <select
                        value={siteId}
                        onChange={(e) => setSiteId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
                      >
                        <option value="">— Choisir un site —</option>
                        {sitesDuClient.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.site || "Site sans nom"}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {siteId && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Affaire (devis, optionnel)</label>
                      <select
                        value={devisId}
                        onChange={(e) => setDevisId(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
                      >
                        <option value="">— Entretien récurrent (pas d&apos;affaire) —</option>
                        {devisDuSite.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.numero || "(sans référence)"} — {d.libelle.slice(0, 40)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Poste hors client</label>
              <select
                value={posteHorsClientId}
                onChange={(e) => setPosteHorsClientId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">— Choisir —</option>
                {postesHorsClient.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.client} — {p.site}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Technicien(s)</label>
            <div className="flex flex-wrap gap-2">
              {techniciens.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTechnicien(t.id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    technicienIds.has(t.id) ? "bg-brand-green text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
              {(dateEstWeekEnd || dateEstJourFerie) && (
                <p className="mt-1 text-[11px] font-semibold text-red-600">
                  {dateEstWeekEnd ? "Week-end" : "Jour férié"} — impossible pour une intervention client.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Heure de début (optionnel)</label>
              <input
                type="time"
                value={heureDebut}
                onChange={(e) => setHeureDebut(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Heures prévues</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={heuresPrevues}
              onChange={(e) => setHeuresPrevues(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Observations</label>
            <textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>

          <button
            onClick={soumettre}
            disabled={pending}
            className="w-full rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-green-dark disabled:opacity-50"
          >
            {pending ? "Enregistrement..." : confirmationQuota ? "Confirmer malgré le dépassement" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
