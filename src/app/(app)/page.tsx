import Image from "next/image";
import { getCurrentProfile } from "@/lib/profile";

export default async function AccueilPage() {
  const profile = await getCurrentProfile();
  const mots = profile?.name.trim().split(/\s+/) ?? [];
  const prenom = mots.length > 0 ? mots[mots.length - 1] : "";

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="mb-1 text-sm font-medium text-slate-400">Accueil</p>
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-slate-900">
        {prenom ? `Bonjour ${prenom}` : "Bonjour"}
      </h1>
      <Image src="/logo-icon.png" alt="OGEC Services" width={160} height={160} className="object-contain" />
    </div>
  );
}
