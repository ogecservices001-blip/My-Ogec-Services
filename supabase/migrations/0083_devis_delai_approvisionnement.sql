alter table public.devis
  add column delai_approvisionnement text not null default 'Disponible sauf vente entre temps';
