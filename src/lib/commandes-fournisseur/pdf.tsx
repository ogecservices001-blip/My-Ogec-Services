import { readFile } from "fs/promises";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Tables } from "@/lib/types";
import type { Interlocuteur } from "@/lib/validation/fournisseur";
import { formaterDate, telInternational, indicatifTel } from "@/lib/format";
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

/// Règle d'espacement : un pas vertical de base (ESPACE) et ses multiples,
/// adapté à la longueur du bon. Un bon court s'étale pour occuper la page,
/// un bon long se resserre ; le pas de référence (6) correspond à un bon
/// d'environ 6 lignes d'articles, qui remplit alors juste la page.
const INTERLIGNE = 1.4;
const PAS_REFERENCE = 6;
const LIGNES_REFERENCE = 6;

function pasPourContenu(lignes: { designation: string }[], adresseLivraison: string): number {
  const lignesTexte =
    lignes.reduce((n, l) => n + Math.max(1, Math.ceil(l.designation.length / 45)), 0) +
    Math.max(0, Math.ceil(adresseLivraison.length / 80) - 1);
  const pas = PAS_REFERENCE + (LIGNES_REFERENCE - lignesTexte) * 0.35;
  return Math.min(8, Math.max(4, pas));
}

function creerStyles(ESPACE: number) {
  return StyleSheet.create({
  page: { paddingTop: 32, paddingBottom: 40, paddingHorizontal: 32, fontSize: 9.5, color: ENCRE, fontFamily: "Helvetica", lineHeight: INTERLIGNE },
  footer: { position: "absolute", bottom: 14, left: 32, right: 32, textAlign: "center" },
  footerText: { fontSize: 6.5, color: GRIS, lineHeight: 1.3 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  logo: { width: 96, height: 44 },
  headerInfo: { flex: 1, marginLeft: ESPACE * 3 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: ESPACE / 2 },
  companySub: { fontSize: 8, color: GRIS },
  numeroBox: { width: 150, backgroundColor: FOND_SECTION, paddingVertical: ESPACE * 1.5, paddingHorizontal: ESPACE * 1.5, alignItems: "center" },
  numeroText: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "center" },
  titleRow: { marginTop: ESPACE * 4.5, marginBottom: ESPACE * 2 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLEU },
  section: { backgroundColor: BLEU, paddingHorizontal: ESPACE, paddingVertical: ESPACE / 2, marginBottom: ESPACE * 1.5, marginTop: ESPACE * 3 },
  sectionText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "white" },
  kvRow: { flexDirection: "row", paddingVertical: ESPACE / 2.5 },
  kvKey: { width: 135, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  kvVal: { flex: 1, fontSize: 9.5 },
  deuxCol: { flexDirection: "row", gap: ESPACE * 4 },
  col: { flex: 1 },
  table: { borderTopWidth: 0.6, borderTopColor: LIGNE },
  tableHeaderRow: { flexDirection: "row", backgroundColor: FOND_SECTION },
  tableRow: { flexDirection: "row", borderTopWidth: 0.6, borderTopColor: LIGNE },
  tdCode: { flex: 1, fontSize: 9, paddingVertical: ESPACE, paddingHorizontal: ESPACE * 0.8 },
  tdDesignation: { flex: 2.6, fontSize: 9, paddingVertical: ESPACE, paddingHorizontal: ESPACE * 0.8 },
  tdNb: { flex: 0.7, fontSize: 9, paddingVertical: ESPACE, paddingHorizontal: ESPACE * 0.8 },
  tdPu: { flex: 1, fontSize: 9, paddingVertical: ESPACE, paddingHorizontal: ESPACE * 0.8 },
  tdRemise: { flex: 0.7, fontSize: 9, paddingVertical: ESPACE, paddingHorizontal: ESPACE * 0.8 },
  tdMontant: { flex: 1.2, fontSize: 9, paddingVertical: ESPACE, paddingHorizontal: ESPACE * 0.8 },
  thText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totauxBox: { alignSelf: "flex-end", width: 220, marginTop: ESPACE * 2.5 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: ESPACE / 2 },
  totalLabel: { fontSize: 9.5 },
  totalValeur: { fontSize: 9.5, textAlign: "right" },
  totalTtcLabel: { fontSize: 10.5, fontFamily: "Helvetica-Bold" },
  totalTtcValeur: { fontSize: 10.5, fontFamily: "Helvetica-Bold", textAlign: "right" },
});
}

type Styles = ReturnType<typeof creerStyles>;

function Kv({ k, v, styles }: { k: string; v: string; styles: Styles }) {
  if (!v) return null;
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvKey}>{k} :</Text>
      <Text style={styles.kvVal}>{v}</Text>
    </View>
  );
}

