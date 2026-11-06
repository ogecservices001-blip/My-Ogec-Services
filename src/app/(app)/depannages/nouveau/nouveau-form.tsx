"use client";

import { useChampManquant, useSignalerRefusServeur } from "@/components/champ-manquant";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerDepannage, modifierDepannage, chargerEquipementsDuSite, type EquipementDuSite } from "./actions";

type Site = {
  id: string;
  nom: string;
  site: string;
  n_affaire: string;
  courriel_interlocuteur_site: string;
  courriel_responsable: string;
  hors_contrat: boolean;
};
type Technicien = { id: string; name: string; portable: string };

export type DepannageInitial = {
  horsContrat: boolean;
  clientNom: string;
  siteId: string;
  equipementId: string;
  message: string;
  lieuPanne: string;
  numeroDemandeClient: string;
  email: string;
  intervenantId: string;
  dateInterventionPrevue: string;
  emailDejaEnvoye: boolean;
};

export function NouveauDepannageForm({
  sites,
  techniciens,
  idDepannage,
  initial,
}: {
  sites: Site[];
  techniciens: Technicien[];
  /// Présent = formulaire en mode édition (met à jour ce dépannage au
  /// lieu d'en créer un nouveau) — même formulaire des deux côtés, pour
  /// que le bureau retrouve exactement l'écran utilisé à la création.
  idDepannage?: string;
  initial?: DepannageInitial;
}) {
  const router = useRouter();
  const action = idDepannage ? modifierDepannage.bind(null, idDepannage) : creerDepannage;
  const [state, formAction, pending] = useActionState(action, null);

  const [type, setType] = useState<"" | "sous" | "hors">(initial ? (initial.horsContrat ? "hors" : "sous") : "");
  const sitesDuPerimetre = useMemo(
    () => (type ? sites.filter((s) => s.hors_contrat === (type === "hors")) : []),
    [sites, type],
  );
  const nomsClients = useMemo(
    () => [...new Set(sitesDuPerimetre.map((s) => s.nom))].sort((a, b) => a.localeCompare(b)),
    [sitesDuPerimetre],
  );
  const [clientNom, setClientNom] = useState(initial?.clientNom ?? "");
  const sitesDuClient = sitesDuPerimetre.filter((s) => s.nom === clientNom);
  const [siteId, setSiteId] = useState(initial?.siteId ?? "");

  function changerType(valeur: "" | "sous" | "hors") {
    setType(valeur);
    setClientNom("");
    definirSiteId("");
  }

  const [equipementsChargees, setEquipementsChargees] = useState<EquipementDuSite[]>([]);
  const [chargementEquipements, startChargementEquipements] = useTransition();
  const equipements = siteId ? equipementsChargees : [];

  // Email du contact pré-rempli avec le "Courriel responsable" connu du
  // site (Répertoire) quand il change — sans écraser une saisie
  // manuelle déjà faite par le bureau (on ne remplace que si le champ
  // est resté tel qu'auto-rempli la fois précédente, ou vide).
  const [email, setEmail] = useState(initial?.email ?? "");
  const dernierAutoRempli = useRef("");

  // La Localisation (enregistrée comme lieu de la panne) restreint la
  // liste d'équipements et se remplit au choix d'un équipement, comme
  // sur Nouveau devis. Le Groupe n'est qu'un filtre, jamais enregistré.
  const [equipementId, setEquipementId] = useState(initial?.equipementId ?? "");
  const [lieuPanne, setLieuPanne] = useState(initial?.lieuPanne ?? "");
  const [groupeFiltre, setGroupeFiltre] = useState("");
  const dernierLieuAutoRempli = useRef("");

  const groupesExistants = [...new Set(equipements.map((eq) => eq.groupe).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
  const equipementsDuGroupe = groupeFiltre ? equipements.filter((eq) => eq.groupe === groupeFiltre) : equipements;
  const localisationsSuggerees = [...new Set(equipementsDuGroupe.map((eq) => eq.localisation).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
  // L'équipement choisi reste toujours dans la liste : absent du select,
  // il serait envoyé vide à l'enregistrement et perdu.
  const equipementsFiltres = equipements.filter(
    (eq) =>
      eq.id === equipementId ||
      (equipementsDuGroupe.includes(eq) &&
        (!lieuPanne.trim() || eq.localisation.toLowerCase().includes(lieuPanne.trim().toLowerCase()))),
  );

  function changerEquipement(id: string) {
    setEquipementId(id);
    const localisation = equipements.find((eq) => eq.id === id)?.localisation ?? "";
    if (localisation) setLieuPanne(localisation);
    else if (lieuPanne === dernierLieuAutoRempli.current) setLieuPanne("");
    dernierLieuAutoRempli.current = localisation;
  }

  function changerGroupeFiltre(groupe: string) {
    setGroupeFiltre(groupe);
    setEquipementId("");
    if (lieuPanne === dernierLieuAutoRempli.current) setLieuPanne("");
    dernierLieuAutoRempli.current = "";
  }

  useEffect(() => {
    if (!siteId) return;
    startChargementEquipements(async () => {
      const data = await chargerEquipementsDuSite(siteId);
      setEquipementsChargees(data);
    });

    const site = sites.find((s) => s.id === siteId);
    const courriel = site?.courriel_interlocuteur_site || site?.courriel_responsable || "";
    setEmail((valeurActuelle) => (valeurActuelle === "" || valeurActuelle === dernierAutoRempli.current ? courriel : valeurActuelle));
    dernierAutoRempli.current = courriel;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sites` est une prop stable (jamais reconstruite en cours de vie du formulaire)
  }, [siteId]);

  useEffect(() => {
    if (state?.ok) {
      router.push("/depannages");
      router.refresh();
    }
  }, [state, router]);

  function definirSiteId(id: string) {
    setSiteId(id);
    setEquipementId("");
    setGroupeFiltre("");
    setLieuPanne("");
    dernierLieuAutoRempli.current = "";
  }

  const { signaler, surChampInvalide, fenetre } = useChampManquant();
  useSignalerRefusServeur(state, signaler);

  /// Au clic, avant les contrôles du navigateur : le site vient en premier.
  function verifierSite(e: React.MouseEvent) {
    const manque: [string, string] | null = !type
      ? ["Choisis le type de client", "depannage-type"]
      : !clientNom
        ? ["Choisis le client", "depannage-client"]
        : !siteId
          ? ["Choisis le site", "depannage-site"]
          : null;
    if (!manque) return;
    e.preventDefault();
    signaler(manque[0], manque[1]);
  }

  function changerClient(nom: string) {
    setClientNom(nom);
    const sitesCorrespondants = sitesDuPerimetre.filter((s) => s.nom === nom);
    definirSiteId(sitesCorrespondants.length === 1 ? sitesCorrespondants[0].id : "");
  }

  return (
    <div>
      <p className="mb-5 text-sm text-slate-500">
        Pour un appel reçu par téléphone/email — l&apos;équipement est optionnel si le client ne sait pas
        précisément lequel est concerné.
      </p>

      {fenetre}
      <form action={formAction} onInvalidCapture={surChampInvalide} className="rounded-2xl bg-white p-5 shadow-sm">
        <input type="hidden" name="site_id" value={siteId} />

        {state && !state.ok && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.erreur}</p>
        )}

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type de client *</label>
              <select
                id="depannage-type"
                value={type}
                onChange={(e) => changerType(e.target.value as "" | "sous" | "hors")}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">— Choisir —</option>
                <option value="sous">Client sous contrat</option>
                <option value="hors">Client hors contrat</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Client *</label>
              <select
                id="depannage-client"
                value={clientNom}
                onChange={(e) => changerClient(e.target.value)}
                disabled={!type}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:bg-slate-50"
              >
                <option value="">— Choisir un client —</option>
                {nomsClients.map((nom) => (
                  <option key={nom} value={nom}>
                    {nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Site *</label>
              <select
                id="depannage-site"
                value={siteId}
                onChange={(e) => definirSiteId(e.target.value)}
                disabled={!clientNom}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:bg-slate-50"
              >
                <option value="">— Choisir un site —</option>
                {sitesDuClient.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.site || "(sans nom de site)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Groupe</label>
              <select
                value={groupeFiltre}
                onChange={(e) => changerGroupeFiltre(e.target.value)}
                disabled={!siteId || groupesExistants.length === 0}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:bg-slate-50"
              >
                <option value="">— tous —</option>
                {groupesExistants.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Localisation</label>
              <input
                name="lieu_panne"
                value={lieuPanne}
                onChange={(e) => setLieuPanne(e.target.value)}
                placeholder="Ex : Bureau 43"
                list="localisations-depannage"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
              {localisationsSuggerees.length > 0 && (
                <datalist id="localisations-depannage">
                  {localisationsSuggerees.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Équipement concerné (facultatif)</label>
              <select
                name="equipement_id"
                value={equipementId}
                onChange={(e) => changerEquipement(e.target.value)}
                disabled={!siteId || chargementEquipements}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:bg-slate-50"
              >
                <option value="">{chargementEquipements ? "Chargement..." : "— aucun —"}</option>
                {equipementsFiltres.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {[eq.nom, eq.numero_equipement].filter(Boolean).join(" — ")}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-bold text-slate-900">Détails de la demande</h2>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Motif de l&apos;appel</label>
            <textarea
              name="message"
              rows={3}
              required
              defaultValue={initial?.message}
              placeholder="Décris la panne rencontrée"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">N° Demande Client</label>
            <input
              name="numero_demande_client"
              defaultValue={initial?.numeroDemandeClient ?? "Pas de référence"}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Email du contact (pour pouvoir lui répondre)
            </label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Pré-rempli avec le courriel responsable du site si connu"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="envoyer_email"
              value="1"
              defaultChecked={!initial?.emailDejaEnvoye}
              disabled={!email}
              className="h-4 w-4 accent-brand-green disabled:opacity-50"
            />
            Envoyer prise en compte par mail
          </label>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <h2 className="mb-3 text-sm font-bold text-slate-900">Affectation</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Intervenant assigné</label>
            <select
              name="intervenant_id"
              defaultValue={initial?.intervenantId ?? ""}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">— Non assigné —</option>
              {techniciens.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Date d&apos;intervention prévue</label>
            <input
              type="date"
              name="date_intervention_prevue"
              defaultValue={initial?.dateInterventionPrevue}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            onClick={verifierSite}
            disabled={pending}
            className="rounded-xl bg-red-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-800 disabled:opacity-60"
          >
            {idDepannage
              ? pending
                ? "Enregistrement..."
                : "Enregistrer"
              : pending
                ? "Création..."
                : "Créer le dépannage"}
          </button>
        </div>
      </form>
    </div>
  );
}
