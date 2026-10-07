import { readFile } from "fs/promises";
import path from "path";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Tables } from "@/lib/types";
import { Poles, avecPeriode, labelPole, PHOTO_TYPES } from "./constants";
import { equipementLabel, eur, montantLigne, parsePu, totalHT, interventionsDuBon, type Presta } from "./format";

type Bon = Tables<"bons_intervention">;

const BLEU = "#1375D0";
const ENCRE = "#14202E";
const GRIS = "#697382";
const LIGNE = "#CBD3DD";
const FOND_SECTION = "#E2EEFB";

const MENTION_LEGALE =
  "la société ogec services est titulaire de l'autorisation préfectorale n°1139819-r2, " +
  "conformément à l'article r.543-106, délivrée par l'organisme bureau veritas " +
  "certifications et ministere de l'environnement, relative aux travaux de manipulation " +
  "des fluides frigorigènes.";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9.5, color: ENCRE, fontFamily: "Helvetica" },
  footer: { position: "absolute", bottom: 12, left: 28, right: 28, textAlign: "center" },
  footerText: { fontSize: 6.5, color: GRIS },
  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 90 },
  headerInfo: { flex: 1, marginLeft: 12 },
  companyName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  companySub: { fontSize: 8, color: GRIS },
  numeroBox: { width: 130, backgroundColor: FOND_SECTION, padding: 8, alignItems: "center" },
  numeroText: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16, marginBottom: 10 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: BLEU },
  poleLabel: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  section: { backgroundColor: BLEU, paddingHorizontal: 5, paddingVertical: 3, marginBottom: 4 },
  sectionText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "white" },
  kvRow: { flexDirection: "row", paddingVertical: 1 },
  kvKey: { width: 135, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  kvVal: { flex: 1, fontSize: 9.5 },
  bloc: { marginBottom: 10 },
  divider: { borderTopWidth: 0.8, borderTopColor: LIGNE, marginTop: 24, marginBottom: 12 },
  sigRow: { flexDirection: "row" },
  sigCol: { flex: 1 },
  sigTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  sigImage: { height: 70, objectFit: "contain" },
  table: { borderTopWidth: 0.6, borderTopColor: LIGNE },
  tableHeaderRow: { flexDirection: "row", backgroundColor: FOND_SECTION },
  tableRow: { flexDirection: "row", borderTopWidth: 0.6, borderTopColor: LIGNE },
  tdDesignation: { flex: 3, fontSize: 9, padding: 4 },
  tdNb: { flex: 0.8, fontSize: 9, padding: 4 },
  tdPu: { flex: 1.1, fontSize: 9, padding: 4 },
  tdMontant: { flex: 1.2, fontSize: 9, padding: 4 },
  thText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  photoPage: { padding: 28 },
  photoPageTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLEU, marginBottom: 12 },
  photoImage: { height: 320, objectFit: "contain", marginBottom: 4 },
  photoLegende: { fontSize: 9, marginBottom: 16 },
});

