"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { creerDepannage, chargerEquipementsDuSite, type EquipementDuSite } from "./actions";

type Site = { id: string; nom: string; site: string; n_affaire: string; courriel_responsable: string };
type Technicien = { id: string; name: string; portable: string };

export function NouveauDepannageForm({ sites, techniciens }: { sites: Site[]; techniciens: Technicien[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(creerDepannage, null);

  const nomsClients = useMemo(() => [...new Set(sites.map((s) => s.nom))].sort((a, b) => a.localeCompare(b)), [sites]);
  const [clientNom, setClientNom] = useState("");
  const sitesDuClient = sites.filter((s) => s.nom === clientNom);
  const [siteId, setSiteId] = useState("");

  const [equipementsChargees, setEquipementsChargees] = useState<EquipementDuSite[]>([]);
  const [chargementEquipements, startChargementEquipements] = useTransition();
  const equipements = siteId ? equipementsChargees : [];

  // Email du contact pré-rempli avec le "Courriel responsable" connu du
  // site (Répertoire) quand il change — sans écraser une saisie
  // manuelle déjà faite par le bureau (on ne remplace que si le champ
  // est resté tel qu'auto-rempli la fois précédente, ou vide).
  const [email, setEmail] = useState("");
  const dernierAutoRempli = useRef("");

  useEffect(() => {
    if (!siteId) return;
    startChargementEquipements(async () => {
      const data = await chargerEquipementsDuSite(siteId);
      setEquipementsChargees(data);
    });

    const site = sites.find((s) => s.id === siteId);
    const courriel = site?.courriel_responsable ?? "";
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

  function changerClient(nom: string) {
    setClientNom(nom);
    const sitesCorrespondants = sites.filter((s) => s.nom === nom);
    setSiteId(sitesCorrespondants.length === 1 ? sitesCorrespondants[0].id : "");
  }

  return (
    <div>
      <Link
        href="/depannages"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2.5} />
        Retour
      </Link>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Créer un dépannage</h1>
      <p className="mb-5 text-sm text-slate-500">
        Pour un appel reçu par téléphone/email — l&apos;équipement est optionnel si le client ne sait pas
        précisément lequel est concerné.
      </p>

      <form action={formAction}>
        <input type="hidden" name="site_id" value={siteId} />

        {state && !state.ok && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.erreur}</p>
        )}

        <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Client</label>
            <select
              value={clientNom}
              onChange={(e) => changerClient(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            >
              <option value="">— Choisir un client —</option>
              {nomsClients.map((nom) => (
                <option key={nom} value={nom}>
                  {nom}
                </option>
              ))}
            </select>
          </div>

          {sitesDuClient.length > 1 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Site</label>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              >
                <option value="">— Choisir un site —</option>
                {sitesDuClient.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.site || "Site sans nom"} ({s.n_affaire})
                  </option>
                ))}
              </select>
            </div>
          )}

          {siteId && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Équipement (optionnel)
              </label>
              <select
                name="equipement_id"
                disabled={chargementEquipements}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 disabled:bg-slate-50"
              >
                <option value="">
                  {chargementEquipements ? "Chargement..." : "— Non précisé —"}
                </option>
                {equipements.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {[eq.nom, eq.numero_equipement, eq.localisation].filter(Boolean).join(" — ")}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Motif de l&apos;appel</label>
            <textarea
              name="message"
              rows={3}
              required
              placeholder="Décris la panne rencontrée"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Lieu de la panne</label>
            <input
              name="lieu_panne"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">N° Demande Client</label>
            <input
              name="numero_demande_client"
              defaultValue="Pas de référence"
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
              defaultChecked
              disabled={!email}
              className="h-4 w-4 accent-brand-green disabled:opacity-50"
            />
            Envoyer prise en compte par mail
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Intervenant assigné</label>
            <select
              name="intervenant_id"
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
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={pending || !siteId}
            className="rounded-xl bg-red-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-red-800 disabled:opacity-60"
          >
            {pending ? "Création..." : "Créer le dépannage"}
          </button>
        </div>
      </form>
    </div>
  );
}
