"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { ListeRecherche } from "@/components/liste-recherche";
import { useChampManquant } from "@/components/champ-manquant";
import { nomFichierAvecDate } from "@/lib/excel-export";
import { REFERENTIELS, afficherValeur, formaterCommune, type CodeReferentiel, type ColonneRef } from "@/lib/rh/referentiels";
import { appliquerImportRh, enregistrerLigne, exporterReferentiel, previsualiserImportRh, supprimerLigne, type ApercuImportRh } from "./actions";

type Ligne = Record<string, unknown>;
type Option = { valeur: string; label: string };

const CHAMP = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20";

function telecharger(base64: string, nom: string) {
  const octets = atob(base64);
  const tampon = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichierAvecDate(nom);
  a.click();
  URL.revokeObjectURL(url);
}

const versSaisie = (col: ColonneRef, v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (col.type === "booleen") return v ? "oui" : "";
  return String(v);
};

export function TableReferentiel({
  code,
  lignes,
  options,
  communesSites,
}: {
  code: CodeReferentiel;
  lignes: Ligne[];
  options: Record<string, Option[]>;
  communesSites: Option[];
}) {
  const def = REFERENTIELS[code];
  const router = useRouter();
  const [edition, setEdition] = useState<{ id: string | null; valeurs: Record<string, string> } | null>(null);
  const [importOuvert, setImportOuvert] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Ligne | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { signaler, fenetre } = useChampManquant();
  const optionsDe = (c: ColonneRef) => c.options ?? (c.optionsDynamiques ? options[c.optionsDynamiques] ?? [] : []);

  const colonnes: ColonneTableur[] = [
    ...def.colonnes.map((c) => ({ titre: c.entete, droite: c.type === "euros" || c.type === "nombre" })),
    { titre: "", largeur: "90px" },
  ];

  function ouvrir(l: Ligne | null) {
    setErreur(null);
    setEdition({
      id: l ? String(l[def.id]) : null,
      valeurs: Object.fromEntries(def.colonnes.map((c) => [c.cle, l ? versSaisie(c, l[c.cle]) : c.type === "booleen" && c.cle === "actif" ? "oui" : ""])),
    });
  }

  function enregistrer() {
    if (!edition) return;
    const manquant = def.colonnes.find((c) => c.obligatoire && !edition.valeurs[c.cle]?.trim());
    if (manquant) return signaler(`Renseigne : ${manquant.entete}`, `rh-${manquant.cle}`);
    setErreur(null);
    startTransition(async () => {
      const res = await enregistrerLigne(code, edition.id, edition.valeurs);
      if (!res.ok) return setErreur(res.erreur);
      setEdition(null);
      router.refresh();
    });
  }

  function supprimer() {
    if (!aSupprimer) return;
    startTransition(async () => {
      const res = await supprimerLigne(code, String(aSupprimer[def.id]));
      if (!res.ok) setErreur(res.erreur);
      setASupprimer(null);
      router.refresh();
    });
  }

  function exporter() {
    startTransition(async () => telecharger(await exporterReferentiel(code), `Referentiel_RH_${code}.xlsx`));
  }

  const champ = (c: ColonneRef) => {
    const v = edition?.valeurs[c.cle] ?? "";
    const changer = (nv: string) => setEdition((e) => (e ? { ...e, valeurs: { ...e.valeurs, [c.cle]: nv } } : e));
    if (c.type === "booleen")
      return (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={v === "oui"} onChange={(e) => changer(e.target.checked ? "oui" : "")} className="h-4 w-4 accent-brand-green" />
          {c.entete}
        </label>
      );
    if (c.type === "choix")
      return <ListeRecherche id={`rh-${c.cle}`} valeur={v} onChange={changer} options={optionsDe(c)} placeholder="Tape pour chercher" />;
    if (c.type === "commune")
      return (
        <ListeRecherche
          id={`rh-${c.cle}`}
          valeur={v}
          onChange={changer}
          options={[...communesSites, ...(v && !communesSites.some((o) => o.valeur === v) ? [{ valeur: v, label: v }] : [])]}
          placeholder="Tape pour chercher la commune"
          onCreer={(s) => changer(formaterCommune(s, communesSites.map((o) => o.valeur)))}
          libelleCreer={(s) => `+ Ajouter « ${formaterCommune(s, communesSites.map((o) => o.valeur))} »`}
        />
      );
    return (
      <input
        id={`rh-${c.cle}`}
        type={c.type === "date" ? "date" : c.type === "euros" || c.type === "nombre" ? "number" : "text"}
        step={c.type === "euros" ? "0.01" : undefined}
        value={v}
        onChange={(e) => changer(e.target.value)}
        className={CHAMP}
      />
    );
  };

  return (
    <div>
      {fenetre}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => ouvrir(null)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark">
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          Ajouter
        </button>
        <button onClick={() => setImportOuvert(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
          <Upload className="h-4 w-4" strokeWidth={2.25} />
          Import Excel
        </button>
        <button onClick={exporter} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
          <Download className="h-4 w-4" strokeWidth={2.25} />
          Export Excel
        </button>
      </div>
      {erreur && !edition && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      <Tableur
        colonnes={colonnes}
        lignes={lignes.map((l) => [
          ...def.colonnes.map((c) => afficherValeur(c, l[c.cle], optionsDe(c))),
          <div key="actions" className="flex justify-end gap-1">
            <button onClick={() => ouvrir(l)} title="Modifier" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => setASupprimer(l)} title="Supprimer" className="rounded-md p-1.5 text-red-500 hover:bg-red-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>,
        ])}
        valeurs={lignes.map((l) => def.colonnes.map((c) => afficherValeur(c, l[c.cle], optionsDe(c))))}
        vide="Aucune ligne pour l'instant"
      />

      {edition && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{edition.id ? "Modifier" : "Ajouter"} — {def.titre}</h2>
              <button onClick={() => setEdition(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {def.colonnes.map((c) => (
                <div key={c.cle}>
                  {c.type !== "booleen" && (
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      {c.entete}
                      {c.obligatoire && " *"}
                    </label>
                  )}
                  {champ(c)}
                </div>
              ))}
            </div>
            {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEdition(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
                Annuler
              </button>
              <button onClick={enregistrer} disabled={pending} className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green-dark disabled:opacity-60">
                {pending ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {aSupprimer && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="mb-4 text-sm text-slate-700">
              Supprimer « {afficherValeur(def.colonnes.find((c) => c.cle === def.cle)!, aSupprimer[def.cle])} » ?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setASupprimer(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
                Annuler
              </button>
              <button onClick={supprimer} disabled={pending} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {importOuvert && <ModaleImport code={code} onClose={() => setImportOuvert(false)} />}
    </div>
  );
}

function ModaleImport({ code, onClose }: { code: CodeReferentiel; onClose: () => void }) {
  const router = useRouter();
  const fichier = useRef<FormData | null>(null);
  const [apercu, setApercu] = useState<Extract<ApercuImportRh, { ok: true }> | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [termine, setTermine] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { surChampInvalide, fenetre } = useChampManquant();

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Import Excel — {REFERENTIELS[code].titre}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        {erreur && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}
        {termine ? (
          <div className="space-y-3 text-sm">
            <p className="font-semibold text-brand-green-dark">{termine}</p>
            {apercu && (
              <button onClick={() => telecharger(apercu.rapport, `Rapport_import_RH_${code}.xlsx`)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                <Download className="h-4 w-4" />
                Télécharger le rapport (.xlsx)
              </button>
            )}
            <div className="text-right">
              <button onClick={onClose} className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white">
                Fermer
              </button>
            </div>
          </div>
        ) : !apercu ? (
          <form
            onInvalidCapture={surChampInvalide}
            action={(fd) => {
              fichier.current = fd;
              setErreur(null);
              startTransition(async () => {
                const r = await previsualiserImportRh(code, fd);
                if (!r.ok) return setErreur(r.erreur);
                setApercu(r);
              });
            }}
            className="rounded-xl border border-dashed border-slate-300 p-6 text-center"
          >
            {fenetre}
            <p className="mb-3 text-xs text-slate-500">Pars du fichier de l&apos;export Excel. Les lignes absentes du fichier ne sont jamais supprimées.</p>
            <input type="file" name="fichier" accept=".xlsx" required className="mx-auto mb-4 block text-sm" />
            <button type="submit" disabled={pending} className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "Analyse..." : "Analyser le fichier"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>
                {apercu.changements.filter((c) => c.type === "ajout").length} ajout(s), {apercu.changements.filter((c) => c.type === "modification").length} modification(s),{" "}
                {apercu.inchangees} inchangée(s)
              </span>
              <button onClick={() => telecharger(apercu.rapport, `Rapport_import_RH_${code}.xlsx`)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline">
                <Download className="h-3.5 w-3.5" />
                Rapport (.xlsx)
              </button>
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {apercu.changements.map((c, i) => (
                <li key={i} className="rounded-lg border border-slate-200 px-3 py-1.5">
                  <span className={`mr-2 text-xs font-bold ${c.type === "ajout" ? "text-green-700" : "text-orange-700"}`}>{c.type === "ajout" ? "AJOUT" : "MODIF"}</span>
                  <strong>{c.cle}</strong>
                  {c.type === "modification" && (
                    <span className="text-slate-500"> — {c.champs.map((ch) => `${ch.entete} : ${ch.avant || "vide"} → ${ch.apres || "vide"}`).join(" · ")}</span>
                  )}
                </li>
              ))}
            </ul>
            {apercu.erreurs.length > 0 && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {apercu.erreurs.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setApercu(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
                Annuler
              </button>
              {apercu.changements.length > 0 && (
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await appliquerImportRh(code, fichier.current!);
                      if (!r.ok) return setErreur(r.erreur);
                      setTermine(`${r.ajouts} ajout(s) et ${r.modifications} modification(s) enregistrés.`);
                      router.refresh();
                    })
                  }
                  className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {pending ? "Import..." : "Confirmer l'import"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
