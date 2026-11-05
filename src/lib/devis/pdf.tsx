import { readFile } from "fs/promises";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import type { Tables } from "@/lib/types";
import { OGEC, ATTESTATION_CAPACITE } from "../commandes-fournisseur/constants";
import { calculerPrixRevient, prixUniteLigne, montantLigneDevis, type LigneDevis, type CoutRevient } from "./pricing";

type Devis = Tables<"devis">;

const NOIR = "#000000";
const TRAIT_FIN = 0.5;
const TRAIT_EPAIS = 1.2;
const HAUTEUR_MIN_CORPS = 470;

const MENTION_LEGALE =
  `La société OGEC SERVICES est titulaire de l'autorisation préfectorale n°${ATTESTATION_CAPACITE.numero}-R2, ` +
  "conformément à l'article R.543-106, délivrée par l'organisme bureau Veritas Certifications et Ministère de " +
  `l'Environnement, relative aux travaux de manipulation des fluides frigorigènes (valable du ${ATTESTATION_CAPACITE.validiteDu} au ${ATTESTATION_CAPACITE.validiteAu}).`;

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingBottom: 34,
    paddingHorizontal: 14,
    fontSize: 10,
    color: NOIR,
    fontFamily: "Times-Roman",
  },
  footerSociete: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    textAlign: "center",
    fontSize: 8,
    fontFamily: "Helvetica",
  },
  pageNumber: { position: "absolute", bottom: 14, right: 14, fontSize: 8, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  headerGauche: { flex: 1, paddingLeft: 34 },
  logo: { width: 96, height: 44, marginBottom: 8 },
  companyName: { fontSize: 11, fontFamily: "Times-BoldItalic", marginBottom: 2 },
  companySub: { fontSize: 9, fontFamily: "Courier-Oblique", marginTop: 1 },
  kvBox: { width: 287 },
  kvRow: { flexDirection: "row", paddingVertical: 3 },
  kvKey: { width: 80, fontSize: 11, fontFamily: "Times-BoldItalic", textDecoration: "underline" },
  kvVal: { flex: 1, fontSize: 10, fontFamily: "Helvetica" },
  titleBox: {
    marginTop: 12,
    marginBottom: 8,
    minHeight: 36,
    borderWidth: TRAIT_EPAIS,
    borderColor: NOIR,
    paddingVertical: 4,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  titleText: { fontSize: 10, fontFamily: "Times-BoldItalic", textAlign: "center" },
  tableHeaderRow: {
    flexDirection: "row",
    minHeight: 24,
    borderWidth: TRAIT_EPAIS,
    borderColor: NOIR,
    alignItems: "stretch",
  },
  corps: { minHeight: HAUTEUR_MIN_CORPS },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: TRAIT_EPAIS,
    borderRightWidth: TRAIT_EPAIS,
    borderColor: NOIR,
  },
  lignesVides: { flexGrow: 1 },
  finTableau: { borderTopWidth: TRAIT_EPAIS, borderColor: NOIR },
  tdInd: { width: 33, padding: 3, textAlign: "center", borderRightWidth: TRAIT_FIN, fontFamily: "Helvetica", fontSize: 10 },
  tdDesignation: { flex: 1, padding: 3, borderRightWidth: TRAIT_FIN, fontFamily: "Times-Roman", fontSize: 10 },
  tdUnite: { width: 36, padding: 3, textAlign: "center", borderRightWidth: TRAIT_FIN, fontFamily: "Helvetica", fontSize: 10 },
  tdQte: { width: 36, padding: 3, textAlign: "right", borderRightWidth: TRAIT_FIN, fontFamily: "Helvetica", fontSize: 10 },
  tdPu: { width: 73, padding: 3, textAlign: "right", borderRightWidth: TRAIT_FIN, fontFamily: "Helvetica", fontSize: 10 },
  tdMontant: { width: 85, padding: 3, textAlign: "right", fontFamily: "Helvetica", fontSize: 10 },
  thText: { fontFamily: "Times-Bold", fontSize: 10, textAlign: "center", paddingTop: 6 },
  titreSection: { fontFamily: "Times-Bold" },
  piedRow: { flexDirection: "row", marginTop: 10, justifyContent: "space-between" },
  piedCol: { flex: 1 },
  piedLigne: { flexDirection: "row", alignItems: "baseline", minHeight: 19 },
  piedLabel: { width: 138, fontSize: 10, textDecoration: "underline" },
  piedDisponible: { fontSize: 8, fontFamily: "Times-Bold" },
  piedValidite: { fontSize: 10, fontFamily: "Times-Bold", textDecoration: "underline" },
  totauxBox: { width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", minHeight: 19 },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica" },
  totalValeur: { fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "right" },
  mentionLegale: {
    marginTop: 12,
    marginHorizontal: 12,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    textAlign: "center",
    textDecoration: "underline",
  },
});

