import { notFound } from "next/navigation";
import { requireAdminOuAccueil } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Poles, labelPole } from "@/lib/bi/constants";
import type { ChampEnTete, ChecklistItem } from "@/lib/gmao/types";
import { ModeleBiEditor } from "./editor";

export default async function ModeleBiPage({ params }: { params: Promise<{ pole: string }> }) {
  await requireAdminOuAccueil();
  const { pole } = await params;
  if (!Object.values(Poles).includes(pole as (typeof Poles)[keyof typeof Poles])) notFound();

  const supabase = await createClient();
  const { data } = await supabase.from("bi_modeles").select("*").eq("pole", pole).maybeSingle();

  return (
    <ModeleBiEditor
      pole={pole}
      labelPole={labelPole(pole)}
      champsInitiaux={(data?.champs as ChampEnTete[] | undefined) ?? []}
      checklistInitiale={(data?.checklist as ChecklistItem[] | undefined) ?? []}
      texteTypeInitial={data?.texte_type ?? ""}
    />
  );
}
