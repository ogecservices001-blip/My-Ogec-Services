export type SousMenu = { nom: string; href?: string };
export type Module = { nom: string; actif: boolean; sousMenus: SousMenu[] };

/// Menu technicien volontairement minimal : créer un BI se fait depuis
/// les boutons contextuels (carte devis dans Prestation sur commande,
/// carte ticket dans Suivi Dépannages) ou, pour un appel SAV non
/// encore enregistré en ticket, via "Dépannage" ici. Le bureau (admin)
/// ne crée jamais de BI lui-même : "Dépannage" et "Entretien sous
/// contrat" ne lui sont pas montrés, seul "Tous les bons" (vérification)
/// et "Référentiel BI" (modèles par pôle) le sont.
///
/// Même source utilisée par la sidebar et par le menu guidé du
/// Signalement retour terrain (Niveaux 2/3) — pour que le choix
/// "menu > sous-menu" y reflète toujours exactement les écrans
/// réellement visibles par la personne qui signale.
export function construireModules(isAdmin: boolean): Module[] {
  return [
    {
      nom: "Répertoire",
      actif: true,
      sousMenus: [
        { nom: "Clients sous contrat", href: "/repertoire/clients" },
        { nom: "Clients hors contrat", href: "/repertoire/clients?horsContrat=1" },
        { nom: "Fournisseurs", href: "/repertoire/fournisseurs" },
        { nom: "Collaborateurs", href: "/repertoire/collaborateurs" },
      ],
    },
    {
      nom: "Suivi Dépannages",
      actif: true,
      sousMenus: [{ nom: "Demandes reçues", href: "/depannages" }],
    },
    {
      nom: "Bon d'intervention",
      actif: true,
      sousMenus: isAdmin
        ? [{ nom: "Tous les bons", href: "/bi" }]
        : [
            { nom: "Dépannage", href: "/bi/nouveau?pole=60" },
            { nom: "Entretien sous contrat", href: "/bi/nouveau?pole=20" },
          ],
    },
    {
      nom: "GMAO",
      actif: true,
      sousMenus: [
        { nom: "Accueil GMAO", href: "/gmao" },
        { nom: "Clients sous contrat", href: "/gmao/clients?horsContrat=0" },
        { nom: "Clients hors contrat", href: "/gmao/clients?horsContrat=1" },
      ],
    },
    {
      nom: "CERFA",
      actif: false,
      sousMenus: [
        { nom: "Commencer nouveau CERFA" },
        { nom: "Visualiser un équipement" },
        { nom: "Visualiser un bordereau" },
        { nom: "Point sur les CERFA" },
        { nom: "Créer modèle CERFA" },
        { nom: "Envoyer un CERFA rempli" },
        { nom: "Ajouter un équipement" },
        { nom: "Vérifier les dossiers clients" },
      ],
    },
    {
      nom: "Prestation sur commande",
      actif: true,
      sousMenus: [{ nom: "À réaliser / Réalisées", href: "/prestations" }],
    },
    { nom: "Planning Maintenance", actif: false, sousMenus: [] },
    {
      nom: "Devis",
      actif: true,
      sousMenus: [
        { nom: "Clients sous contrat", href: "/devis" },
        { nom: "Clients hors contrat", href: "/devis?horsContrat=1" },
      ],
    },
    {
      nom: "Signalement retour information terrain",
      actif: true,
      sousMenus: [{ nom: "Envoyer / consulter", href: "/signalements" }],
    },
    {
      nom: "Référentiel GMAO",
      actif: true,
      sousMenus: [
        { nom: "Référentiel Heures", href: "/gmao/referentiel/heures" },
        { nom: "Référentiel Gammes de maintenance", href: "/gmao/referentiel/familles" },
      ],
    },
    ...(isAdmin
      ? [
          {
            nom: "Référentiel BI",
            actif: true,
            sousMenus: [{ nom: "Modèles par pôle", href: "/bi/referentiel" }],
          },
        ]
      : []),
  ];
}
