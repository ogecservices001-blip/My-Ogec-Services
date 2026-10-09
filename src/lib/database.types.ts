export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      affaires: {
        Row: {
          created_at: string
          date_commande_client: string
          designation_prestations: string
          email_responsable_contrat: string
          id: string
          legacy_id: string | null
          nature: string
          numero_commande_client: string
          numero_devis: string
          site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_commande_client?: string
          designation_prestations?: string
          email_responsable_contrat?: string
          id?: string
          legacy_id?: string | null
          nature?: string
          numero_commande_client?: string
          numero_devis?: string
          site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_commande_client?: string
          designation_prestations?: string
          email_responsable_contrat?: string
          id?: string
          legacy_id?: string | null
          nature?: string
          numero_commande_client?: string
          numero_devis?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affaires_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affaires_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_modeles: {
        Row: {
          champs: Json
          checklist: Json
          created_at: string
          id: string
          pole: string
          texte_type: string
          updated_at: string
        }
        Insert: {
          champs?: Json
          checklist?: Json
          created_at?: string
          id?: string
          pole: string
          texte_type?: string
          updated_at?: string
        }
        Update: {
          champs?: Json
          checklist?: Json
          created_at?: string
          id?: string
          pole?: string
          texte_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      bons_intervention: {
        Row: {
          adresse: string
          checklist_values: Json
          chrono: number
          classement: string
          client_nom: string
          compte_rendu: string
          created_at: string
          created_by: string
          date_debut: string
          date_fin: string
          date_intervention: string
          date_signature: string
          devis_date_commande_client: string
          devis_id: string | null
          devis_numero: string
          devis_reference_client: string
          email: string
          entretien_groupes: string[]
          entretien_non_desservis: Json
          equipement_groupe: string
          equipement_id: string | null
          equipement_localisation: string
          equipement_nom: string
          etat_equipement: Json
          heure_debut: string
          heure_fin: string
          history: Json
          hors_contrat: boolean
          id: string
          interventions_supplementaires: Json
          json_storage_path: string
          legacy_id: string | null
          materiel_champs_en_tete: Json
          materiel_type_equipement_id: string | null
          modele_champs: Json
          mois_facturation: string
          nombre_deplacements: number
          note_interne: string
          numero: string
          numero_devis: string
          numero_provisoire: boolean
          obs_client: string
          obs_tech: string
          pdf_storage_path: string
          photos: Json
          pole: string
          prestas: Json
          sig_client: string
          sig_tech: string
          signataire: string
          signataire_tel_fixe: string
          signataire_tel_portable: string
          site: string
          site_id: string | null
          statut: string
          technicien_signataire: string
          techniciens: string[]
          temps_passe: string
          updated_at: string
        }
        Insert: {
          adresse?: string
          checklist_values?: Json
          chrono?: number
          classement?: string
          client_nom?: string
          compte_rendu?: string
          created_at?: string
          created_by?: string
          date_debut?: string
          date_fin?: string
          date_intervention?: string
          date_signature?: string
          devis_date_commande_client?: string
          devis_id?: string | null
          devis_numero?: string
          devis_reference_client?: string
          email?: string
          entretien_groupes?: string[]
          entretien_non_desservis?: Json
          equipement_groupe?: string
          equipement_id?: string | null
          equipement_localisation?: string
          equipement_nom?: string
          etat_equipement?: Json
          heure_debut?: string
          heure_fin?: string
          history?: Json
          hors_contrat?: boolean
          id?: string
          interventions_supplementaires?: Json
          json_storage_path?: string
          legacy_id?: string | null
          materiel_champs_en_tete?: Json
          materiel_type_equipement_id?: string | null
          modele_champs?: Json
          mois_facturation?: string
          nombre_deplacements?: number
          note_interne?: string
          numero?: string
          numero_devis?: string
          numero_provisoire?: boolean
          obs_client?: string
          obs_tech?: string
          pdf_storage_path?: string
          photos?: Json
          pole?: string
          prestas?: Json
          sig_client?: string
          sig_tech?: string
          signataire?: string
          signataire_tel_fixe?: string
          signataire_tel_portable?: string
          site?: string
          site_id?: string | null
          statut?: string
          technicien_signataire?: string
          techniciens?: string[]
          temps_passe?: string
          updated_at?: string
        }
        Update: {
          adresse?: string
          checklist_values?: Json
          chrono?: number
          classement?: string
          client_nom?: string
          compte_rendu?: string
          created_at?: string
          created_by?: string
          date_debut?: string
          date_fin?: string
          date_intervention?: string
          date_signature?: string
          devis_date_commande_client?: string
          devis_id?: string | null
          devis_numero?: string
          devis_reference_client?: string
          email?: string
          entretien_groupes?: string[]
          entretien_non_desservis?: Json
          equipement_groupe?: string
          equipement_id?: string | null
          equipement_localisation?: string
          equipement_nom?: string
          etat_equipement?: Json
          heure_debut?: string
          heure_fin?: string
          history?: Json
          hors_contrat?: boolean
          id?: string
          interventions_supplementaires?: Json
          json_storage_path?: string
          legacy_id?: string | null
          materiel_champs_en_tete?: Json
          materiel_type_equipement_id?: string | null
          modele_champs?: Json
          mois_facturation?: string
          nombre_deplacements?: number
          note_interne?: string
          numero?: string
          numero_devis?: string
          numero_provisoire?: boolean
          obs_client?: string
          obs_tech?: string
          pdf_storage_path?: string
          photos?: Json
          pole?: string
          prestas?: Json
          sig_client?: string
          sig_tech?: string
          signataire?: string
          signataire_tel_fixe?: string
          signataire_tel_portable?: string
          site?: string
          site_id?: string | null
          statut?: string
          technicien_signataire?: string
          techniciens?: string[]
          temps_passe?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bons_intervention_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_intervention_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_intervention_materiel_type_equipement_id_fkey"
            columns: ["materiel_type_equipement_id"]
            isOneToOne: false
            referencedRelation: "types_equipement"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_intervention_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_intervention_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["id"]
          },
        ]
      }
      commandes_fournisseur: {
        Row: {
          adresse_livraison: string
          ar_fournisseur: string
          chrono_fournisseur: number
          conditions_paiement: string
          created_at: string
          date_commande: string
          date_livraison_prevue: string
          devis_fournisseur_date: string
          devis_fournisseur_numero: string
          devis_id: string
          envoyee_le: string
          fournisseur_id: string
          id: string
          incoterm: string
          interlocuteur: Json
          lignes: Json
          livre: boolean
          numero: string
          observations: string
          port: string
          redacteur: string
          relance: string
          taux_tva: number
          updated_at: string
          validite_offre: string
        }
        Insert: {
          adresse_livraison?: string
          ar_fournisseur?: string
          chrono_fournisseur?: number
          conditions_paiement?: string
          created_at?: string
          date_commande?: string
          date_livraison_prevue?: string
          devis_fournisseur_date?: string
          devis_fournisseur_numero?: string
          devis_id: string
          envoyee_le?: string
          fournisseur_id: string
          id?: string
          incoterm?: string
          interlocuteur?: Json
          lignes?: Json
          livre?: boolean
          numero?: string
          observations?: string
          port?: string
          redacteur?: string
          relance?: string
          taux_tva?: number
          updated_at?: string
          validite_offre?: string
        }
        Update: {
          adresse_livraison?: string
          ar_fournisseur?: string
          chrono_fournisseur?: number
          conditions_paiement?: string
          created_at?: string
          date_commande?: string
          date_livraison_prevue?: string
          devis_fournisseur_date?: string
          devis_fournisseur_numero?: string
          devis_id?: string
          envoyee_le?: string
          fournisseur_id?: string
          id?: string
          incoterm?: string
          interlocuteur?: Json
          lignes?: Json
          livre?: boolean
          numero?: string
          observations?: string
          port?: string
          redacteur?: string
          relance?: string
          taux_tva?: number
          updated_at?: string
          validite_offre?: string
        }
        Relationships: [
          {
            foreignKeyName: "commandes_fournisseur_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commandes_fournisseur_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      compteurs: {
        Row: {
          annee: number
          cle: string
          valeur: number
        }
        Insert: {
          annee: number
          cle: string
          valeur?: number
        }
        Update: {
          annee?: number
          cle?: string
          valeur?: number
        }
        Relationships: []
      }
      demandes_depannage: {
        Row: {
          bon_intervention_id: string | null
          client_nom: string
          client_site: string
          date_creation: string
          date_intervention_prevue: string | null
          date_traitement: string | null
          email: string
          equipement_id: string | null
          equipement_nom: string
          id: string
          intervenant_id: string | null
          legacy_id: string | null
          lieu_panne: string
          message: string
          numero: string
          numero_demande_client: string
          site_id: string | null
          statut: Database["public"]["Enums"]["statut_depannage"]
        }
        Insert: {
          bon_intervention_id?: string | null
          client_nom?: string
          client_site?: string
          date_creation?: string
          date_intervention_prevue?: string | null
          date_traitement?: string | null
          email?: string
          equipement_id?: string | null
          equipement_nom?: string
          id?: string
          intervenant_id?: string | null
          legacy_id?: string | null
          lieu_panne?: string
          message?: string
          numero?: string
          numero_demande_client?: string
          site_id?: string | null
          statut?: Database["public"]["Enums"]["statut_depannage"]
        }
        Update: {
          bon_intervention_id?: string | null
          client_nom?: string
          client_site?: string
          date_creation?: string
          date_intervention_prevue?: string | null
          date_traitement?: string | null
          email?: string
          equipement_id?: string | null
          equipement_nom?: string
          id?: string
          intervenant_id?: string | null
          legacy_id?: string | null
          lieu_panne?: string
          message?: string
          numero?: string
          numero_demande_client?: string
          site_id?: string | null
          statut?: Database["public"]["Enums"]["statut_depannage"]
        }
        Relationships: [
          {
            foreignKeyName: "demandes_depannage_bon_intervention_id_fkey"
            columns: ["bon_intervention_id"]
            isOneToOne: false
            referencedRelation: "bons_intervention"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_depannage_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_depannage_intervenant_id_fkey"
            columns: ["intervenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_depannage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_depannage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          annule: boolean
          bi_reference_historique: string
          created_at: string
          date_commande_client: string
          date_devis: string
          date_mise_a_disposition_fourniture: string
          debours_materiel_prevu: number | null
          email_responsable_contrat: string
          equipement_id: string | null
          heures_prevues: number | null
          id: string
          item: string
          legacy_id: string | null
          libelle: string
          mois_facturation: string
          montant: number | null
          nature: string
          numero: string
          redacteur: string
          reference_client: string
          remarques: string
          site_id: string
          statut_commande_fournisseur: string
          updated_at: string
        }
        Insert: {
          annule?: boolean
          bi_reference_historique?: string
          created_at?: string
          date_commande_client?: string
          date_devis?: string
          date_mise_a_disposition_fourniture?: string
          debours_materiel_prevu?: number | null
          email_responsable_contrat?: string
          equipement_id?: string | null
          heures_prevues?: number | null
          id?: string
          item?: string
          legacy_id?: string | null
          libelle?: string
          mois_facturation?: string
          montant?: number | null
          nature?: string
          numero?: string
          redacteur?: string
          reference_client?: string
          remarques?: string
          site_id: string
          statut_commande_fournisseur?: string
          updated_at?: string
        }
        Update: {
          annule?: boolean
          bi_reference_historique?: string
          created_at?: string
          date_commande_client?: string
          date_devis?: string
          date_mise_a_disposition_fourniture?: string
          debours_materiel_prevu?: number | null
          email_responsable_contrat?: string
          equipement_id?: string | null
          heures_prevues?: number | null
          id?: string
          item?: string
          legacy_id?: string | null
          libelle?: string
          mois_facturation?: string
          montant?: number | null
          nature?: string
          numero?: string
          redacteur?: string
          reference_client?: string
          remarques?: string
          site_id?: string
          statut_commande_fournisseur?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["id"]
          },
        ]
      }
      equipements: {
        Row: {
          champs_en_tete: Json
          code_qr: string
          created_at: string
          groupe: string
          hors_contrat: boolean
          id: string
          legacy_id: string | null
          localisation: string
          nom: string
          numero_equipement: string
          reference_horaire_id: string | null
          remarque_technicien: string
          site_id: string
          type_equipement_id: string
          updated_at: string
        }
        Insert: {
          champs_en_tete?: Json
          code_qr?: string
          created_at?: string
          groupe?: string
          hors_contrat?: boolean
          id?: string
          legacy_id?: string | null
          localisation?: string
          nom?: string
          numero_equipement?: string
          reference_horaire_id?: string | null
          remarque_technicien?: string
          site_id: string
          type_equipement_id: string
          updated_at?: string
        }
        Update: {
          champs_en_tete?: Json
          code_qr?: string
          created_at?: string
          groupe?: string
          hors_contrat?: boolean
          id?: string
          legacy_id?: string | null
          localisation?: string
          nom?: string
          numero_equipement?: string
          reference_horaire_id?: string | null
          remarque_technicien?: string
          site_id?: string
          type_equipement_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipements_reference_horaire_id_fkey"
            columns: ["reference_horaire_id"]
            isOneToOne: false
            referencedRelation: "references_horaires"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipements_type_equipement_id_fkey"
            columns: ["type_equipement_id"]
            isOneToOne: false
            referencedRelation: "types_equipement"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          adresse: string
          cgv_recues: string
          code_postal: string
          commune: string
          complement_adresse: string
          created_at: string
          delai_paiement: string
          denomination_courte: string
          fiche_maj_le: string
          forme_juridique: string
          id: string
          interlocuteurs: Json
          legacy_id: string | null
          localisation: string
          mode_reglement: string
          nature_fourniture: string
          nom: string
          produits_cles: string
          raison_sociale_exacte: string
          rcs_rm: string
          remarques: string
          siren: string
          siret: string
          site_web: string
          tva_intracom: string
          updated_at: string
        }
        Insert: {
          adresse?: string
          cgv_recues?: string
          code_postal?: string
          commune?: string
          complement_adresse?: string
          created_at?: string
          delai_paiement?: string
          denomination_courte?: string
          fiche_maj_le?: string
          forme_juridique?: string
          id?: string
          interlocuteurs?: Json
          legacy_id?: string | null
          localisation?: string
          mode_reglement?: string
          nature_fourniture?: string
          nom?: string
          produits_cles?: string
          raison_sociale_exacte?: string
          rcs_rm?: string
          remarques?: string
          siren?: string
          siret?: string
          site_web?: string
          tva_intracom?: string
          updated_at?: string
        }
        Update: {
          adresse?: string
          cgv_recues?: string
          code_postal?: string
          commune?: string
          complement_adresse?: string
          created_at?: string
          delai_paiement?: string
          denomination_courte?: string
          fiche_maj_le?: string
          forme_juridique?: string
          id?: string
          interlocuteurs?: Json
          legacy_id?: string | null
          localisation?: string
          mode_reglement?: string
          nature_fourniture?: string
          nom?: string
          produits_cles?: string
          raison_sociale_exacte?: string
          rcs_rm?: string
          remarques?: string
          siren?: string
          siret?: string
          site_web?: string
          tva_intracom?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          commune_habitation: string
          created_at: string
          email_perso: string
          email_pro: string
          id: string
          legacy_id: string | null
          name: string
          portable: string
          qualite: string
          role: Database["public"]["Enums"]["user_role"]
          vehicule: string
        }
        Insert: {
          commune_habitation?: string
          created_at?: string
          email_perso?: string
          email_pro?: string
          id: string
          legacy_id?: string | null
          name?: string
          portable?: string
          qualite?: string
          role?: Database["public"]["Enums"]["user_role"]
          vehicule?: string
        }
        Update: {
          commune_habitation?: string
          created_at?: string
          email_perso?: string
          email_pro?: string
          id?: string
          legacy_id?: string | null
          name?: string
          portable?: string
          qualite?: string
          role?: Database["public"]["Enums"]["user_role"]
          vehicule?: string
        }
        Relationships: []
      }
      profils_mdp: {
        Row: {
          mdp_app: string
          profil_id: string
          updated_at: string
        }
        Insert: {
          mdp_app?: string
          profil_id: string
          updated_at?: string
        }
        Update: {
          mdp_app?: string
          profil_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profils_mdp_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      references_horaires: {
        Row: {
          created_at: string
          designation: string
          hrs_assistant_an: number
          hrs_assistant_men: number
          hrs_assistant_sem: number
          hrs_assistant_tri: number
          hrs_tech_an: number
          hrs_tech_men: number
          hrs_tech_sem: number
          hrs_tech_tri: number
          id: string
          legacy_id: string | null
          type_equipement1: string
          type_equipement2: string
          type_equipement3: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string
          hrs_assistant_an?: number
          hrs_assistant_men?: number
          hrs_assistant_sem?: number
          hrs_assistant_tri?: number
          hrs_tech_an?: number
          hrs_tech_men?: number
          hrs_tech_sem?: number
          hrs_tech_tri?: number
          id?: string
          legacy_id?: string | null
          type_equipement1?: string
          type_equipement2?: string
          type_equipement3?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string
          hrs_assistant_an?: number
          hrs_assistant_men?: number
          hrs_assistant_sem?: number
          hrs_assistant_tri?: number
          hrs_tech_an?: number
          hrs_tech_men?: number
          hrs_tech_sem?: number
          hrs_tech_tri?: number
          id?: string
          legacy_id?: string | null
          type_equipement1?: string
          type_equipement2?: string
          type_equipement3?: string
          updated_at?: string
        }
        Relationships: []
      }
      releves: {
        Row: {
          checklist_values: Json
          created_at: string
          date: string
          equipement_id: string
          groupes_mesures: Json
          id: string
          informations_internes: string
          legacy_id: string | null
          nom_tech: string
          photos: string[]
          remarque1: string
          remarque2: string
          site_id: string
          validation_fonctionnement: string | null
        }
        Insert: {
          checklist_values?: Json
          created_at?: string
          date?: string
          equipement_id: string
          groupes_mesures?: Json
          id?: string
          informations_internes?: string
          legacy_id?: string | null
          nom_tech?: string
          photos?: string[]
          remarque1?: string
          remarque2?: string
          site_id: string
          validation_fonctionnement?: string | null
        }
        Update: {
          checklist_values?: Json
          created_at?: string
          date?: string
          equipement_id?: string
          groupes_mesures?: Json
          id?: string
          informations_internes?: string
          legacy_id?: string | null
          nom_tech?: string
          photos?: string[]
          remarque1?: string
          remarque2?: string
          site_id?: string
          validation_fonctionnement?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "releves_equipement_id_fkey"
            columns: ["equipement_id"]
            isOneToOne: false
            referencedRelation: "equipements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releves_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "releves_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites_view"
            referencedColumns: ["id"]
          },
        ]
      }
      signalements: {
        Row: {
          auteur_id: string
          auteur_nom: string
          created_at: string
          id: string
          menu: string
          message: string
          nature: string
          numero: string
          sous_menu: string
          traite: boolean
          type: Database["public"]["Enums"]["signalement_type"]
        }
        Insert: {
          auteur_id: string
          auteur_nom: string
          created_at?: string
          id?: string
          menu?: string
          message?: string
          nature?: string
          numero?: string
          sous_menu?: string
          traite?: boolean
          type: Database["public"]["Enums"]["signalement_type"]
        }
        Update: {
          auteur_id?: string
          auteur_nom?: string
          created_at?: string
          id?: string
          menu?: string
          message?: string
          nature?: string
          numero?: string
          sous_menu?: string
          traite?: boolean
          type?: Database["public"]["Enums"]["signalement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "signalements_auteur_id_fkey"
            columns: ["auteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      signalements_historique: {
        Row: {
          action: string
          auteur_nom: string
          created_at: string
          id: string
          signalement_id: string
        }
        Insert: {
          action: string
          auteur_nom: string
          created_at?: string
          id?: string
          signalement_id: string
        }
        Update: {
          action?: string
          auteur_nom?: string
          created_at?: string
          id?: string
          signalement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signalements_historique_signalement_id_fkey"
            columns: ["signalement_id"]
            isOneToOne: false
            referencedRelation: "signalements"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          adresse: string
          adresse_facturation: string
          code_postal: string
          code_postal_facturation: string
          commune: string
          commune_facturation: string
          complement_adresse: string
          complement_adresse_facturation: string
          courriel_interlocuteur_facturation: string
          courriel_interlocuteur_site: string
          courriel_responsable: string
          courriel_tiers: string
          created_at: string
          date_fin_contrat: string
          date_indice_ch: string
          date_indice_ch_prime: string
          date_indice_s: string
          date_indice_s_prime: string
          date_offre: string
          date_prise_effet_contrat: string
          date_revision: string
          delai_intervention: string
          duree_contrat: string
          epi_specifique: string
          forfait_deplacement: string
          forfait_deplacement_revise: string
          formule_revision_depannage: string
          formule_revision_entretien: string
          freq_entretien_an: string
          freq_factu_annuelle: string
          habilitation_specifique: string
          heures_acces: string
          id: string
          interlocuteur_facturation: string
          interlocuteur_site: string
          interlocuteur_tiers: string
          jour_acces: string
          legacy_id: string | null
          modif_ri_ou_bg: string
          montant_contrat_av: string
          montant_contrat_av_revise: string
          moyen_acces: string
          n_affaire: string
          nb_heures_vendues: string
          nb_heures_vendues_assistant: string
          nom: string
          portable_interlocuteur_facturation: string
          portable_interlocuteur_site: string
          portable_responsable: string
          portable_tiers: string
          qte_heures_programmees: string
          qte_heures_restantes: string
          reference_offre_ogs: string
          remarques_libres: string
          responsable_contrat: string
          site: string
          taux_horaire_regie: string
          taux_horaire_revise: string
          taux_horaire_vendu: string
          tel_fixe_interlocuteur_facturation: string
          tel_fixe_interlocuteur_site: string
          tel_fixe_responsable: string
          tel_fixe_tiers: string
          updated_at: string
          valeur_indice_ch: string
          valeur_indice_ch_prime: string
          valeur_indice_s: string
          valeur_indice_s_prime: string
        }
        Insert: {
          adresse?: string
          adresse_facturation?: string
          code_postal?: string
          code_postal_facturation?: string
          commune?: string
          commune_facturation?: string
          complement_adresse?: string
          complement_adresse_facturation?: string
          courriel_interlocuteur_facturation?: string
          courriel_interlocuteur_site?: string
          courriel_responsable?: string
          courriel_tiers?: string
          created_at?: string
          date_fin_contrat?: string
          date_indice_ch?: string
          date_indice_ch_prime?: string
          date_indice_s?: string
          date_indice_s_prime?: string
          date_offre?: string
          date_prise_effet_contrat?: string
          date_revision?: string
          delai_intervention?: string
          duree_contrat?: string
          epi_specifique?: string
          forfait_deplacement?: string
          forfait_deplacement_revise?: string
          formule_revision_depannage?: string
          formule_revision_entretien?: string
          freq_entretien_an?: string
          freq_factu_annuelle?: string
          habilitation_specifique?: string
          heures_acces?: string
          id?: string
          interlocuteur_facturation?: string
          interlocuteur_site?: string
          interlocuteur_tiers?: string
          jour_acces?: string
          legacy_id?: string | null
          modif_ri_ou_bg?: string
          montant_contrat_av?: string
          montant_contrat_av_revise?: string
          moyen_acces?: string
          n_affaire?: string
          nb_heures_vendues?: string
          nb_heures_vendues_assistant?: string
          nom?: string
          portable_interlocuteur_facturation?: string
          portable_interlocuteur_site?: string
          portable_responsable?: string
          portable_tiers?: string
          qte_heures_programmees?: string
          qte_heures_restantes?: string
          reference_offre_ogs?: string
          remarques_libres?: string
          responsable_contrat?: string
          site?: string
          taux_horaire_regie?: string
          taux_horaire_revise?: string
          taux_horaire_vendu?: string
          tel_fixe_interlocuteur_facturation?: string
          tel_fixe_interlocuteur_site?: string
          tel_fixe_responsable?: string
          tel_fixe_tiers?: string
          updated_at?: string
          valeur_indice_ch?: string
          valeur_indice_ch_prime?: string
          valeur_indice_s?: string
          valeur_indice_s_prime?: string
        }
        Update: {
          adresse?: string
          adresse_facturation?: string
          code_postal?: string
          code_postal_facturation?: string
          commune?: string
          commune_facturation?: string
          complement_adresse?: string
          complement_adresse_facturation?: string
          courriel_interlocuteur_facturation?: string
          courriel_interlocuteur_site?: string
          courriel_responsable?: string
          courriel_tiers?: string
          created_at?: string
          date_fin_contrat?: string
          date_indice_ch?: string
          date_indice_ch_prime?: string
          date_indice_s?: string
          date_indice_s_prime?: string
          date_offre?: string
          date_prise_effet_contrat?: string
          date_revision?: string
          delai_intervention?: string
          duree_contrat?: string
          epi_specifique?: string
          forfait_deplacement?: string
          forfait_deplacement_revise?: string
          formule_revision_depannage?: string
          formule_revision_entretien?: string
          freq_entretien_an?: string
          freq_factu_annuelle?: string
          habilitation_specifique?: string
          heures_acces?: string
          id?: string
          interlocuteur_facturation?: string
          interlocuteur_site?: string
          interlocuteur_tiers?: string
          jour_acces?: string
          legacy_id?: string | null
          modif_ri_ou_bg?: string
          montant_contrat_av?: string
          montant_contrat_av_revise?: string
          moyen_acces?: string
          n_affaire?: string
          nb_heures_vendues?: string
          nb_heures_vendues_assistant?: string
          nom?: string
          portable_interlocuteur_facturation?: string
          portable_interlocuteur_site?: string
          portable_responsable?: string
          portable_tiers?: string
          qte_heures_programmees?: string
          qte_heures_restantes?: string
          reference_offre_ogs?: string
          remarques_libres?: string
          responsable_contrat?: string
          site?: string
          taux_horaire_regie?: string
          taux_horaire_revise?: string
          taux_horaire_vendu?: string
          tel_fixe_interlocuteur_facturation?: string
          tel_fixe_interlocuteur_site?: string
          tel_fixe_responsable?: string
          tel_fixe_tiers?: string
          updated_at?: string
          valeur_indice_ch?: string
          valeur_indice_ch_prime?: string
          valeur_indice_s?: string
          valeur_indice_s_prime?: string
        }
        Relationships: []
      }
      types_equipement: {
        Row: {
          champs_en_tete_supplementaires: Json
          champs_listes: Json
          checklist: Json
          code: string
          created_at: string
          groupes_mesures: Json
          id: string
          nom: string
          type_equipement1_fixe: string
          updated_at: string
        }
        Insert: {
          champs_en_tete_supplementaires?: Json
          champs_listes?: Json
          checklist?: Json
          code?: string
          created_at?: string
          groupes_mesures?: Json
          id: string
          nom?: string
          type_equipement1_fixe?: string
          updated_at?: string
        }
        Update: {
          champs_en_tete_supplementaires?: Json
          champs_listes?: Json
          checklist?: Json
          code?: string
          created_at?: string
          groupes_mesures?: Json
          id?: string
          nom?: string
          type_equipement1_fixe?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      sites_view: {
        Row: {
          adresse: string | null
          adresse_facturation: string | null
          code_postal: string | null
          code_postal_facturation: string | null
          commune: string | null
          commune_facturation: string | null
          complement_adresse: string | null
          complement_adresse_facturation: string | null
          courriel_interlocuteur_facturation: string | null
          courriel_interlocuteur_site: string | null
          courriel_responsable: string | null
          courriel_tiers: string | null
          created_at: string | null
          date_fin_contrat: string | null
          date_indice_ch: string | null
          date_indice_ch_prime: string | null
          date_indice_s: string | null
          date_indice_s_prime: string | null
          date_offre: string | null
          date_prise_effet_contrat: string | null
          date_revision: string | null
          delai_intervention: string | null
          duree_contrat: string | null
          epi_specifique: string | null
          forfait_deplacement: string | null
          forfait_deplacement_revise: string | null
          formule_revision_depannage: string | null
          formule_revision_entretien: string | null
          freq_entretien_an: string | null
          freq_factu_annuelle: string | null
          habilitation_specifique: string | null
          heures_acces: string | null
          hors_contrat: boolean | null
          id: string | null
          interlocuteur_facturation: string | null
          interlocuteur_site: string | null
          interlocuteur_tiers: string | null
          jour_acces: string | null
          legacy_id: string | null
          modif_ri_ou_bg: string | null
          montant_contrat_av: string | null
          montant_contrat_av_revise: string | null
          moyen_acces: string | null
          n_affaire: string | null
          nb_heures_vendues: string | null
          nb_heures_vendues_assistant: string | null
          nom: string | null
          portable_interlocuteur_facturation: string | null
          portable_interlocuteur_site: string | null
          portable_responsable: string | null
          portable_tiers: string | null
          qte_heures_programmees: string | null
          qte_heures_restantes: string | null
          reference_offre_ogs: string | null
          remarques_libres: string | null
          responsable_contrat: string | null
          site: string | null
          taux_horaire_regie: string | null
          taux_horaire_revise: string | null
          taux_horaire_vendu: string | null
          tel_fixe_interlocuteur_facturation: string | null
          tel_fixe_interlocuteur_site: string | null
          tel_fixe_responsable: string | null
          tel_fixe_tiers: string | null
          updated_at: string | null
          valeur_indice_ch: string | null
          valeur_indice_ch_prime: string | null
          valeur_indice_s: string | null
          valeur_indice_s_prime: string | null
        }
        Insert: {
          adresse?: string | null
          adresse_facturation?: string | null
          code_postal?: string | null
          code_postal_facturation?: string | null
          commune?: string | null
          commune_facturation?: string | null
          complement_adresse?: string | null
          complement_adresse_facturation?: string | null
          courriel_interlocuteur_facturation?: string | null
          courriel_interlocuteur_site?: string | null
          courriel_responsable?: string | null
          courriel_tiers?: string | null
          created_at?: string | null
          date_fin_contrat?: string | null
          date_indice_ch?: string | null
          date_indice_ch_prime?: string | null
          date_indice_s?: string | null
          date_indice_s_prime?: string | null
          date_offre?: string | null
          date_prise_effet_contrat?: string | null
          date_revision?: string | null
          delai_intervention?: string | null
          duree_contrat?: string | null
          epi_specifique?: string | null
          forfait_deplacement?: string | null
          forfait_deplacement_revise?: string | null
          formule_revision_depannage?: string | null
          formule_revision_entretien?: string | null
          freq_entretien_an?: string | null
          freq_factu_annuelle?: string | null
          habilitation_specifique?: string | null
          heures_acces?: string | null
          hors_contrat?: never
          id?: string | null
          interlocuteur_facturation?: string | null
          interlocuteur_site?: string | null
          interlocuteur_tiers?: string | null
          jour_acces?: string | null
          legacy_id?: string | null
          modif_ri_ou_bg?: string | null
          montant_contrat_av?: string | null
          montant_contrat_av_revise?: string | null
          moyen_acces?: string | null
          n_affaire?: string | null
          nb_heures_vendues?: string | null
          nb_heures_vendues_assistant?: string | null
          nom?: string | null
          portable_interlocuteur_facturation?: string | null
          portable_interlocuteur_site?: string | null
          portable_responsable?: string | null
          portable_tiers?: string | null
          qte_heures_programmees?: string | null
          qte_heures_restantes?: string | null
          reference_offre_ogs?: string | null
          remarques_libres?: string | null
          responsable_contrat?: string | null
          site?: string | null
          taux_horaire_regie?: string | null
          taux_horaire_revise?: string | null
          taux_horaire_vendu?: string | null
          tel_fixe_interlocuteur_facturation?: string | null
          tel_fixe_interlocuteur_site?: string | null
          tel_fixe_responsable?: string | null
          tel_fixe_tiers?: string | null
          updated_at?: string | null
          valeur_indice_ch?: string | null
          valeur_indice_ch_prime?: string | null
          valeur_indice_s?: string | null
          valeur_indice_s_prime?: string | null
        }
        Update: {
          adresse?: string | null
          adresse_facturation?: string | null
          code_postal?: string | null
          code_postal_facturation?: string | null
          commune?: string | null
          commune_facturation?: string | null
          complement_adresse?: string | null
          complement_adresse_facturation?: string | null
          courriel_interlocuteur_facturation?: string | null
          courriel_interlocuteur_site?: string | null
          courriel_responsable?: string | null
          courriel_tiers?: string | null
          created_at?: string | null
          date_fin_contrat?: string | null
          date_indice_ch?: string | null
          date_indice_ch_prime?: string | null
          date_indice_s?: string | null
          date_indice_s_prime?: string | null
          date_offre?: string | null
          date_prise_effet_contrat?: string | null
          date_revision?: string | null
          delai_intervention?: string | null
          duree_contrat?: string | null
          epi_specifique?: string | null
          forfait_deplacement?: string | null
          forfait_deplacement_revise?: string | null
          formule_revision_depannage?: string | null
          formule_revision_entretien?: string | null
          freq_entretien_an?: string | null
          freq_factu_annuelle?: string | null
          habilitation_specifique?: string | null
          heures_acces?: string | null
          hors_contrat?: never
          id?: string | null
          interlocuteur_facturation?: string | null
          interlocuteur_site?: string | null
          interlocuteur_tiers?: string | null
          jour_acces?: string | null
          legacy_id?: string | null
          modif_ri_ou_bg?: string | null
          montant_contrat_av?: string | null
          montant_contrat_av_revise?: string | null
          moyen_acces?: string | null
          n_affaire?: string | null
          nb_heures_vendues?: string | null
          nb_heures_vendues_assistant?: string | null
          nom?: string | null
          portable_interlocuteur_facturation?: string | null
          portable_interlocuteur_site?: string | null
          portable_responsable?: string | null
          portable_tiers?: string | null
          qte_heures_programmees?: string | null
          qte_heures_restantes?: string | null
          reference_offre_ogs?: string | null
          remarques_libres?: string | null
          responsable_contrat?: string | null
          site?: string | null
          taux_horaire_regie?: string | null
          taux_horaire_revise?: string | null
          taux_horaire_vendu?: string | null
          tel_fixe_interlocuteur_facturation?: string | null
          tel_fixe_interlocuteur_site?: string | null
          tel_fixe_responsable?: string | null
          tel_fixe_tiers?: string | null
          updated_at?: string | null
          valeur_indice_ch?: string | null
          valeur_indice_ch_prime?: string | null
          valeur_indice_s?: string | null
          valeur_indice_s_prime?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      prochain_chrono: {
        Args: { p_annee: number; p_cle: string }
        Returns: number
      }
    }
    Enums: {
      signalement_type: "bug" | "suggestion" | "remarque"
      statut_depannage: "nouvelle" | "traitee"
      user_role: "admin" | "technicien" | "en_attente" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      signalement_type: ["bug", "suggestion", "remarque"],
      statut_depannage: ["nouvelle", "traitee"],
      user_role: ["admin", "technicien", "en_attente", "client"],
    },
  },
} as const
