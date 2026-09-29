import { requireProfile } from "@/lib/auth";
import { ScannerClient } from "./scanner-client";

export default async function ScannerPage() {
  await requireProfile();
  return <ScannerClient />;
}
