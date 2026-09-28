"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

export function SidebarToggle() {
  const { toggle } = useSidebar();
  return (
    <button
      onClick={toggle}
      title="Menu"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white lg:hidden"
    >
      <Menu className="h-5 w-5" strokeWidth={2} />
    </button>
  );
}
