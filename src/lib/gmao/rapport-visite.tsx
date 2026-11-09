import { readFile } from "fs/promises";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Tables } from "@/lib/types";
import type { Equipement, TypeEquipement, Releve } from "./types";
import { concatTypeEquipement } from "./suggestion-reference-horaire";
import { equipementsEntretenus, libelleVisite, visitesDejaValidees } from "./visites";

type Bon = Tables<"bons_intervention">;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

export type DonneesRapportVisite = {
  bi: Bon;
  fiches: { equipement: Equipement; type: TypeEquipement | null; releve: Releve }[];
  sansReleve: { nom: string; groupe: string; localisation: string }[];
  nonDesservis: { nom: string; motif: string }[];
  /// Rattrapage : équipements déjà entretenus pour cette visite par un autre BI.
  dejaFaits: { nom: string; bi: string }[];
};

/// Rapport technique d'une visite d'entretien : le BI Entretien sous contrat
/// validé et les relevés qui lui sont rattachés.
export async function chargerRapportVisite(
  supabase: Supabase,
  biId: string,
): Promise<{ ok: true; donnees: DonneesRapportVisite } | { ok: false; erreur: string }> {
  const { data: bi } = await supabase.from("bons_intervention").select("*").eq("id", biId).single();
  if (!bi) return { ok: false, erreur: "BI introuvable." };
  if (!bi.visite_numero || bi.statut === "brouillon" || bi.statut === "averif") {
    return { ok: false, erreur: "Ce BI n'est pas une visite d'entretien validée." };
  }

  const tous = await equipementsEntretenus(supabase, bi);
  const deja = await visitesDejaValidees(supabase, tous.map((e) => e.id), bi.visite_numero, bi.visite_annee, bi.id);
  const entretenus = tous.filter((e) => !deja.has(e.id));
  const ids = entretenus.map((e) => e.id);
  const [{ data: equipements }, { data: releves }] = await Promise.all([
    ids.length > 0 ? supabase.from("equipements").select("*").in("id", ids) : Promise.resolve({ data: [] }),
    supabase.from("releves").select("*").eq("bon_intervention_id", biId).order("date"),
  ]);
  const typeIds = [...new Set(((equipements ?? []) as Equipement[]).map((e) => e.type_equipement_id))];
  const { data: types } =
    typeIds.length > 0 ? await supabase.from("types_equipement").select("*").in("id", typeIds) : { data: [] };

  const equipementParId = new Map(((equipements ?? []) as Equipement[]).map((e) => [e.id, e]));
  const typeParId = new Map(((types ?? []) as TypeEquipement[]).map((t) => [t.id, t]));
  // Un relevé par équipement : le plus récent s'il y en a plusieurs.
  const releveParEquipement = new Map<string, Releve>();
  for (const r of (releves ?? []) as Releve[]) releveParEquipement.set(r.equipement_id, r);

  const fiches = entretenus
    .filter((e) => releveParEquipement.has(e.id) && equipementParId.has(e.id))
    .map((e) => {
      const equipement = equipementParId.get(e.id)!;
      return { equipement, type: typeParId.get(equipement.type_equipement_id) ?? null, releve: releveParEquipement.get(e.id)! };
    });

  return {
    ok: true,
    donnees: {
      bi,
      fiches,
      sansReleve: entretenus
        .filter((e) => !releveParEquipement.has(e.id))
        .map((e) => {
          const eq = equipementParId.get(e.id);
          return { nom: e.nom, groupe: eq?.groupe ?? "", localisation: eq?.localisation ?? "" };
        }),
      dejaFaits: tous.filter((e) => deja.has(e.id)).map((e) => ({ nom: e.nom, bi: deja.get(e.id)! })),
      nonDesservis: ((bi.entretien_non_desservis as { nom?: string; motif?: string }[] | null) ?? [])
        .filter((n) => n.nom)
        .map((n) => ({ nom: n.nom ?? "", motif: n.motif ?? "" })),
    },
  };
}