function eur(v: number): string {
  const montant = v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${montant.replace(/[  ]/g, " ")} €`;
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k} :</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

function DevisDocument({
  devis,
  site,
  logo,
}: {
  devis: Devis;
  site: { nom: string; site: string } | null;
  logo: Buffer | null;
}) {
  const lignes = (devis.lignes as unknown as LigneDevis[]) ?? [];
  const coutRevient = devis.cout_revient as unknown as CoutRevient;
  const prixRevient = calculerPrixRevient(lignes, coutRevient);
  const lignesValides = lignes.filter((l) => l.designation.trim());

  const totalHT = lignesValides.reduce(
    (s, l) => s + (montantLigneDevis(l, prixRevient.coefficientVente, prixRevient.tauxHoraire) ?? 0),
    0,
  );
  const tva = Math.round(totalHT * 0.085 * 100) / 100;
  const ttc = totalHT + tva;

  const objet = [site?.site, devis.libelle].filter(Boolean).join(" - ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.headerGauche}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (rendu PDF), pas une balise HTML img */}
            {logo && <Image src={logo} style={styles.logo} />}
            <Text style={styles.companyName}>Omnium Genie Climatique Services</Text>
            <Text style={styles.companySub}>S.A.R.L. Ogec Services</Text>
            <Text style={styles.companySub}>{OGEC.adresse}</Text>
            <Text style={styles.companySub}>{OGEC.codePostalCommune}</Text>
            <Text style={styles.companySub}>Tel : 02 62 26 00 86</Text>
          </View>
          <View style={styles.kvBox}>
            <Kv k="Devis N°" v={devis.numero || "(brouillon)"} />
            <Kv k="Date" v={devis.date_devis} />
            <Kv k="Clients" v={site?.nom ?? ""} />
            <Kv k="Sites" v={site?.site ?? ""} />
            <Kv k="Rédacteur" v={devis.redacteur} />
            <Kv k="Objet" v={devis.libelle} />
          </View>
        </View>

        {objet && (
          <View style={styles.titleBox}>
            <Text style={styles.titleText}>{objet}</Text>
          </View>
        )}

        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tdInd, styles.thText]}>Ind.</Text>
          <Text style={[styles.tdDesignation, styles.thText]}>Désignation</Text>
          <Text style={[styles.tdUnite, styles.thText]}>Unité</Text>
          <Text style={[styles.tdQte, styles.thText]}>Qté</Text>
          <Text style={[styles.tdPu, styles.thText]}>Prix U. H.T</Text>
          <Text style={[styles.tdMontant, styles.thText]}>Prix Total H.T</Text>
        </View>
        <View style={styles.corps}>
          {lignesValides.map((l, i) => {
            const estTitre = !l.quantite.trim();
            const numeroLigne = lignesValides.slice(0, i + 1).filter((x) => x.quantite.trim()).length;
            const pu = prixUniteLigne(l, prixRevient.coefficientVente, prixRevient.tauxHoraire);
            const montant = montantLigneDevis(l, prixRevient.coefficientVente, prixRevient.tauxHoraire);
            return (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={styles.tdInd}>{estTitre ? "" : numeroLigne}</Text>
                <Text style={estTitre ? [styles.tdDesignation, styles.titreSection] : styles.tdDesignation}>
                  {l.designation}
                </Text>
                <Text style={styles.tdUnite}>{estTitre ? "" : l.unite}</Text>
                <Text style={styles.tdQte}>{l.quantite}</Text>
                <Text style={styles.tdPu}>{pu !== null ? eur(pu) : ""}</Text>
                <Text style={styles.tdMontant}>{montant !== null ? eur(montant) : ""}</Text>
              </View>
            );
          })}
          <View style={[styles.tableRow, styles.lignesVides]}>
            <View style={styles.tdInd} />
            <View style={styles.tdDesignation} />
            <View style={styles.tdUnite} />
            <View style={styles.tdQte} />
            <View style={styles.tdPu} />
            <View style={styles.tdMontant} />
          </View>
          <View style={styles.finTableau} />
        </View>

        <View wrap={false}>
          <View style={styles.piedRow}>
            <View style={styles.piedCol}>
              <View style={styles.piedLigne}>
                <Text style={styles.piedLabel}>Délai d&apos;approvisionnement :</Text>
                <Text style={styles.piedDisponible}>Disponible sauf vente entre temps</Text>
              </View>
              <View style={styles.piedLigne}>
                <Text style={styles.piedLabel}>Validité de l&apos;offre :</Text>
                <Text style={styles.piedValidite}>2 mois</Text>
              </View>
              <View style={styles.piedLigne}>
                <Text style={styles.piedLabel}>Travaux non compris :</Text>
              </View>
            </View>
            <View style={styles.totauxBox}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Travaux Total H.T.</Text>
                <Text style={styles.totalValeur}>{eur(totalHT)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tva 8,5%</Text>
                <Text style={styles.totalValeur}>{eur(tva)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Travaux Total T.T.C.</Text>
                <Text style={styles.totalValeur}>{eur(ttc)}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.mentionLegale}>{MENTION_LEGALE}</Text>
        </View>

        <Text style={styles.footerSociete} fixed>
          Omnium Genie Climatique Services  SIRET : {OGEC.siret.replace(/\s/g, "")}
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} /${totalPages}`}
        />
      </Page>
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

let cgvCache: Buffer | null | undefined;
async function chargerCgv(): Promise<Buffer | null> {
  if (cgvCache !== undefined) return cgvCache;
  try {
    cgvCache = await readFile(path.join(process.cwd(), "public", "cgv-devis.pdf"));
  } catch {
    cgvCache = null;
  }
  return cgvCache;
}

/// Devis généré par @react-pdf/renderer, puis les pages des CGV (PDF
/// à part, voir public/cgv-devis.pdf) ajoutées à la suite via pdf-lib
/// — @react-pdf ne sait pas inclure un PDF existant tel quel.
export async function genererPdfDevis(params: { devis: Devis; site: { nom: string; site: string } | null }): Promise<Buffer> {
  const logo = await chargerLogo();
  const devisBytes = await renderToBuffer(<DevisDocument {...params} logo={logo} />);

  const cgvBytes = await chargerCgv();
  if (!cgvBytes) return devisBytes;

  const document = await PDFDocument.load(devisBytes);
  const cgv = await PDFDocument.load(cgvBytes);
  const pagesCgv = await document.copyPages(cgv, cgv.getPageIndices());
  for (const page of pagesCgv) document.addPage(page);

  return Buffer.from(await document.save());
}
