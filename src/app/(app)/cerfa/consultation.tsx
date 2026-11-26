"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FileText, Send, PlusCircle } from "lucide-react";
import { ChoixClientSite } from "@/components/choix-client-site";
import { ListeRecherche, type OptionRecherche } from "@/components/liste-recherche";
import { useChampManquant } from "@/components/champ-manquant";
import { BasculeContrat } from "./bascule-contrat";
import { cleReference, statutSoumission, texteChamp } from "@/lib/cerfa/regles";
import { chargerCerfasEquipement, chargerEquipementsCerfa, envoyerCerfaParEmail, type CerfaResume, type EquipementCerfa } from "./actions";

export type SiteConsultation = {
  id: string;
  nom: string;
  site: string;
  n_affaire: string;
  adresse: string;
  complement_adresse: string;
  code_postal: string;
  commune: string;
  signataires: { nom: string; qualite: string; email: string }[];
};

export type ModeConsultation = "equipement" | "bordereau" | "envoyer";

const TITRES: Record<ModeConsultation, string> = {
  equipement: "Visualiser un équipement",
  bordereau: "Visualiser un bordereau",
  envoyer: "Envoyer un CERFA rempli",
};

const CARTE = "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm";
const TITRE = "mb-3 text-sm font-bold uppercase tracking-wide text-indigo-700";
const CHAMP = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-600";

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex gap-3 py-0.5 text-sm">
      <span className="w-48 shrink-0 font-medium text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-800">{valeur || "—"}</span>
    </div>
  );
}

const fr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

