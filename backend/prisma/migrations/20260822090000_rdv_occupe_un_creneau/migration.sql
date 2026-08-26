-- Un rendez-vous occupe UN CRÉNEAU, jamais la durée de sa prestation.
--
-- Le centre espace ses rendez-vous d'un écart fixe, quelle que soit la
-- prestation — un choix de gestion, pas une contrainte technique. Le moteur de
-- créneaux ne lit donc plus `services.duration_min`.

-- 1. La durée devient facultative.
--
--    Elle ne sert plus qu'à l'organisation interne, dans le backoffice. La
--    rendre obligatoire forcerait à inventer un chiffre pour chaque prestation,
--    et un chiffre faux nuit plus qu'une case vide : sur une séance laser de
--    trois heures, « 60 min » se lirait comme une information.
ALTER TABLE "services" ALTER COLUMN "duration_min" DROP NOT NULL;

-- 2. L'écart entre créneaux passe de 30 à 60 minutes.
--
--    Sur une installation neuve d'abord : c'est le fonctionnement réel de
--    l'institut, et 30 minutes n'était que la valeur d'origine du modèle.
ALTER TABLE "center_settings" ALTER COLUMN "slot_interval_min" SET DEFAULT 60;

-- 3. Puis sur l'installation existante.
--
--    Uniquement là où l'ancienne valeur par défaut n'a jamais été touchée : si
--    quelqu'un a délibérément réglé autre chose depuis le backoffice, ce
--    réglage lui appartient et une migration n'a pas à le reprendre.
UPDATE "center_settings" SET "slot_interval_min" = 60 WHERE "slot_interval_min" = 30;
