import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConnecte, siteDuClient } from "@/lib/espace-client/acces";
import { reponsePdf } from "@/lib/espace-client/pdf";

/// Fiche CERFA 15497 archivée d'un équipement du site du client.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const email = await emailConnecte(admin);
  if (!email) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const { data: cerfa } = await admin.from("cerfas").select("site_id, pdf_path, numero").eq("id", id).maybeSingle();
  if (!cerfa?.site_id || !cerfa.pdf_path || !(await siteDuClient(admin, email, cerfa.site_id))) {
    return NextResponse.json({ erreur: "Document introuvable." }, { status: 404 });
  }
  const { data } = await admin.storage.from("cerfa-archives").download(cerfa.pdf_path);
  if (!data) return NextResponse.json({ erreur: "Document introuvable." }, { status: 404 });
  return reponsePdf(new Uint8Array(await data.arrayBuffer()), `CERFA-${cerfa.numero || id}.pdf`);
}
