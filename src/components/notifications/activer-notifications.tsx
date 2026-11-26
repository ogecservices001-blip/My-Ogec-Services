"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { enregistrerAbonnement, supprimerAbonnement, type AbonnementNavigateur } from "@/app/(app)/notifications-actions";

type Etat = "verification" | "indisponible" | "refuse" | "inactif" | "actif";

function cleBinaire(base64: string): Uint8Array<ArrayBuffer> {
  const rembourrage = "=".repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + rembourrage).replace(/-/g, "+").replace(/_/g, "/"));
  const octets = new Uint8Array(new ArrayBuffer(brut.length));
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

/// Encart de l'accueil technicien : active les notifications de dépannage
/// sur ce téléphone (une seule fois, l'autorisation est demandée par Android).
export function ActiverNotifications() {
  const [etat, setEtat] = useState<Etat>("verification");
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  useEffect(() => {
    let annule = false;
    (async () => {
      let suivant: Etat = "inactif";
      if (!clePublique || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        suivant = "indisponible";
      } else if (Notification.permission === "denied") {
        suivant = "refuse";
      } else {
        const enregistrement = await navigator.serviceWorker.getRegistration();
        const abonnement = await enregistrement?.pushManager.getSubscription();
        suivant = abonnement && Notification.permission === "granted" ? "actif" : "inactif";
      }
      if (!annule) setEtat(suivant);
    })().catch(() => {
      if (!annule) setEtat("indisponible");
    });
    return () => {
      annule = true;
    };
  }, [clePublique]);

  async function activer() {
    setErreur(null);
    setOccupe(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setEtat(permission === "denied" ? "refuse" : "inactif");
        return;
      }
      const enregistrement = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const abonnement =
        (await enregistrement.pushManager.getSubscription()) ??
        (await enregistrement.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: cleBinaire(clePublique) }));
      const r = await enregistrerAbonnement(abonnement.toJSON() as AbonnementNavigateur, navigator.userAgent);
      if (!r.ok) {
        setErreur(r.erreur);
        return;
      }
      setEtat("actif");
    } catch {
      setErreur("Activation impossible pour l'instant (réseau ?). Réessaie.");
    } finally {
      setOccupe(false);
    }
  }

  async function desactiver() {
    setOccupe(true);
    try {
      const enregistrement = await navigator.serviceWorker.getRegistration();
      const abonnement = await enregistrement?.pushManager.getSubscription();
      if (abonnement) {
        await supprimerAbonnement(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setEtat("inactif");
    } catch {
      setErreur("Désactivation impossible pour l'instant (réseau ?). Réessaie.");
    } finally {
      setOccupe(false);
    }
  }

  if (etat === "verification" || etat === "indisponible") return null;

  if (etat === "actif") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-green-50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-brand-green-dark">
          <BellRing className="h-4 w-4" /> Notifications de dépannage activées sur ce téléphone
        </p>
        <button type="button" onClick={desactiver} disabled={occupe} className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-700">
          Désactiver
        </button>
      </div>
    );
  }

  if (etat === "refuse") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <BellOff className="h-4 w-4" /> Notifications bloquées sur ce téléphone
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Pour les recevoir : appui long sur l&apos;icône de l&apos;appli → Infos sur l&apos;appli → Notifications → Autoriser,
          puis rouvre l&apos;appli.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-green/40 bg-white p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Bell className="h-4 w-4 text-brand-green" /> Être prévenu des dépannages
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Une notification arrive sur ce téléphone dès que le bureau t&apos;affecte un dépannage, même appli fermée.
      </p>
      <button
        type="button"
        onClick={activer}
        disabled={occupe}
        className="mt-3 w-full rounded-lg bg-brand-green px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-green-dark disabled:opacity-60"
      >
        {occupe ? "Activation..." : "Activer les notifications"}
      </button>
      {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
