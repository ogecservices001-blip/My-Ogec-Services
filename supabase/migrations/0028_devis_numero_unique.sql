-- Un numéro de devis ne peut exister qu'une fois. Les devis créés depuis
-- l'appli reçoivent leur numéro à l'enregistrement : la contrainte garantit
-- qu'une création concurrente ne produit jamais de doublon.
create unique index devis_numero_key on public.devis (numero) where numero <> '';