const VERT = "#1f9f6c";
const ROUGE = "#c62828";
const GRIS = "#64748b";
const BORD = "#e2e8f0";

const styles = StyleSheet.create({
  page: { paddingTop: 24, paddingBottom: 40, paddingHorizontal: 30, fontSize: 9.5, fontFamily: "Helvetica", color: "#0f172a" },
  entete: { flexDirection: "row", alignItems: "center", marginBottom: 14, paddingBottom: 8, borderBottomWidth: 1.5, borderColor: VERT },
  logo: { width: 70, height: 32, marginRight: 12 },
  enteteTitre: { flex: 1 },
  titre: { fontSize: 14, fontFamily: "Helvetica-Bold", color: VERT },
  sousTitre: { fontSize: 9.5, color: GRIS, marginTop: 2 },
  bloc: { marginBottom: 10, borderWidth: 0.8, borderColor: BORD, borderRadius: 4 },
  blocTitre: { backgroundColor: "#f1f5f9", paddingVertical: 4, paddingHorizontal: 8, fontFamily: "Helvetica-Bold", fontSize: 9.5 },
  ligne: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 8, borderTopWidth: 0.5, borderColor: BORD },
  cle: { width: "45%", color: GRIS },
  valeur: { flex: 1, fontFamily: "Helvetica-Bold" },
  valeurRouge: { flex: 1, fontFamily: "Helvetica-Bold", color: ROUGE },
  grand: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  texte: { marginBottom: 3 },
  tableEntete: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 8, borderTopWidth: 0.5, borderColor: BORD, color: GRIS, fontSize: 8 },
  tableLigne: { flexDirection: "row", paddingVertical: 3, paddingHorizontal: 8, borderTopWidth: 0.5, borderColor: BORD },
  colNom: { width: "26%", fontFamily: "Helvetica-Bold" },
  colGroupe: { width: "20%" },
  colLoc: { width: "32%" },
  colFonct: { width: "22%", fontFamily: "Helvetica-Bold" },
  piedPage: { position: "absolute", bottom: 18, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: GRIS },
});

function Ligne({ cle, valeur, rouge }: { cle: string; valeur: string; rouge?: boolean }) {
  return (
    <View style={styles.ligne} wrap={false}>
      <Text style={styles.cle}>{cle}</Text>
      <Text style={rouge ? styles.valeurRouge : styles.valeur}>{valeur}</Text>
    </View>
  );
}

function Entete({ logo, titre, sousTitre }: { logo: Buffer | null; titre: string; sousTitre: string }) {
  return (
    <View style={styles.entete}>
      {/* eslint-disable-next-line jsx-a11y/alt-text -- Image @react-pdf/renderer */}
      {logo && <Image src={logo} style={styles.logo} />}
      <View style={styles.enteteTitre}>
        <Text style={styles.titre}>{titre}</Text>
        <Text style={styles.sousTitre}>{sousTitre}</Text>
      </View>
    </View>
  );
}

function PiedPage({ bi }: { bi: Bon }) {
  return (
    <View style={styles.piedPage} fixed>
      <Text>OGEC Services — Rapport technique {bi.numero}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function dateFr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { timeZone: "Indian/Reunion" });
}

function texteValeur(v: unknown): string {
  if (typeof v === "boolean") return v ? "Effectué" : "Non";
  return typeof v === "string" ? v : "";
}

const CLES_EXCLUES = new Set(["nomTech", "dateIntervPrevue"]);

