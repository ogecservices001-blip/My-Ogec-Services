import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { genererPdfCommande } from "@/lib/commandes-fournisseur/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: commande, error } = await supabase.from("commandes_fournisseur").select("*").eq("id", id).single();
  if (error || !commande) return NextResponse.json({ erreur: "Commande introuvable." }, { status: 404 });

  const [{ data: devis }, { data: fournisseur }] = await Promise.all([
    supabase.from("devis").select("*").eq("id", commande.devis_id).single(),
    supabase.from("fournisseurs").select("*").eq("id", commande.fournisseur_id).single(),
  ]);
  if (!devis || !fournisseur) return NextResponse.json({ erreur: "Devis ou fournisseur introuvable." }, { status: 404 });

  const pdfBytes = await genererPdfCommande({ commande, devis, fournisseur });
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${commande.numero || "commande-fournisseur"}.pdf"`,
    },
  });
}
