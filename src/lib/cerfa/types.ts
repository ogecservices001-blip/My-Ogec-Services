/// Tout ce que le technicien saisit au fil des 5 étapes — mêmes champs que
/// CerfaData (appli Flutter). Gardé tel quel dans `cerfas.donnees`.
export type CerfaDonnees = {
  equipementMarque: string;
  equipementDateMES: string;
  equipementReference: string;
  equipementLocalisation: string;
  equipementFluide: string;
  equipementCharge: string;
  equipementTeqCO2: string;
  caseAssemblage: boolean;
  caseMiseService: boolean;
  caseModif: boolean;
  caseMaintenance: boolean;
  caseCtrlPerio: boolean;
  caseCtrlNonPerio: boolean;
  caseDemantel: boolean;
  caseAutre: boolean;
  autreTexte: string;

  detecteurReference: string;
  detecteurDateControle: string;
  systemePermanent: boolean;
  fuiteConstatee: boolean;
  fuites: { localisation: string; realisee: boolean; aFaire: boolean }[];

  qa: string;
  denom: string;
  qb: string;
  qc: string;
  qd: string;
  bsff: string;
  qe: string;
  contenantId: string;
  observations: string;
};

export type SignataireCerfa = { nom: string; qualite: string; email: string };

export type CerfaPdfEntree = {
  ficheNo: string;
  detenteur: string;
  equipementId: string;
  donnees: CerfaDonnees;
  operateurNom: string;
  signataire: SignataireCerfa;
  dateSignature: string;
  signatureOperateurPng: Uint8Array | null;
  signatureDetenteurPng: Uint8Array | null;
};

export function donneesVides(): CerfaDonnees {
  return {
    equipementMarque: "",
    equipementDateMES: "",
    equipementReference: "",
    equipementLocalisation: "",
    equipementFluide: "",
    equipementCharge: "",
    equipementTeqCO2: "0.00",
    caseAssemblage: false,
    caseMiseService: false,
    caseModif: false,
    caseMaintenance: false,
    caseCtrlPerio: false,
    caseCtrlNonPerio: false,
    caseDemantel: false,
    caseAutre: false,
    autreTexte: "",
    detecteurReference: "",
    detecteurDateControle: "",
    systemePermanent: false,
    fuiteConstatee: false,
    fuites: [
      { localisation: "", realisee: false, aFaire: false },
      { localisation: "", realisee: false, aFaire: false },
      { localisation: "", realisee: false, aFaire: false },
    ],
    qa: "",
    denom: "",
    qb: "",
    qc: "",
    qd: "",
    bsff: "",
    qe: "",
    contenantId: "",
    observations: "",
  };
}
