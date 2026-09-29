import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { requireProfile } from "@/lib/auth";
import { urlPubliqueEquipement } from "@/lib/gmao/qr";

/// Image PNG du QR code à imprimer et coller sur l'équipement physique
/// (voir equipement_qr_dialog.dart) — encode l'URL publique de
/// consultation + demande de dépannage (page `/q/{code}`, Prompt 7).
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  await requireProfile();
  const { code } = await params;

  const buffer = await QRCode.toBuffer(urlPubliqueEquipement(code), {
    width: 440,
    margin: 2,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
