import Link from "next/link";
import { Wrench } from "lucide-react";
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
    <header className="sticky top-0 z-10 border-b border-slate-800/60 bg-slate-900">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/repertoire" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
            <Wrench className="h-4 w-4 text-white" strokeWidth={2.25} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">
            OGEC Services
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {nomAffiche && (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-200">
                {initiales(nomAffiche)}
              </span>
              <span className="text-sm text-slate-300">{nomAffiche}</span>
            </div>
          )}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
