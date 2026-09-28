"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function seDeconnecter() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={seDeconnecter}
      className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white"
    >
      Déconnexion
    </button>
  );
}
