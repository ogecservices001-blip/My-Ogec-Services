import { readFile } from "fs/promises";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Tables } from "@/lib/types";
import { OGEC, ATTESTATION_CAPACITE } from "../commandes-fournisseur/constants";
import { calculerPrixRevient, prixUniteLigne, montantLigneDevis, type LigneDevis, type CoutRevient } from "./pricing";

type Devis = Tables<"devis">;

const ENCRE = "#14202E";
const GRIS = "#697382";
const LIGNE = "#CBD3DD";
const FOND_SECTION = "#E2EEFB";

const MENTION_LEGALE =
  `La société OGEC SERVICES est titulaire de l'autorisation préfectorale n°${ATTESTATION_CAPACITE.numero}-R2, ` +
  "conformément à l'article R.543-106, délivrée par l'organisme bureau Veritas Certifications et Ministère de " +
  `l'Environnement, relative aux travaux de manipulation des fluides frigorigènes (valable du ${ATTESTATION_CAPACITE.validiteDu} au ${ATTESTATION_CAPACITE.validiteAu}).`;

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9.5, color: ENCRE, fontFamily: "Helvetica" },
  footer: { position: "absolute", bottom: 12, left: 28, right: 28, textAlign: "center" },
  footerText: { fontSize: 6.5, color: GRIS },
  pageNumber: { position: "absolute", bottom: 12, right: 28, fontSize: 7.5, color: GRIS },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 90 },
  headerInfo: { flex: 1, marginLeft: 12 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  companySub: { fontSize: 8, color: GRIS },
  kvBox: { width: 220 },
  kvRow: { flexDirection: "row", paddingVertical: 1 },
  kvKey: { width: 70, fontSize: 9.5, fontFamily: "Helvetica-BoldOblique" },
  kvVal: { flex: 1, fontSize: 9.5 },
  titleBox: {
    marginTop: 14,
    marginBottom: 10,
    borderWidth: 0.6,
    borderColor: LIGNE,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  titleText: { fontSize: 10.5, fontFamily: "Helvetica-BoldOblique" },
  table: { borderTopWidth: 0.6, borderTopColor: LIGNE, marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: FOND_SECTION },
  tableRow: { flexDirection: "row", borderTopWidth: 0.6, borderTopColor: LIGNE },
  tdInd: { width: 24, fontSize: 9, padding: 4 },
  tdDesignation: { flex: 3, fontSize: 9, padding: 4 },
  tdUnite: { width: 40, fontSize: 9, padding: 4 },
  tdQte: { width: 34, fontSize: 9, padding: 4, textAlign: "right" },
  tdPu: { width: 70, fontSize: 9, padding: 4, textAlign: "right" },
  tdMontant: { width: 80, fontSize: 9, padding: 4, textAlign: "right" },
  thText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  piedRow: { flexDirection: "row", marginTop: 12, justifyContent: "space-between" },
  piedCol: { width: 280 },
  piedLigne: { flexDirection: "row", paddingVertical: 1.5 },
  piedLabel: { fontSize: 9, textDecoration: "underline" },
  piedValeur: { fontSize: 9, fontFamily: "Helvetica-Bold", marginLeft: 4 },
  totauxBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  totalLabel: { fontSize: 9.5 },
  totalValeur: { fontSize: 9.5, textAlign: "right" },
  totalTtcLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  totalTtcValeur: { fontSize: 10.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
});

function eur(v: number): string {
  return `${v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
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
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (rendu PDF), pas une balise HTML img */}
          {logo && <Image src={logo} style={styles.logo} />}
          <View style={styles.headerInfo}>
            <Text style={styles.companyName}>Omnium Genie Climatique Services</Text>
            <Text style={styles.companySub}>S.A.R.L. Ogec Services</Text>
            <Text style={styles.companySub}>{OGEC.adresse}</Text>
            <Text style={styles.companySub}>{OGEC.codePostalCommune}</Text>
            <Text style={styles.companySub}>Tél. 0262 26 00 86</Text>
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

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tdInd, styles.thText]}>Ind.</Text>
            <Text style={[styles.tdDesignation, styles.thText]}>Désignation</Text>
            <Text style={[styles.tdUnite, styles.thText]}>Unité</Text>
            <Text style={[styles.tdQte, styles.thText]}>Qté</Text>
            <Text style={[styles.tdPu, styles.thText]}>Prix U. H.T</Text>
            <Text style={[styles.tdMontant, styles.thText]}>Prix Total H.T</Text>
          </View>
          {lignesValides.map((l, i) => {
            const pu = prixUniteLigne(l, prixRevient.coefficientVente, prixRevient.tauxHoraire);
            const montant = montantLigneDevis(l, prixRevient.coefficientVente, prixRevient.tauxHoraire);
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.tdInd}>{i + 1}</Text>
                <Text style={styles.tdDesignation}>{l.designation}</Text>
                <Text style={styles.tdUnite}>{l.unite}</Text>
                <Text style={styles.tdQte}>{l.quantite}</Text>
                <Text style={styles.tdPu}>{pu !== null ? eur(pu) : ""}</Text>
                <Text style={styles.tdMontant}>{montant !== null ? eur(montant) : ""}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.piedRow}>
          <View style={styles.piedCol}>
            <View style={styles.piedLigne}>
              <Text style={styles.piedLabel}>Délai d&apos;approvisionnement :</Text>
              <Text style={styles.piedValeur}>Disponible sauf vente entre temps</Text>
            </View>
            <View style={styles.piedLigne}>
              <Text style={styles.piedLabel}>Validité de l&apos;offre :</Text>
              <Text style={styles.piedValeur}>2 mois</Text>
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
              <Text style={styles.totalTtcLabel}>Travaux Total T.T.C.</Text>
              <Text style={styles.totalTtcValeur}>{eur(ttc)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{MENTION_LEGALE}</Text>
          <Text style={[styles.footerText, { marginTop: 4 }]}>
            Omnium Genie Climatique Services — SIRET : {OGEC.siret.replace(/\s/g, "")}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

let logoCache: Buffer | null | undefined;
async function chargerLogo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    logoCache = await readFile(path.join(process.cwd(), "public", "logo.jpg"));
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export async function genererPdfDevis(params: { devis: Devis; site: { nom: string; site: string } | null }): Promise<Buffer> {
  const logo = await chargerLogo();
  return renderToBuffer(<DevisDocument {...params} logo={logo} />);
}
