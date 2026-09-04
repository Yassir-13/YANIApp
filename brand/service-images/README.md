# Série d'images des services YANI

Cette série contient 21 visuels maîtres générés pour couvrir les 88 prestations
du catalogue sans dupliquer une image par pack ou par nombre de séances.

## Direction visuelle

- photographie éditoriale réaliste, carrée ;
- cabine premium, lumière chaude et diffuse ;
- palette crème, noir mat et champagne doré discret ;
- praticienne en tenue noire et clientèle marocaine/nord-africaine ;
- peau et anatomie naturelles, gestes et appareils plausibles ;
- aucun texte, logo, filigrane, marque d'appareil ou promesse avant/après.

Les fichiers finaux sont des WebP 1254 × 1254, qualité 84. Les anciennes
images de `backend/uploads` n'ont pas été modifiées et aucune association en
base n'a encore été changée.

## Association recommandée

| Image | Prestations à associer |
|---|---|
| `amincissement-drainage.webp` | Les 3 prestations « Amincissement et Drainage » : séance, pack 5 et pack 10 |
| `brow-lift.webp` | `Brow lift` |
| `lash-lift.webp` | `Lash lift` |
| `hifu-visage.webp` | `hifu visage` |
| `hifu-double-menton.webp` | `hifu double menton` |
| `hifu-intime.webp` | `hifu vaginal` — représentation volontairement discrète par consultation et équipement |
| `laser-diod-epilation.webp` | `Epilation definitive a partir de (par zone)` de la catégorie Laser Diod Cold |
| `laser-diod-rajeunissement.webp` | `Rajeunissement avec Laser et Radio Frequence integree a partir de (par zone)` |
| `laser-titanium.webp` | Les 42 prestations de la catégorie Laser Titanium Gold, séances et packs |
| `lifting-colombien-normal.webp` | Les 4 prestations Lifting Colombien Normal |
| `lifting-colombien-boost.webp` | Les 4 prestations Lifting Colombien Boost |
| `baby-lips.webp` | `Baby lips`, les 3 prestations de correction couleur/contour des lèvres et `Neutralisation du blue des levres` |
| `microblading-sourcils.webp` | `Microblading et Microshading` et les 2 prestations de détatouage des sourcils |
| `detatouage-corps.webp` | Les 2 prestations `Detatouage (tattoo Corps)` par laser ou produits |
| `microneedling-cheveux.webp` | Les 2 prestations Microneedling Cheveux |
| `microneedling-corps.webp` | Les 4 prestations Microneedling Corps, BB Glow et/ou LED |
| `microneedling-visage.webp` | Les 3 prestations Microneedling Visage, Gold, vitamines et/ou LED |
| `plasma-pen.webp` | `Plasma Pen Contre les Rides et Relachement de la Peau (par zone)` |
| `hydra-facial.webp` | `Soin Normal`, `Soin Complet`, `Soin Radio Frequence et vitamines` et `Soin Royal` |
| `hydrafacial-dos.webp` | Les 2 soins Hydra Facial du dos, avec ou sans massage |
| `blanchiment-dentaire.webp` | Les 2 prestations de blanchiment des dents |

## Intégration

Ces fichiers sont les sources finales validables. L'étape suivante consiste à
les faire passer par le flux d'upload normal de l'application afin d'obtenir
des noms UUID sous `/uploads`, puis à mettre à jour `services.image_url` selon
la table ci-dessus. Ne pas écraser ni supprimer les anciennes images avant une
validation visuelle dans le mobile et le backoffice.
