"use client";

import { createContext, useContext, useState } from "react";

type SidebarContextValue = {
  ouvert: boolean;
  toggle: () => void;
  fermer: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <SidebarContext.Provider
      value={{
        ouvert,
        toggle: () => setOuvert((v) => !v),
        fermer: () => setOuvert(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar doit être utilisé dans SidebarProvider");
  return ctx;
}
