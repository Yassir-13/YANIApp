// URL du backend.
//
// La valeur vient de EXPO_PUBLIC_API_URL, définie dans mobile/.env.local
// (modèle : .env.example). Expo ne lit PAS cette variable à l'exécution : il
// remplace le texte `process.env.EXPO_PUBLIC_API_URL` par sa valeur au moment
// du build. Deux conséquences à ne pas oublier :
//   - il faut l'écrire en toutes lettres — ni crochets, ni clé calculée, sinon
//     le remplacement n'a pas lieu et on récupère `undefined` ;
//   - la valeur finit en clair dans l'app livrée. Une URL, jamais un secret.
//
// Sans .env.local on retombe sur 10.0.2.2, l'alias par lequel l'émulateur
// Android joint le PC hôte. Pratique par défaut, mais cette adresse n'existe
// ni sur un téléphone réel ni sur iOS — d'où la variable.
//
// `||` et non `??` : une variable définie mais vide doit aussi retomber sur
// la valeur par défaut.
const url = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000';

// Garde-fou. Depuis Android 9 (et sur iOS via App Transport Security), une app
// en version release bloque par défaut le trafic HTTP en clair : livrée ainsi,
// l'app serait entièrement muette, et login comme tokens circuleraient lisibles
// sur le réseau. Mieux vaut échouer ici, au premier lancement du build de test,
// que le découvrir une fois publiée.
if (!__DEV__ && !url.startsWith('https://')) {
  throw new Error(
    `[config] EXPO_PUBLIC_API_URL doit être en HTTPS pour un build de production (reçu : « ${url} »).`,
  );
}

export const API_BASE_URL = url;

// Adresse complète d'une image du catalogue (prestation ou produit).
//
// L'API enregistre un chemin relatif (« /uploads/….webp ») et non une URL
// entière : le téléphone et le backoffice ne joignent pas le serveur par la
// même adresse, et une URL absolue en base gèlerait celle du jour où la photo
// a été ajoutée. Chacun préfixe donc par SA base d'API.
//
// Renvoie `undefined` quand il n'y a pas de photo, pour que l'appelant affiche
// son visuel de repli au lieu d'une image cassée.
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return `${API_BASE_URL}${path}`;
}
