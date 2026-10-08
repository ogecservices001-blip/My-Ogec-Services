import { readFile } from "fs/promises";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Tables } from "@/lib/types";
import type { Interlocuteur } from "@/lib/validation/fournisseur";
import { OGEC, ATTESTATION_CAPACITE } from "./constants";
import { type LigneCommande, montantLigne, calculerTotaux, eur } from "./format";

type Commande = Tables<"commandes_fournisseur">;
type Devis = Tables<"devis">;
type Fournisseur = Tables<"fournisseurs">;

const BLEU = "#1375D0";
const ENCRE = "#14202E";
const GRIS = "#697382";
const LIGNE = "#CBD3DD";
const FOND_SECTION = "#E2EEFB";

const MENTION_LEGALE =
  `la société ogec services est titulaire de l'autorisation préfectorale n°${ATTESTATION_CAPACITE.numero}-r2, ` +
  "conformément à l'article r.543-106, délivrée par l'organisme bureau veritas " +
  "certifications et ministere de l'environnement, relative aux travaux de manipulation " +
  `des fluides frigorigènes (valable du ${ATTESTATION_CAPACITE.validiteDu} au ${ATTESTATION_CAPACITE.validiteAu}).`;

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9.5, color: ENCRE, fontFamily: "Helvetica" },
  footer: { position: "absolute", bottom: 12, left: 28, right: 28, textAlign: "center" },
  footerText: { fontSize: 6.5, color: GRIS },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 90 },
  headerInfo: { flex: 1, marginLeft: 12 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  companySub: { fontSize: 8, color: GRIS },
  numeroBox: { width: 150, backgroundColor: FOND_SECTION, padding: 8, alignItems: "center" },
  numeroText: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  titleRow: { marginTop: 16, marginBottom: 10 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLEU },
  section: { backgroundColor: BLEU, paddingHorizontal: 5, paddingVertical: 3, marginBottom: 4, marginTop: 8 },
  sectionText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "white" },
  kvRow: { flexDirection: "row", paddingVertical: 1 },
  kvKey: { width: 135, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  kvVal: { flex: 1, fontSize: 9.5 },
  deuxCol: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  table: { borderTopWidth: 0.6, borderTopColor: LIGNE, marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: FOND_SECTION },
  tableRow: { flexDirection: "row", borderTopWidth: 0.6, borderTopColor: LIGNE },
  tdCode: { flex: 1, fontSize: 9, padding: 4 },
  tdDesignation: { flex: 3, fontSize: 9, padding: 4 },
  tdNb: { flex: 0.8, fontSize: 9, padding: 4 },
  tdPu: { flex: 1.1, fontSize: 9, padding: 4 },
  tdMontant: { flex: 1.2, fontSize: 9, padding: 4 },
  thText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totauxBox: { alignSelf: "flex-end", width: 220, marginTop: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  totalLabel: { fontSize: 9.5 },
  totalValeur: { fontSize: 9.5, textAlign: "right" },
  totalTtcLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  totalTtcValeur: { fontSize: 10.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
});

function Kv({ k, v }: { k: string; v: string }) {
  if (!v) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k} :</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

function Section({ titre }: { titre: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionText}>{titre}</Text>
    </View>
  );
}

