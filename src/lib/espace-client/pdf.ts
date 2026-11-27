import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConnecte, siteDuClient } from "@/lib/espace-client/acces";
import { STATUTS_BI_VALIDES } from "@/lib/facturation/ca-facturable";
import type { Tables } from "@/lib/types";

/// Un PDF n'est servi au client que pour un BI validé d'un site auquel il a
/// accès : contrôle refait à chaque téléchargement.
export async function biAutorise(biId: string): Promise<
  { ok: true; admin: ReturnType<typeof createAdminClient>; bon: Tables<"bons_intervention"> } | { ok: false; reponse: NextResponse }
> {
  const admin = createAdminClient();
  const email = await emailConnecte(admin);
  if (!email) return { ok: false, reponse: NextResponse.redirect(new URL("/mon-contrat", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost")) };
  const { data: bon } = await admin.from("bons_intervention").select("*").eq("id", biId).maybeSingle();
  const valide = bon && (STATUTS_BI_VALIDES as string[]).includes(bon.statut);
  if (!bon || !valide || !bon.site_id || !(await siteDuClient(admin, email, bon.site_id))) {
    return { ok: false, reponse: NextResponse.json({ erreur: "Document introuvable." }, { status: 404 }) };
  }
  return { ok: true, admin, bon };
}

export function reponsePdf(contenu: Uint8Array, nom: string): NextResponse {
  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nom.replace(/[^\w.-]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
