import { biAutorise, reponsePdf } from "@/lib/espace-client/pdf";
import { genererPdfAvecPhotos } from "@/lib/bi/archive";

/// Bon d'intervention validé : l'exemplaire archivé à la validation, sinon
/// regénéré.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const acces = await biAutorise(id);
  if (!acces.ok) return acces.reponse;
  const { admin, bon } = acces;

  if (bon.pdf_storage_path) {
    const { data } = await admin.storage.from("bi-archives").download(bon.pdf_storage_path);
    if (data) return reponsePdf(new Uint8Array(await data.arrayBuffer()), `${bon.numero}.pdf`);
  }
  return reponsePdf(await genererPdfAvecPhotos(admin, bon), `${bon.numero}.pdf`);
}
