import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { dateFr, eurosFr, finDuMois, nombreFr, type EtatPreparatoire, type LigneEtatComplete } from "./etat";
import { absencesDebut, absencesFin, absencesMotif, DOSSIER, titre } from "./etat-export";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 7.5, fontFamily: "Helvetica" },
  entete: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, fontSize: 9 },
  titre: { fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 10 },
  ligne: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#94a3b8" },
  enteteTable: { flexDirection: "row", backgroundColor: "#e2e8f0", borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#94a3b8", fontFamily: "Helvetica-Bold" },
  cellule: { paddingVertical: 3, paddingHorizontal: 2, borderRightWidth: 0.5, borderColor: "#94a3b8" },
  separateur: { height: 12 },
});

const COLONNES_PDF: { titre: string; largeur: number; gauche?: boolean }[] = [
  { titre: "Nom et Prénom", largeur: 95, gauche: true },
  { titre: "Heures travaillées", largeur: 42 },
  { titre: "H. supp. 25%", largeur: 36 },
  { titre: "H. supp. 50%", largeur: 36 },
  { titre: "Absences 1er jour (inclus)", largeur: 50 },
  { titre: "Absences dernier jour (inclus)", largeur: 50 },
  { titre: "Motif CP, AT maladie …", largeur: 62, gauche: true },
  { titre: "Paniers Nb", largeur: 30 },
  { titre: "Paniers Montant", largeur: 44 },
  { titre: "Indemnités Trajet", largeur: 44 },
  { titre: "Indemnités Transport", largeur: 44 },
  { titre: "Observations", largeur: 260, gauche: true },
];

function valeursPdf(l: LigneEtatComplete): string[] {
  const t = l.bloc === "technique";
  const n = (x: number) => (x ? nombreFr(x) : t ? "0" : "");
  const e = (x: number) => (t ? eurosFr(x) : "");
  return [
    l.nom,
    nombreFr(l.heures),
    t ? n(l.hs25) : "",
    t ? n(l.hs50) : "",
    absencesDebut(l),
    absencesFin(l),
    absencesMotif(l),
    t ? String(l.paniersNb) : "",
    e(l.paniersMontant),
    e(l.trajet),
    e(l.transport),
    l.observations,
  ];
}

function EtatDocument({ etat }: { etat: EtatPreparatoire }) {
  const ligne = (l: LigneEtatComplete) => (
    <View key={l.salarieId} style={styles.ligne} wrap={false}>
      {valeursPdf(l).map((v, i) => (
        <Text key={i} style={[styles.cellule, { width: COLONNES_PDF[i].largeur, textAlign: COLONNES_PDF[i].gauche ? "left" : "center" }]}>
          {v}
        </Text>
      ))}
    </View>
  );
  return (
    <Document title={titre(etat.mois)}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.entete}>
          <Text>Dossier : {DOSSIER}</Text>
          <Text>Le : {dateFr(finDuMois(etat.mois))}</Text>
        </View>
        <Text style={styles.titre}>{titre(etat.mois)}</Text>
        <View style={styles.enteteTable} fixed>
          {COLONNES_PDF.map((c) => (
            <Text key={c.titre} style={[styles.cellule, { width: c.largeur, textAlign: c.gauche ? "left" : "center" }]}>
              {c.titre}
            </Text>
          ))}
        </View>
        {etat.lignes.filter((l) => l.bloc === "technique").map(ligne)}
        <View style={styles.separateur} />
        {etat.lignes.filter((l) => l.bloc === "autre").map(ligne)}
      </Page>
    </Document>
  );
}

export function pdfEtat(etat: EtatPreparatoire): Promise<Buffer> {
  return renderToBuffer(<EtatDocument etat={etat} />);
}
