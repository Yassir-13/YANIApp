import axios from 'axios';
import { apiClient } from './client';

// Bornes de l'export, en jours du centre (« 2026-08-01 »). Absentes, elles
// valent « depuis l'ouverture ».
// `type` et non `interface` : seul un alias est accepté là où l'on attend un
// dictionnaire de paramètres (TypeScript ne prête pas d'index aux interfaces).
export type ExportRange = {
  from?: string;
  to?: string;
};

// Le fichier arrive en binaire et par requête AUTHENTIFIÉE : un simple lien
// <a href="…/exports/orders.xlsx"> ne porterait pas le jeton, et le glisser
// dans l'URL le laisserait dans l'historique du navigateur et dans les
// journaux du serveur. On récupère donc le fichier en mémoire, puis on
// déclenche le téléchargement depuis un lien local.
async function telecharger(chemin: string, params: Record<string, string | undefined>) {
  let data: Blob;
  let headers: Record<string, string>;
  try {
    const res = await apiClient.get(chemin, {
      // Les paramètres vides sont retirés : `?status=` serait refusé par la
      // validation du serveur, qui n'attend qu'un statut connu ou rien.
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v)),
      // Sans ça, axios traite le fichier comme du texte et le corrompt.
      responseType: 'blob',
    });
    data = res.data;
    headers = res.headers as Record<string, string>;
  } catch (e) {
    // Traduit ici, une fois : les pages n'ont plus qu'à afficher le message.
    throw new Error(await messageDErreur(e));
  }

  const url = URL.createObjectURL(data as Blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomDuFichier(headers['content-disposition']);
  // Le lien doit exister dans la page : détaché, Firefox ignore le clic.
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // Sans révocation, le fichier reste en mémoire jusqu'à la fermeture de
  // l'onglet — et Fati en exporte plusieurs à la suite.
  URL.revokeObjectURL(url);
}

// Le serveur nomme le fichier (« commandes_2026-08-01_2026-08-31.xlsx ») et
// l'annonce dans Content-Disposition, que main.ts expose explicitement au
// JavaScript. Le repli sert si un proxy retire l'en-tête en route.
function nomDuFichier(disposition?: string): string {
  const trouve = /filename="([^"]+)"/.exec(disposition ?? '');
  return trouve ? trouve[1] : 'export.xlsx';
}

// Le corps d'une erreur arrive lui aussi en Blob : sans le relire, le
// backoffice afficherait « échec » là où le serveur explique précisément quoi
// (« Trop de requêtes », « Statut inconnu »…).
async function messageDErreur(e: unknown): Promise<string> {
  const corps = axios.isAxiosError(e) ? e.response?.data : null;
  if (corps instanceof Blob) {
    try {
      const { message } = JSON.parse(await corps.text());
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return message.join(' ');
    } catch {
      // Pas du JSON : on retombe sur le message générique.
    }
  }
  return "L'export a échoué. Réessayez.";
}

export const exportsApi = {
  users: (params: ExportRange & { role?: string }) =>
    telecharger('/exports/users.xlsx', params),
  orders: (params: ExportRange & { status?: string }) =>
    telecharger('/exports/orders.xlsx', params),
  appointments: (params: ExportRange & { status?: string }) =>
    telecharger('/exports/appointments.xlsx', params),
};