function FicheEquipement({ fiche }: { fiche: DonneesRapportVisite["fiches"][number] }) {
  const { equipement: eq, type, releve } = fiche;
  const c = eq.champs_en_tete;
  const identite = ([
    ["Famille", type ? `${type.code} — ${type.nom}` : ""],
    ["N° équipement", eq.numero_equipement],
    ["Localisation", eq.localisation],
    ["Groupe", eq.groupe],
    ["Type", concatTypeEquipement(c)],
    ...((type?.champs_en_tete_supplementaires ?? [])
      .filter((champ) => !CLES_EXCLUES.has(champ.cle))
      .map((champ) => [champ.unite ? `${champ.label} (${champ.unite})` : champ.label, texteValeur(c[champ.cle])] as [string, string])),
  ] as [string, string][]).filter(([, v]) => v.trim().length > 0);

  const checklist = (type?.checklist ?? [])
    .map((item) => {
      const texte = texteValeur(releve.checklist_values[String(item.rep)]);
      const anomalie = item.typeValeur === "enum" && item.options.length > 0 && texte !== "" && texte !== item.options[0];
      return { label: `${item.rep}. ${item.label}`, texte, anomalie };
    })
    .filter((l) => l.texte !== "");

  const mesures: { titre: string; lignes: [string, string][] }[] = [];
  for (const groupe of type?.groupes_mesures ?? []) {
    (releve.groupes_mesures[groupe.cle] ?? []).forEach((valeurs, i) => {
      const lignes = groupe.champs
        .filter((champ) => (valeurs[champ.cle] ?? "").trim())
        .map((champ) => [champ.unite ? `${champ.label} (${champ.unite})` : champ.label, valeurs[champ.cle]] as [string, string]);
      if (lignes.length > 0) mesures.push({ titre: groupe.repetable ? `${groupe.label} ${i + 1}` : groupe.label, lignes });
    });
  }

  return (
    <>
      <Text style={styles.grand}>{eq.nom}</Text>
      <Text style={[styles.texte, { color: GRIS }]}>
        Relevé du {dateFr(releve.date)}
        {releve.nom_tech ? ` — ${releve.nom_tech}` : ""}
      </Text>

      <View style={styles.bloc}>
        <Text style={styles.blocTitre}>Identification</Text>
        {identite.map(([k, v]) => (
          <Ligne key={k} cle={k} valeur={v} />
        ))}
      </View>

      {checklist.length > 0 && (
        <View style={styles.bloc}>
          <Text style={styles.blocTitre}>Opérations d&apos;entretien</Text>
          {checklist.map((l) => (
            <Ligne key={l.label} cle={l.label} valeur={l.texte} rouge={l.anomalie} />
          ))}
        </View>
      )}

      {mesures.map((m) => (
        <View key={m.titre} style={styles.bloc} wrap={false}>
          <Text style={styles.blocTitre}>Mesures — {m.titre}</Text>
          {m.lignes.map(([k, v]) => (
            <Ligne key={k} cle={k} valeur={v} />
          ))}
        </View>
      ))}

      <View style={styles.bloc} wrap={false}>
        <Text style={styles.blocTitre}>Conclusion</Text>
        <Ligne
          cle="Fonctionnement"
          valeur={releve.validation_fonctionnement ?? "—"}
          rouge={releve.validation_fonctionnement === "Non Fonctionnel"}
        />
        {releve.remarque1.trim() && <Ligne cle="Remarque" valeur={releve.remarque1} />}
        {releve.remarque2.trim() && <Ligne cle="Remarque" valeur={releve.remarque2} />}
      </View>
    </>
  );
}

