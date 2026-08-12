// Enveloppe renvoyée par les endpoints paginés du backend, et paramètres
// qu'ils acceptent. Vivait dans `users.ts` du temps où `/users` était la seule
// route paginée ; les quatre listes ajoutées depuis (I4) en font une notion
// partagée.
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

// Onglets dont le compteur porte sur l'ensemble de la liste, pas sur la page
// affichée : « À confirmer (7) » doit rester vrai en page 4.
export type TabCounts = Record<string, number>;
