import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
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
        <div className="mx-auto flex max-w-6xl">
          <Sidebar isAdmin={profile?.role === "admin"} />
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mx-auto w-full max-w-3xl">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
