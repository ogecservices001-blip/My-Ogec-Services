import Image from "next/image";
import { getCurrentProfile } from "@/lib/profile";

export default async function AccueilPage() {
  const profile = await getCurrentProfile();
  const mots = profile?.name.trim().split(/\s+/) ?? [];
  const prenom = mots.length > 0 ? mots[mots.length - 1] : "";

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Image src="/logo-icon.png" alt="OGEC Services" width={96} height={96} className="mb-6 object-contain" />
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Accueil</h1>
      <p className="text-sm text-slate-500">{prenom ? `Bonjour ${prenom}` : "Bonjour"}</p>
    </div>
  );
}
