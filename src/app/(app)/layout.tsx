import { Header } from "@/components/header";
import { Sidebar } from "@/components/sidebar";
import { SidebarProvider } from "@/components/sidebar-context";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen bg-slate-100">
        <Header />
        <div className="mx-auto flex max-w-6xl">
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <div className="mx-auto w-full max-w-3xl">{children}</div>
          </main>
          <Sidebar />
        </div>
      </div>
    </SidebarProvider>
  );
}