function Kv({ k, v }: { k: string; v: string }) {
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

/// Phrase affichée juste avant la ligne "Équipement" — précise la
/// nature de l'intervention sur cet équipement selon le pôle.
function descriptionEquipement(pole: string): string | null {
  switch (pole) {
    case Poles.installationNeuve:
      return "Équipement complémentaire";
    case Poles.remplacementIdentique:
      return "Remplacement d'un équipement existant";
    case Poles.reparationEquipement:
      return "Réparation d'un équipement existant";
    case Poles.reparationDiverse:
      return "Réparation diverse sur équipement existant";
    case Poles.entretienSousContrat:
      return "Entretien d'un équipement sous contrat";
    case Poles.entretienHorsContrat:
      return "Entretien d'un équipement hors contrat";
    default:
      return null;
  }
}

function lignesDates(b: Bon): { label: string; valeur: string }[] {
  if (avecPeriode(b.pole)) {
    if (b.date_debut && b.date_fin && b.date_debut !== b.date_fin) {
      return [{ label: "Période d'intervention", valeur: `du ${b.date_debut} au ${b.date_fin}` }];
    }
    return [{ label: "Date d'intervention", valeur: b.date_debut || "—" }];
  }
  const lignes = [{ label: "Date d'intervention", valeur: b.date_intervention || "—" }];
  if (b.heure_debut || b.heure_fin) {
    lignes.push({ label: "Horaires", valeur: [b.heure_debut, b.heure_fin].filter(Boolean).join(" → ") });
  }
  return lignes;
}

function TablePrestas({ prestas }: { prestas: Presta[] }) {
  const lignes = prestas.filter((p) => p.designation.trim()).slice(0, 10);
  const total = totalHT(lignes);
  const hasPrix = lignes.some((p) => montantLigne(p) !== null);
  const affichees = lignes.length === 0 ? [{ designation: "—", quantite: "" }] : lignes;

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tdDesignation, styles.thText]}>Désignation</Text>
        <Text style={[styles.tdNb, styles.thText]}>Nb</Text>
        <Text style={[styles.tdPu, styles.thText]}>PU HT</Text>
        <Text style={[styles.tdMontant, styles.thText]}>Montant HT</Text>
      </View>
      {affichees.map((p, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.tdDesignation}>{p.designation}</Text>
          <Text style={styles.tdNb}>{p.quantite}</Text>
          <Text style={styles.tdPu}>{parsePu(p.pu ?? "") !== null ? eur(parsePu(p.pu ?? "")!) : "—"}</Text>
          <Text style={styles.tdMontant}>{montantLigne(p) !== null ? eur(montantLigne(p)!) : "—"}</Text>
        </View>
      ))}
      {hasPrix && (
        <View style={styles.tableRow}>
          <Text style={styles.tdDesignation} />
          <Text style={styles.tdNb} />
          <Text style={[styles.tdPu, styles.thText]}>Total HT</Text>
          <Text style={[styles.tdMontant, styles.thText]}>{eur(total)}</Text>
        </View>
      )}
    </View>
  );
}

function BlocSignature({ titre, sigBase64 }: { titre: string; sigBase64: string }) {
  return (
    <View style={styles.sigCol}>
      <Text style={styles.sigTitle}>{titre}</Text>
      {sigBase64 ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (rendu PDF), pas une balise HTML img
        <Image src={sigBase64} style={styles.sigImage} />
      ) : (
        <View style={{ height: 70 }} />
      )}
    </View>
  );
}

export type PhotoAnnexe = { type: string; legende: string; horodatage: string; bytes: Buffer };

function paires<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += 2) out.push(items.slice(i, i + 2));
  return out;
}

