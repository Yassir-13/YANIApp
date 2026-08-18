// URL de l'API. En dev, le backend NestJS tourne sur le port 3000.
// Surchargeable via un fichier .env : VITE_API_URL=https://api.exemple.ma
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Fuseau du CENTRE, et non celui du poste qui consulte.
//
// ⚠️ Doit valoir la même chose que `CENTER_TIMEZONE` côté backend. Les deux
// sont séparés à dessein : le serveur en a besoin pour décider (quels créneaux,
// quels rendez-vous du jour), le backoffice seulement pour afficher (surligner
// les lignes du jour, borner un sélecteur de date). Un écart entre les deux
// donne un surlignage à côté, jamais une donnée fausse.
export const CENTER_TIMEZONE =
  import.meta.env.VITE_CENTER_TIMEZONE || 'Africa/Casablanca';
