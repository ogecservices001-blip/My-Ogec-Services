import { Header } from "@/components/header";
import { AppShell } from "@/components/app-shell";
import { SidebarProvider } from "@/components/sidebar-context";
import { getCurrentProfile } from "@/lib/profile";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-slate-100">
        <Header />
        <AppShell isAdmin={profile?.role === "admin"}>{children}</AppShell>
      </div>
    </SidebarProvider>
  );
}