function Section({ titre, styles }: { titre: string; styles: Styles }) {
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
  const ESPACE = pasPourContenu(lignes, commande.adresse_livraison ?? "");
  const styles = creerStyles(ESPACE);

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
            <Section styles={styles} titre="FOURNISSEUR" />
            <Kv styles={styles} k="Société" v={fournisseur.raison_sociale_exacte || fournisseur.nom} />
            <Kv styles={styles} k="Forme juridique" v={fournisseur.forme_juridique} />
            <Kv styles={styles} k="Adresse" v={[fournisseur.adresse, fournisseur.complement_adresse, [fournisseur.code_postal, fournisseur.commune].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
            <Kv styles={styles} k="SIRET" v={fournisseur.siret} />
            <Kv styles={styles} k="RCS / RM" v={fournisseur.rcs_rm} />
            <Kv styles={styles} k="TVA intracom." v={fournisseur.tva_intracom} />
            <Kv styles={styles} k="Interlocuteur" v={interlocuteur?.nom} />
            <Kv
              styles={styles}
              k="Tél"
              v={telInternational(interlocuteur?.portable || interlocuteur?.tel || "", indicatifTel(fournisseur.localisation))}
            />
            <Kv styles={styles} k="Email" v={interlocuteur?.email} />
          </View>
          <View style={styles.col}>
            <Section styles={styles} titre="COMMANDE" />
            <Kv styles={styles} k="Date" v={commande.date_commande} />
            <Kv styles={styles} k="Référence devis" v={devis.numero} />
            <Kv styles={styles} k="Désignation devis" v={devis.libelle} />
            <Kv styles={styles} k="Devis fournisseur n°" v={commande.devis_fournisseur_numero} />
            <Kv styles={styles} k="En date du" v={commande.devis_fournisseur_date} />
            <Kv styles={styles} k="Validité de l'offre" v={commande.validite_offre} />
            <Kv styles={styles} k="Conditions de paiement" v={commande.conditions_paiement || fournisseur.delai_paiement} />
            <Kv styles={styles} k="Mode de règlement" v={fournisseur.mode_reglement} />
          </View>
        </View>

        <Section styles={styles} titre="LIVRAISON" />
        <Kv styles={styles} k="Adresse de livraison" v={commande.adresse_livraison} />
        <Kv styles={styles} k="Date de livraison prévue" v={formaterDate(commande.date_livraison_prevue)} />
        {metropole && <Kv styles={styles} k="Port" v={commande.port} />}
        {metropole && <Kv styles={styles} k="Incoterm" v={commande.incoterm} />}

        <Section styles={styles} titre="ARTICLES" />
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tdCode, styles.thText]}>Code</Text>
            <Text style={[styles.tdDesignation, styles.thText]}>Désignation</Text>
            <Text style={[styles.tdNb, styles.thText]}>Qté</Text>
            <Text style={[styles.tdPu, styles.thText]}>PU HT</Text>
            <Text style={[styles.tdRemise, styles.thText]}>Remise</Text>
            <Text style={[styles.tdMontant, styles.thText]}>Montant HT</Text>
          </View>
          {lignes.map((l, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tdCode}>{l.code}</Text>
              <Text style={styles.tdDesignation}>{l.designation}</Text>
              <Text style={styles.tdNb}>{l.quantite}</Text>
              <Text style={styles.tdPu}>{l.prix_unitaire ? eur(parseFloat(l.prix_unitaire.replace(",", "."))) : "—"}</Text>
              <Text style={styles.tdRemise}>{l.remise ? `${l.remise} %` : "—"}</Text>
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
            <Text style={styles.totalLabel}>{commande.tva_non_applicable ? "TVA non applicable" : `TVA (${commande.taux_tva}%)`}</Text>
            <Text style={styles.totalValeur}>{commande.tva_non_applicable ? "—" : eur(totaux.tva)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalTtcLabel}>{commande.tva_non_applicable ? "Total net HT" : "Total TTC"}</Text>
            <Text style={styles.totalTtcValeur}>{eur(totaux.ttc)}</Text>
          </View>
        </View>

        <View style={{ marginTop: ESPACE * 5 }}>
          <Text style={{ fontSize: 9.5 }}>
            Veuillez accuser réception de ce bon de commande et nous confirmer la date de livraison ou de mise à
            disposition.
          </Text>
          <Text style={{ fontSize: 9.5, marginTop: ESPACE * 2.5 }}>Pour OGEC Services,</Text>
          <Text style={{ fontSize: 9.5 }}>{commande.redacteur}</Text>
        </View>

        <View style={styles.footer} fixed>
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
    logoCache = await readFile(path.join(process.cwd(), "public", "logo-devis.jpg"));
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export async function genererPdfCommande(params: { commande: Commande; devis: Devis; fournisseur: Fournisseur }): Promise<Buffer> {
  const logo = await chargerLogo();
  return renderToBuffer(<CommandeDocument {...params} logo={logo} />);
}
