import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/types";
import { DepannagesListe } from "./depannages-liste";

export default async function DepannagesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("demandes_depannage")
    .select("*")
    .order("date_creation", { ascending: false });

  return <DepannagesListe demandes={(data ?? []) as Tables<"demandes_depannage">[]} />;
}