function BiDocument({ bon, logo, photos }: { bon: Bon; logo: Buffer | null; photos: PhotoAnnexe[] }) {
  const prestas = bon.prestas as unknown as Presta[];
  const nonDesservis = bon.entretien_non_desservis as unknown as { nom?: string; motif?: string }[];
  const avecPrestas = prestas.some((p) => p.designation.trim());
  const interventions = interventionsDuBon(bon);
  const multiEquipement = interventions.length > 1;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (rendu PDF), pas une balise HTML img */}
          {logo && <Image src={logo} style={styles.logo} />}
          <View style={styles.headerInfo}>
            <Text style={styles.companyName}>SARL OGEC SERVICES</Text>
            <Text style={styles.companySub}>918, Chemin Tour des Roches — 97460 Saint-Paul</Text>
            <Text style={styles.companySub}>Tél. 0262 26 00 86 · ogec.services@orange.fr</Text>
          </View>
          <View style={styles.numeroBox}>
            <Text style={styles.numeroText}>{bon.numero}</Text>
          </View>
        </View>
        <View style={styles.titleRow}>
          <Text style={styles.title}>BON D&apos;INTERVENTION</Text>
          <Text style={styles.poleLabel}>
            Pôle {bon.pole} · {labelPole(bon.pole)}
          </Text>
        </View>

        <Section titre="LE CLIENT" />
        <Kv k="Client" v={bon.site ? `${bon.client_nom} — ${bon.site}` : bon.client_nom} />
        <Kv k="Adresse d'intervention" v={bon.adresse || "—"} />
        {bon.hors_contrat && <Kv k="Statut" v="Client hors contrat" />}
        <View style={{ height: 8 }} />

        <Section titre="OGEC" />
        <Kv k="Technicien(s)" v={bon.techniciens.join(", ") || "—"} />
        {bon.devis_numero && <Kv k="Affaire" v={bon.devis_numero} />}
        {bon.devis_reference_client && <Kv k="Réf commande client" v={bon.devis_reference_client} />}
        {bon.devis_date_commande_client && <Kv k="Date commande client" v={bon.devis_date_commande_client} />}
        {!multiEquipement && bon.equipement_nom && (
          <>
            {descriptionEquipement(bon.pole) && <Text style={{ fontSize: 9.5, marginBottom: 1 }}>{descriptionEquipement(bon.pole)}</Text>}
            <Kv k="Équipement" v={equipementLabel(bon)} />
          </>
        )}
        {bon.entretien_groupes.length > 0 && <Kv k="Groupes entretenus" v={bon.entretien_groupes.join(", ")} />}
        {lignesDates(bon).map((l, i) => (
          <Kv key={i} k={l.label} v={l.valeur} />
        ))}
        {bon.numero_devis && <Kv k="N° devis lié" v={bon.numero_devis} />}
        <View style={{ height: 10 }} />

        {!multiEquipement && (
          <View style={styles.bloc}>
            <Section titre="DESCRIPTION DE L'INTERVENTION" />
            <Text style={{ fontSize: 9.5 }}>{bon.compte_rendu || "—"}</Text>
          </View>
        )}

        {nonDesservis.length > 0 && (
          <View style={styles.bloc}>
            <Section titre="ÉQUIPEMENTS NON ENTRETENUS" />
            {nonDesservis.map((e, i) => (
              <Kv key={i} k={e.nom ?? ""} v={e.motif ?? ""} />
            ))}
          </View>
        )}

        {multiEquipement &&
          interventions.map((inter, i) => {
            const label = equipementLabel({ pole: bon.pole, ...inter });
            const prestasInter = inter.prestas.filter((p) => p.designation.trim());
            return (
              <View key={i} style={styles.bloc}>
                <Section titre={label ? `ÉQUIPEMENT : ${label.toUpperCase()}` : `INTERVENTION ${i + 1}`} />
                <Text style={{ fontSize: 9.5, marginBottom: prestasInter.length > 0 ? 4 : 0 }}>
                  {inter.compte_rendu || "—"}
                </Text>
                {prestasInter.length > 0 && <TablePrestas prestas={inter.prestas} />}
              </View>
            );
          })}

        {!multiEquipement && avecPrestas && (
          <View style={styles.bloc}>
            <Section titre="DÉTAIL DES PRESTATIONS ET FOURNITURES" />
            <TablePrestas prestas={prestas} />
          </View>
        )}

        {(bon.obs_tech || bon.obs_client) && (
          <View style={styles.bloc}>
            <Section titre="OBSERVATIONS" />
            {bon.obs_tech && <Kv k="Technicien" v={bon.obs_tech} />}
            {bon.obs_client && <Kv k="Client" v={bon.obs_client} />}
          </View>
        )}

        <View style={styles.divider} />
        <View style={styles.sigRow}>
          <BlocSignature
            titre={`Pour la Société OGEC Services\n${bon.technicien_signataire || bon.techniciens.join(", ")}`}
            sigBase64={bon.sig_tech}
          />
          <View style={{ width: 16 }} />
          <BlocSignature
            titre={`Pour le client - ${bon.client_nom}\n${bon.signataire}${bon.date_signature ? `  (signé le ${bon.date_signature})` : ""}`}
            sigBase64={bon.sig_client}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{MENTION_LEGALE}</Text>
        </View>
      </Page>

      {paires(photos).map((paire, i) => (
        <Page key={i} size="A4" style={styles.photoPage}>
          <Text style={styles.photoPageTitle}>Annexes photos — {bon.numero}</Text>
          {paire.map((p, j) => (
            <View key={j}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- Image de @react-pdf/renderer (rendu PDF), pas une balise HTML img */}
              <Image src={p.bytes} style={styles.photoImage} />
              <Text style={styles.photoLegende}>
                {PHOTO_TYPES[p.type] ?? p.type}
                {p.legende ? ` — ${p.legende}` : ""}
                {p.horodatage ? `  (${p.horodatage})` : ""}
              </Text>
            </View>
          ))}
        </Page>
      ))}
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

/// Génère le PDF officiel du bon d'intervention — régénéré à la volée
/// à chaque consultation (voir bi_pdf_generator.dart d'origine), rien
/// n'est lu depuis l'archive Storage pour l'affichage : l'archive n'est
/// qu'une copie de sauvegarde créée à la validation (voir
/// @/lib/bi/archive).
export async function genererPdfBI(bon: Bon, photos: PhotoAnnexe[]): Promise<Buffer> {
  const logo = await chargerLogo();
  return renderToBuffer(<BiDocument bon={bon} logo={logo} photos={photos.slice(0, 4)} />);
}
