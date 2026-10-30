import Image from "next/image";
import { getCurrentProfile } from "@/lib/profile";

export default async function AccueilPage() {
  const profile = await getCurrentProfile();
  const mots = profile?.name.trim().split(/\s+/) ?? [];
  const prenom = mots.length > 0 ? mots[mots.length - 1] : "";

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="mb-2 text-xl font-bold tracking-tight text-brand-green-dark">Accueil</p>
      <h1 className="mb-10 text-3xl font-bold tracking-tight text-slate-900">
        {prenom ? `Bonjour ${prenom}` : "Bonjour"}
      </h1>
      <Image
        src="/logo-icon.png"
        alt="OGEC Services"
        width={180}
        height={180}
        className="mx-auto object-contain drop-shadow-sm"
      />
    </div>
  );
}
