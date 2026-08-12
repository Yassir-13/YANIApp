// Enveloppe renvoyée par les listes paginées du backend (I4).
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Les écrans mobiles affichent des listes personnelles — les rendez-vous
// d'une cliente, ses mouvements de points, ses commandes, ses bons — qui
// n'atteindront jamais cette taille. On demande donc la première page, large,
// plutôt que d'ajouter un défilement infini à des écrans qui n'en ont pas
// besoin. Ce qui compte ici, c'est que le serveur ne renvoie plus une liste
// sans borne.
//
// LA RÈGLE, une fois pour toutes : **aucune route de liste ne renvoie une
// liste entière**, y compris les listes personnelles. Elles sont courtes
// aujourd'hui, mais elles grandissent toutes de la même façon — une ligne par
// visite, par commande, par récompense — et rien ne les arrête. Les six routes
// concernées demandent donc cette page :
//
//   /appointments · /orders/me · /loyalty/me/history
//   /loyalty/me/grants · /loyalty/me/vouchers
//
// Le jour où l'une d'elles dépassera 100, il faudra un « charger plus » — pas
// retirer la borne. 100 est aussi le plafond dur du serveur (MAX_PAGE_SIZE) :
// il n'y a donc pas de marge au-dessus, c'est délibéré.
export const PAGE_MOBILE = 100;
