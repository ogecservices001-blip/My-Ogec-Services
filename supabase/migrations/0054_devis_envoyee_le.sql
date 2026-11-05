-- Date d'envoi du devis par email au client (PDF en pièce jointe) —
-- même principe que commandes_fournisseur.envoyee_le.
alter table public.devis
  add column envoyee_le text not null default '';
