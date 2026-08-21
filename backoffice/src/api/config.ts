// URL de l'API. En dev, le backend NestJS tourne sur le port 3000.
// Surchargeable via un fichier .env : VITE_API_URL=https://api.exemple.ma
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Adresse complète d'une image du catalogue.
//
// L'API enregistre un chemin relatif (« /uploads/….webp ») et non une URL
// entière : le backoffice et l'application mobile ne joignent pas le serveur
// par la même adresse, et une URL absolue en base gèlerait celle du jour où la
// photo a été ajoutée. Chacun préfixe donc par SA base d'API — ici la même que
// pour les requêtes. Sans ce préfixe, le navigateur cherchait « /uploads/… »
// sur le port du backoffice, où il n'y a rien.
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return `${API_BASE_URL}${path}`;
}

// Fuseau du CENTRE, et non celui du poste qui consulte.
//
// ⚠️ Doit valoir la même chose que `CENTER_TIMEZONE` côté backend. Les deux
// sont séparés à dessein : le serveur en a besoin pour décider (quels créneaux,
// quels rendez-vous du jour), le backoffice seulement pour afficher (surligner
// les lignes du jour, borner un sélecteur de date). Un écart entre les deux
// donne un surlignage à côté, jamais une donnée fausse.
export const CENTER_TIMEZONE =
  import.meta.env.VITE_CENTER_TIMEZONE || 'Africa/Casablanca';
