export type ActionResult =
  | { ok: true }
  | { ok: false; erreur: string; champs?: Record<string, string> };
