import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "technicien")) {
    return new NextResponse("Accès refusé", { status: 403 });
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.from("cerfas").select("numero, pdf_path").eq("id", id).single();
  if (!c?.pdf_path) return new NextResponse("CERFA introuvable", { status: 404 });
  const { data } = await supabase.storage.from("cerfa-archives").download(c.pdf_path);
  if (!data) return new NextResponse("PDF introuvable", { status: 404 });
  const nom = `${c.numero.replace(/[/\\"]/g, "-")}.pdf`;
  return new NextResponse(Buffer.from(await data.arrayBuffer()), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(nom)}`,
    },
  });
}
