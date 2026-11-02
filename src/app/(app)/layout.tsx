import { Header } from "@/components/header";
import { AppShell } from "@/components/app-shell";
import { SidebarProvider } from "@/components/sidebar-context";
import { FilExtraProvider } from "@/components/fil-extra-context";
import { getCurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  let equipementsAValider = 0;
  if (isAdmin) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("equipements")
      .select("id", { count: "exact", head: true })
      .eq("a_valider", true);
    equipementsAValider = count ?? 0;
  }

  return (
    <SidebarProvider>
      <FilExtraProvider>
        <div className="min-h-screen bg-slate-100">
          <Header />
          <AppShell isAdmin={isAdmin} equipementsAValider={equipementsAValider}>{children}</AppShell>
        </div>
      </FilExtraProvider>
    </SidebarProvider>
  );
}
