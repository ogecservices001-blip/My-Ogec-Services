import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { LogoutButton } from "@/components/logout-button";
import { SidebarToggle } from "@/components/sidebar-toggle";

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
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6"
      style={{ height: 52, backgroundColor: "var(--shell-bg)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 p-1">
          <Image
            src="/logo-icon.png"
            alt="OGEC Services"
            width={24}
            height={24}
            className="h-full w-full object-contain"
          />
        </span>
        <span className="text-[15px] font-extrabold tracking-tight text-white">
          OGEC <span className="text-brand-green">SERVICES</span>
        </span>
      </Link>
      <div className="flex items-center gap-3">
        {nomAffiche && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-brand-green">
              {initiales(nomAffiche)}
            </span>
            <span className="text-sm text-white/70">{nomAffiche}</span>
          </div>
        )}
        <SidebarToggle />
        <LogoutButton />
      </div>
    </header>
  );
}