export function ConsultationCerfa({
  sites,
  mode,
  horsContrat,
  base,
}: {
  sites: SiteConsultation[];
  mode: ModeConsultation;
  horsContrat: boolean;
  base: string;
}) {
  const { signaler, fenetre } = useChampManquant();
  const [clientNom, setClientNom] = useState("");
  const [siteId, setSiteId] = useState("");
  const [equipements, setEquipements] = useState<EquipementCerfa[]>([]);
  const [equipementId, setEquipementId] = useState("");
  const [cerfas, setCerfas] = useState<CerfaResume[] | null>(null);
  const [envoi, setEnvoi] = useState<{ cerfa: CerfaResume; email: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const site = sites.find((s) => s.id === siteId);
  const equipement = equipements.find((e) => e.id === equipementId);

  const siteDemande = useRef("");
  const equipementDemande = useRef("");

  function changerSite(id: string) {
    setSiteId(id);
    setEquipements([]);
    choisirEquipement("");
    siteDemande.current = id;
    if (id) chargerEquipementsCerfa(id).then((l) => siteDemande.current === id && setEquipements(l));
  }

  function choisirEquipement(id: string) {
    setEquipementId(id);
    setCerfas(null);
    equipementDemande.current = id;
    if (id) chargerCerfasEquipement(id).then((l) => equipementDemande.current === id && setCerfas(l));
  }

  const options: OptionRecherche[] = equipements.map((e) => {
    const statut = statutSoumission(e.champs_en_tete);
    return {
      valeur: e.id,
      label: e.nom,
      detail: [e.numero_equipement, statut === "charge_inconnue" ? "charge à relever" : statut === "non_soumis" ? "≤ 2 kg" : ""].filter(Boolean).join(" — "),
    };
  });

  async function envoyer() {
    if (!envoi) return;
    if (!envoi.email.trim()) return signaler("Renseigne l'adresse destinataire", "email-dest");
    setEnCours(true);
    const r = await envoyerCerfaParEmail(envoi.cerfa.id, envoi.email.split(/[;,]/));
    setEnCours(false);
    if (!r.ok) return signaler("Mail non envoyé", "email-dest", { detail: r.erreur });
    setEnvoi(null);
    if (equipementId) setCerfas(await chargerCerfasEquipement(equipementId));
    signaler(`CERFA envoyé à ${envoi.email}`);
  }

  const c = equipement?.champs_en_tete ?? {};

  return (
    <div>
      {fenetre}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
            {TITRES[mode]} — Clients {horsContrat ? "hors contrat" : "sous contrat"}
          </h1>
          <p className="text-sm text-slate-500">
            {new Set(sites.map((s) => s.nom)).size} client(s) — {sites.length} site(s)
          </p>
        </div>
        <BasculeContrat base={base} horsContrat={horsContrat} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className={CARTE}>
            <ChoixClientSite
              sites={sites}
              clientNom={clientNom}
              siteId={siteId}
              onChange={({ clientNom: cl, siteId: s }) => {
                setClientNom(cl);
                if (s !== siteId) changerSite(s);
              }}
            />
            {siteId && (
              <div className="mt-3">
                <label className="mb-1 block text-xs font-medium text-slate-600">Nom Équipement</label>
                <ListeRecherche options={options} valeur={equipementId} onChange={choisirEquipement} vide="Aucun équipement à fluide sur ce site" />
              </div>
            )}
          </div>

          {equipement && site && mode === "equipement" && (
            <div className={CARTE}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">Informations de l&apos;équipement</p>
                <Link
                  href={`/cerfa/nouveau?equipementId=${equipement.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                >
                  <PlusCircle className="h-4 w-4" /> Nouveau CERFA
                </Link>
              </div>
              <Ligne label="N° équipement" valeur={equipement.numero_equipement} />
              <Ligne label="N° affaire" valeur={site.n_affaire} />
              <Ligne label="Marque" valeur={texteChamp(c, "marque")} />
              <Ligne label="Date M.E.S." valeur={texteChamp(c, "dateMES")} />
              <Ligne label="Référence" valeur={texteChamp(c, cleReference(equipement.type_equipement_id))} />
              <Ligne label="Localisation" valeur={equipement.localisation} />
              <Ligne label="Réfrigérant" valeur={texteChamp(c, "typeRefrigerant")} />
              <Ligne label="Charge" valeur={texteChamp(c, "chargeRefrigerant")} />
              <Ligne label="Adresse" valeur={site.adresse} />
              <Ligne label="Complément d'adresse" valeur={site.complement_adresse} />
              <Ligne label="Code Postal" valeur={site.code_postal} />
              <Ligne label="Commune" valeur={site.commune} />
              <Ligne label="Date dernier contrôle" valeur={texteChamp(c, "dateDernierControle")} />
              <Ligne label="Date prochain contrôle" valeur={texteChamp(c, "dateProchainControle")} />
              <Ligne label="N° dernier bordereau" valeur={texteChamp(c, "numDernierBordereau")} />
              <Ligne label="Opérateur" valeur={cerfas?.[0]?.operateur_nom ?? ""} />
              <p className={`${TITRE} mt-4`}>Signataires du site</p>
              {site.signataires.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun interlocuteur renseigné sur le site.</p>
              ) : (
                site.signataires.map((s, i) => <Ligne key={i} label={s.qualite || "—"} valeur={`${s.nom}${s.email ? ` — ${s.email}` : ""}`} />)
              )}
            </div>
          )}
        </div>

        {equipement && (
          <div className={CARTE}>
            <p className={TITRE}>CERFA finalisés — {equipement.nom}</p>
            {cerfas === null ? (
              <p className="text-sm text-slate-500">Chargement…</p>
            ) : cerfas.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun CERFA trouvé pour cet équipement.</p>
            ) : (
              <ul className="space-y-2">
                {cerfas.map((cf) => (
                  <li key={cf.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">{cf.numero}</p>
                      <p className="text-xs text-slate-500">
                        Contrôle du {fr(cf.date_controle)} — {cf.operateur_nom}
                        {cf.envoye_le ? ` — envoyé le ${fr(cf.envoye_le)} à ${cf.envoye_a}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <a href={`/cerfa/${cf.id}/pdf`} target="_blank" rel="noopener" title="Ouvrir le PDF" className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-50">
                        <FileText className="h-4 w-4" />
                      </a>
                      {mode === "envoyer" && (
                        <button
                          type="button"
                          title="Envoyer ce CERFA"
                          onClick={() => setEnvoi({ cerfa: cf, email: cf.signataire_email })}
                          className="rounded-lg p-2 text-indigo-700 hover:bg-indigo-50"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {envoi && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="mb-1 text-base font-bold text-slate-900">Envoyer ce CERFA</h2>
            <p className="mb-3 text-sm font-semibold text-slate-600">{envoi.cerfa.numero}</p>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="email-dest">
              Adresse destinataire (plusieurs : séparer par une virgule)
            </label>
            <input id="email-dest" type="text" autoFocus className={CHAMP} value={envoi.email} onChange={(e) => setEnvoi({ ...envoi, email: e.target.value })} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEnvoi(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                Annuler
              </button>
              <button type="button" disabled={enCours} onClick={envoyer} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {enCours ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
