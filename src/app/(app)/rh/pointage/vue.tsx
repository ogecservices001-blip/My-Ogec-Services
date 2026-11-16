"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Lock, LockOpen } from "lucide-react";
import { Tableur, type ColonneTableur } from "@/components/tableur";
import { useFiltreClientSite } from "@/components/filtre-client-site";
import { ListeRecherche } from "@/components/liste-recherche";
import { nomFichierAvecDate } from "@/lib/excel-export";
import type { LignePointage } from "@/lib/rh/pointage";
import { basculerVehiculePersonnel, cloturerMois, exporterPointage, rouvrirMois } from "../actions";

const COLONNES: ColonneTableur[] = [
  { titre: "Date", largeur: "90px" },
  { titre: "Salarié" },
  { titre: "Client — Site" },
  { titre: "Pôle" },
  { titre: "Commune" },
  { titre: "Source" },
  { titre: "H. norm.", droite: true },
  { titre: "HS 25 %", droite: true },
  { titre: "HS 50 %", droite: true },
  { titre: "HS 100 %", droite: true },
  { titre: "Panier", droite: true },
  { titre: "Trajet", droite: true },
  { titre: "Véhicule perso", largeur: "90px" },
  { titre: "Transport", droite: true },
];

const h = (n: number) => (n ? n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : "");
const eur = (n: number) => (n ? n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €" : "");

export function PointageVue({ mois, lignes, cloture }: { mois: string; lignes: LignePointage[]; cloture: { le: string; par: string } | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [salarie, setSalarie] = useState("");
  const [confirmer, setConfirmer] = useState(false);
  const { filtrees: duClient, bloc } = useFiltreClientSite(lignes, (l) => ({ client: l.client, site: l.site }), "pointage");
  const visibles = duClient.filter((l) => !salarie || l.profileId === salarie);
  const salaries = useMemo(() => [...new Map(lignes.map((l) => [l.profileId, l.salarie])).entries()].map(([valeur, label]) => ({ valeur, label })).sort((a, b) => a.label.localeCompare(b.label, "fr")), [lignes]);
  const total = (k: keyof LignePointage) => visibles.reduce((t, l) => t + (Number(l[k]) || 0), 0);

  function agir(action: () => Promise<{ ok: boolean; erreur?: string }>) {
    setErreur(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) setErreur(r.erreur ?? "Action impossible.");
      setConfirmer(false);
      router.refresh();
    });
  }

  function exporter() {
    startTransition(async () => {
      const b64 = await exporterPointage(mois);
      const octets = atob(b64);
      const tampon = new Uint8Array(octets.length);
      for (let i = 0; i < octets.length; i++) tampon[i] = octets.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([tampon], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = nomFichierAvecDate(`Pointage_mensuel_${mois}.xlsx`);
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Pointage mensuel</h1>
          <p className="text-sm text-slate-500">
            Calculé depuis le planning et les BI — {lignes.length} ligne(s).{" "}
            <Link href={`/rh/controle?mois=${mois}`} className="font-semibold text-brand-green-dark underline">
              Contrôle du mois
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={mois}
            onChange={(e) => e.target.value && router.push(`/rh/pointage?mois=${e.target.value}`)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm"
          />
          <button onClick={exporter} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            <Download className="h-4 w-4" />
            Export Excel
          </button>
          {cloture ? (
            <button onClick={() => agir(() => rouvrirMois(mois))} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <LockOpen className="h-4 w-4" />
              Rouvrir le mois
            </button>
          ) : (
            <button onClick={() => setConfirmer(true)} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              <Lock className="h-4 w-4" />
              Clôturer le mois
            </button>
          )}
        </div>
      </div>

      {cloture && (
        <p className="mb-3 rounded-xl bg-slate-100 px-4 py-2 text-sm text-slate-700">
          <Lock className="mr-1 inline h-4 w-4" /> Mois clôturé le {new Date(cloture.le).toLocaleDateString("fr-FR")} par {cloture.par} : le pointage est figé.
        </p>
      )}
      {confirmer && (
        <div className="mb-3 rounded-xl border border-slate-300 bg-white p-3 text-sm">
          <p className="mb-2 font-semibold">Clôturer {mois.split("-").reverse().join("/")} ? Le pointage sera figé tel qu&apos;il est maintenant.</p>
          <div className="flex gap-2">
            <button onClick={() => agir(() => cloturerMois(mois))} disabled={pending} className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white">
              Oui, clôturer
            </button>
            <button onClick={() => setConfirmer(false)} className="rounded-lg border border-slate-200 px-3 py-1.5">
              Annuler
            </button>
          </div>
        </div>
      )}
      {erreur && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</p>}

      {bloc}
      <div className="mb-3 max-w-sm">
        <ListeRecherche valeur={salarie} onChange={setSalarie} options={salaries} placeholder="Tous les salariés" />
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Heures normales", h(total("hn")) || "0"],
          ["HS 25 %", h(total("hs25")) || "0"],
          ["HS 50 %", h(total("hs50")) || "0"],
          ["HS 100 %", h(total("hs100")) || "0"],
          ["Paniers", `${total("panierNb")} — ${eur(total("panierMontant")) || "0 €"}`],
          ["Trajets + transports", `${eur(total("trajet")) || "0 €"} + ${eur(total("transport")) || "0 €"}`],
        ].map(([titre, valeur]) => (
          <div key={titre} className="rounded-xl bg-white p-3 shadow-sm">
            <p className="text-xs text-slate-400">{titre}</p>
            <p className="font-bold text-slate-900">{valeur}</p>
          </div>
        ))}
      </div>

      <Tableur
        colonnes={COLONNES}
        lignes={visibles.map((l) => [
          l.date.split("-").reverse().join("/"),
          l.salarie,
          <Link key="cs" href={l.lien} className="hover:underline">
            {[l.client, l.site].filter(Boolean).join(" — ")}
          </Link>,
          l.pole,
          l.commune ? (
            <span key="c" className={l.communeConnue ? "" : "font-semibold text-amber-700"}>
              {l.commune}
              {!l.communeConnue && " (hors barème)"}
            </span>
          ) : l.source === "absence" || l.source === "poste" ? (
            ""
          ) : (
            <span key="c" className="font-semibold text-red-600">
              Commune à renseigner
            </span>
          ),
          <span key="s" className={l.source === "absence" ? "text-amber-700" : l.source === "depannage" ? "text-red-700" : l.source === "bi" ? "text-brand-green-dark" : "text-slate-500"}>
            {l.libelleSource}
          </span>,
          h(l.hn),
          h(l.hs25),
          h(l.hs50),
          h(l.hs100),
          l.panierNb ? eur(l.panierMontant) : "",
          eur(l.trajet),
          l.source === "absence" || l.source === "poste" ? (
            ""
          ) : (
            <input
              key="v"
              type="checkbox"
              checked={l.vehiculePerso}
              disabled={Boolean(cloture) || pending}
              onChange={(e) => agir(() => basculerVehiculePersonnel(l.profileId, l.date, e.target.checked))}
              className="h-4 w-4 accent-brand-green"
              title="Véhicule personnel ce jour-là (prime de transport)"
            />
          ),
          eur(l.transport),
        ])}
        valeurs={visibles.map((l) => [l.date, l.salarie, `${l.client} ${l.site}`, l.pole, l.commune, l.libelleSource])}
        vide="Aucune heure ce mois-ci"
      />
    </div>
  );
}
