import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { LogoutButton } from "@/components/logout-button";

function initiales(nom: string) {
  const parts = nom.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export async function Header() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nomAffiche = profile?.name || user?.email || "";

  return (
    <header className="sticky top-0 z-10 bg-gradient-to-r from-brand-slate-dark to-brand-slate shadow-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/repertoire" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 p-1">
            <Image
              src="/logo-icon.png"
              alt="OGEC Services"
              width={28}
              height={28}
              className="h-full w-full object-contain"
            />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-white">
            OGEC SERVICES
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {nomAffiche && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
                {initiales(nomAffiche)}
              </span>
              <span className="text-sm text-white/85">{nomAffiche}</span>
            </div>
          )}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
