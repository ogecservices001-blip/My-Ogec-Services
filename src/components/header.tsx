import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { LogoutButton } from "@/components/logout-button";

export async function Header() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white sm:px-6">
      <Link href="/repertoire" className="font-bold tracking-wide">
        OGEC SERVICES
      </Link>
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span className="hidden sm:inline">
          {profile?.name || user?.email}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