function RapportDocument({ donnees, logo }: { donnees: DonneesRapportVisite; logo: Buffer | null }) {
  const { bi, fiches, sansReleve, nonDesservis, dejaFaits } = donnees;
  const visite = libelleVisite({ numero: bi.visite_numero, total: bi.visite_total, annee: bi.visite_annee });
  const periode = bi.date_debut && bi.date_fin && bi.date_debut !== bi.date_fin ? `du ${bi.date_debut} au ${bi.date_fin}` : bi.date_debut || bi.date_fin;
  const sousTitre = `${[bi.client_nom, bi.site].filter(Boolean).join(" — ")} · ${visite}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Entete logo={logo} titre="Rapport technique d'entretien" sousTitre={sousTitre} />
        <View style={styles.bloc}>
          <Text style={styles.blocTitre}>Intervention</Text>
          <Ligne cle="Client" valeur={bi.client_nom} />
          <Ligne cle="Site" valeur={bi.site} />
          {bi.adresse && <Ligne cle="Adresse" valeur={bi.adresse} />}
          <Ligne cle="Visite d'entretien" valeur={visite.replace(/^Visite /, "")} />
          <Ligne cle="Bon d'intervention" valeur={bi.numero} />
          {periode && <Ligne cle="Période d'intervention" valeur={periode} />}
          {bi.techniciens.length > 0 && <Ligne cle="Techniciens" valeur={bi.techniciens.join(", ")} />}
        </View>

        <View style={styles.bloc}>
          <Text style={styles.blocTitre}>
            Équipements entretenus ({fiches.length + sansReleve.length})
          </Text>
          <View style={styles.tableEntete}>
            <Text style={styles.colGroupe}>Groupe</Text>
            <Text style={styles.colNom}>Équipement</Text>
            <Text style={styles.colLoc}>Localisation</Text>
            <Text style={styles.colFonct}>Fonctionnement</Text>
          </View>
          {fiches.map((f) => {
            const fonctionnement = f.releve.validation_fonctionnement ?? "—";
            const couleur = fonctionnement === "Fonctionnel" ? VERT : fonctionnement === "Non Fonctionnel" ? ROUGE : "#0f172a";
            return (
              <View key={f.equipement.id} style={styles.tableLigne} wrap={false}>
                <Text style={styles.colGroupe}>{f.equipement.groupe || "—"}</Text>
                <Text style={styles.colNom}>{f.equipement.nom}</Text>
                <Text style={styles.colLoc}>{f.equipement.localisation || "—"}</Text>
                <Text style={[styles.colFonct, { color: couleur }]}>{fonctionnement}</Text>
              </View>
            );
          })}
          {sansReleve.map((e) => (
            <View key={e.nom} style={styles.tableLigne} wrap={false}>
              <Text style={styles.colGroupe}>{e.groupe || "—"}</Text>
              <Text style={styles.colNom}>{e.nom}</Text>
              <Text style={styles.colLoc}>{e.localisation || "—"}</Text>
              <Text style={[styles.colFonct, { color: GRIS }]}>Sans relevé</Text>
            </View>
          ))}
        </View>

        {dejaFaits.length > 0 && (
          <View style={styles.bloc}>
            <Text style={styles.blocTitre}>Déjà entretenus pour cette visite ({dejaFaits.length})</Text>
            <Ligne
              cle={[...new Set(dejaFaits.map((d) => d.bi))].join(", ")}
              valeur={dejaFaits.map((d) => d.nom).join(", ")}
            />
          </View>
        )}

        {nonDesservis.length > 0 && (
          <View style={styles.bloc}>
            <Text style={styles.blocTitre}>Équipements non entretenus</Text>
            {nonDesservis.map((n) => (
              <Ligne key={n.nom} cle={n.nom} valeur={n.motif || "—"} rouge />
            ))}
          </View>
        )}
        <PiedPage bi={bi} />
      </Page>

      {fiches.map((f) => (
        <Page key={f.equipement.id} size="A4" style={styles.page}>
          <Entete logo={logo} titre="Rapport technique d'entretien" sousTitre={sousTitre} />
          <FicheEquipement fiche={f} />
          <PiedPage bi={bi} />
        </Page>
      ))}
    </Document>
  );
}

let logoCache: Buffer | null | undefined;
async function chargerLogo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await readFile(path.join(process.cwd(), "public", "logo-devis.jpg"));
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export async function genererPdfRapportVisite(donnees: DonneesRapportVisite): Promise<Buffer> {
  return renderToBuffer(<RapportDocument donnees={donnees} logo={await chargerLogo()} />);
}

export function nomFichierRapport(bi: Pick<Bon, "numero">): string {
  return `Rapport-technique-${bi.numero}.pdf`;
}
