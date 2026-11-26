"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { SaisieRetrouvee } from "@/components/hors-ligne/saisie-retrouvee";
import { effacerBrouillon, lireBrouillon, lireFichier, listerEnvois, type Brouillon } from "@/lib/hors-ligne/stockage";
import { CLE_BROUILLON_BI, clePhoto, effacerPhotosLocales, type BiEnAttente, type InstantaneBI } from "@/lib/hors-ligne/bi";
import { BiWizard } from "./wizard";

type Proprietes = Omit<ComponentProps<typeof BiWizard>, "local" | "sauvegardeActive">;

/// Assistant BI avec la saisie gardée sur le téléphone : une saisie non
/// transmise est proposée à la reprise (« Saisie retrouvée »), l'assistant
/// repartant alors exactement où il en était.
export function BiWizardHorsLigne(props: Proprietes) {
  const [verifie, setVerifie] = useState(false);
  const [retrouvee, setRetrouvee] = useState<Brouillon<InstantaneBI> | null>(null);
  const [reprise, setReprise] = useState<InstantaneBI | null>(null);

  useEffect(() => {
    lireBrouillon<InstantaneBI>(CLE_BROUILLON_BI).then((b) => {
      if (b?.donnees?.brouillon?.site_id) setRetrouvee(b);
      setVerifie(true);
    });
  }, []);

  async function reprendre() {
    if (!retrouvee) return;
    const s = retrouvee.donnees;
    const photos = await Promise.all(
      s.brouillon.photos.map(async (p) => {
        const blob = p.local_id ? await lireFichier(clePhoto(p.local_id)) : null;
        return { ...p, preview: blob ? URL.createObjectURL(blob) : p.preview };
      }),
    );
    setReprise({ ...s, brouillon: { ...s.brouillon, photos } });
    setRetrouvee(null);
  }

  async function ignorer() {
    const s = retrouvee?.donnees;
    setRetrouvee(null);
    await effacerBrouillon(CLE_BROUILLON_BI);
    if (!s) return;
    // Une photo encore attendue par un BI en file d'envoi est gardée.
    const attendues = new Set(
      (await listerEnvois())
        .filter((e) => e.type === "bi")
        .flatMap((e) => (e.payload as BiEnAttente).photos.map((p) => p.local_id)),
    );
    await effacerPhotosLocales(s.brouillon.photos.filter((p) => !attendues.has(p.local_id)));
  }

  return (
    <>
      {retrouvee && (
        <div className="mx-auto max-w-2xl">
          <SaisieRetrouvee libelle={retrouvee.libelle} majLe={retrouvee.majLe} onReprendre={reprendre} onIgnorer={ignorer} />
        </div>
      )}
      <BiWizard
        key={reprise ? "reprise-locale" : "page"}
        {...props}
        brouillon={reprise?.brouillon ?? props.brouillon}
        local={reprise?.extras ?? null}
        sauvegardeActive={verifie && !retrouvee}
      />
    </>
  );
}