function CommandeDocument({
  commande,
  devis,
  fournisseur,
  logo,
}: {
  commande: Commande;
  devis: Devis;
  fournisseur: Fournisseur;
  logo: Buffer | null;
}) {
  const interlocuteur = commande.interlocuteur as unknown as Interlocuteur;
  const lignes = (commande.lignes as unknown as LigneCommande[]) ?? [];
  const totaux = calculerTotaux(lignes, commande.taux_tva);
  const metropole = fournisseur.localisation === "Métropole";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (rendu PDF), pas une balise HTML img */}
          {logo && <Image src={logo} style={styles.logo} />}
          <View style={styles.headerInfo}>
            <Text style={styles.companyName}>{OGEC.raisonSociale}</Text>
            <Text style={styles.companySub}>{OGEC.formeJuridique} — SIRET {OGEC.siret} — TVA {OGEC.tvaIntracom}</Text>
            <Text style={styles.companySub}>{OGEC.adresse} — {OGEC.codePostalCommune}</Text>
            <Text style={styles.companySub}>Tél. 0262 26 00 86 · ogec.services@orange.fr</Text>
          </View>
          <View style={styles.numeroBox}>
            <Text style={styles.numeroText}>{commande.numero}</Text>
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>BON DE COMMANDE</Text>
        </View>

        <View style={styles.deuxCol}>
          <View style={styles.col}>
            <Section titre="FOURNISSEUR" />
            <Kv k="Société" v={fournisseur.raison_sociale_exacte || fournisseur.nom} />
            <Kv k="Forme juridique" v={fournisseur.forme_juridique} />
            <Kv k="Adresse" v={[fournisseur.adresse, fournisseur.complement_adresse, [fournisseur.code_postal, fournisseur.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
            <Kv k="SIRET" v={fournisseur.siret} />
            <Kv k="RCS / RM" v={fournisseur.rcs_rm} />
            <Kv k="TVA intracom." v={fournisseur.tva_intracom} />
            <Kv k="Interlocuteur" v={interlocuteur?.nom} />
            <Kv k="Tél" v={interlocuteur?.portable || interlocuteur?.tel} />
            <Kv k="Email" v={interlocuteur?.email} />
          </View>
          <View style={styles.col}>
            <Section titre="COMMANDE" />
            <Kv k="Date" v={commande.date_commande} />
            <Kv k="Référence devis" v={devis.numero} />
            <Kv k="Désignation devis" v={devis.libelle} />
            <Kv k="Devis fournisseur n°" v={commande.devis_fournisseur_numero} />
            <Kv k="En date du" v={commande.devis_fournisseur_date} />
            <Kv k="Délai de paiement" v={fournisseur.delai_paiement} />
            <Kv k="Mode de règlement" v={fournisseur.mode_reglement} />
          </View>
        </View>

        <Section titre="LIVRAISON" />
        <Kv k="Adresse de livraison" v={commande.adresse_livraison} />
        <Kv k="Date de livraison prévue" v={commande.date_livraison_prevue} />
        {metropole && <Kv k="Port" v={commande.port} />}
        {metropole && <Kv k="Incoterm" v={commande.incoterm} />}

        <Section titre="ARTICLES" />
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tdCode, styles.thText]}>Code</Text>
            <Text style={[styles.tdDesignation, styles.thText]}>Désignation</Text>
            <Text style={[styles.tdNb, styles.thText]}>Qté</Text>
            <Text style={[styles.tdPu, styles.thText]}>PU HT</Text>
            <Text style={[styles.tdMontant, styles.thText]}>Montant HT</Text>
          </View>
          {lignes.map((l, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tdCode}>{l.code}</Text>
              <Text style={styles.tdDesignation}>{l.designation}</Text>
              <Text style={styles.tdNb}>{l.quantite}</Text>
              <Text style={styles.tdPu}>{l.prix_unitaire ? eur(parseFloat(l.prix_unitaire.replace(",", "."))) : "—"}</Text>
              <Text style={styles.tdMontant}>{montantLigne(l) !== null ? eur(montantLigne(l)!) : "—"}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totauxBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total HT</Text>
            <Text style={styles.totalValeur}>{eur(totaux.ht)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TVA ({commande.taux_tva}%)</Text>
            <Text style={styles.totalValeur}>{eur(totaux.tva)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalTtcLabel}>Total TTC</Text>
            <Text style={styles.totalTtcValeur}>{eur(totaux.ttc)}</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 9.5 }}>
            Veuillez accuser réception de ce bon de commande et nous confirmer la date de livraison ou de mise à
            disposition.
          </Text>
          <Text style={{ fontSize: 9.5, marginTop: 10 }}>Pour OGEC Services,</Text>
          <Text style={{ fontSize: 9.5 }}>{commande.redacteur}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{MENTION_LEGALE}</Text>
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

export async function genererPdfCommande(params: { commande: Commande; devis: Devis; fournisseur: Fournisseur }): Promise<Buffer> {
  const logo = await chargerLogo();
  return renderToBuffer(<CommandeDocument {...params} logo={logo} />);
}
