-- Le catalogue devient trilingue, sans toucher à ce qui existe.
--
-- L'interface de l'application était déjà traduite, mais son contenu ne l'était
-- pas : une cliente en arabe lisait « Lifting Colombien Boost - Pack du 6
-- seances » au milieu d'un écran arabe.
--
-- Les colonnes françaises ne bougent pas. `name` et `description` restent la
-- saisie de la gérante et la source de vérité ; les colonnes ajoutées ici sont
-- une couche par-dessus. Elles sont donc NULLABLES : une case vide veut dire
-- « pas encore traduit », et l'API renvoie le français à la place. C'est ce qui
-- permet de livrer la migration avant les traductions, et de traduire au
-- rythme réel de l'institut.
--
-- Aucune reprise de données ici : rien à recopier, puisque le repli lit
-- directement la colonne française. Le contenu traduit est chargé séparément,
-- par `npm run catalog:translate`, qui peut être rejoué.

-- 1. Les fiches : un nom et une description par langue.
ALTER TABLE "services"
  ADD COLUMN "name_ar" TEXT,
  ADD COLUMN "name_en" TEXT,
  ADD COLUMN "description_ar" TEXT,
  ADD COLUMN "description_en" TEXT;

ALTER TABLE "products"
  ADD COLUMN "name_ar" TEXT,
  ADD COLUMN "name_en" TEXT,
  ADD COLUMN "description_ar" TEXT,
  ADD COLUMN "description_en" TEXT;

-- Les récompenses de fidélité s'affichent dans l'application au même titre
-- qu'une prestation — dans les paliers, les bons et l'historique de points.
ALTER TABLE "rewards"
  ADD COLUMN "name_ar" TEXT,
  ADD COLUMN "name_en" TEXT,
  ADD COLUMN "description_ar" TEXT,
  ADD COLUMN "description_en" TEXT;

-- 2. Les catégories : un nom seulement, elles n'ont jamais eu de description.
--
--    Pas de contrainte d'unicité sur les traductions, contrairement au nom
--    français. Deux catégories peuvent parfaitement partager un mot arabe tant
--    que leurs noms français diffèrent, et une unicité ici bloquerait la saisie
--    pour un doublon qui ne gêne personne.
ALTER TABLE "service_categories"
  ADD COLUMN "name_ar" TEXT,
  ADD COLUMN "name_en" TEXT;

ALTER TABLE "product_categories"
  ADD COLUMN "name_ar" TEXT,
  ADD COLUMN "name_en" TEXT;
