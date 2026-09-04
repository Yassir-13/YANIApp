# Rapport de projet de fin d'année

Source LaTeX du rapport de projet de fin d'année (PFA) sur le projet
Yani Concept by Fati.

Le rapport suit la structure du modèle académique fourni : pages liminaires,
introduction générale, cinq chapitres, conclusion et webographie. Le
chapitre 4 est entièrement consacré à la sécurité de la plate-forme, en
cohérence avec la filière Cybersécurité et Infrastructures Réseau.

---

## Compiler

```bash
cd rapport
latexmk -pdf main.tex          # ou, sans latexmk :
pdflatex main && pdflatex main && pdflatex main
```

**Trois passes sont nécessaires** : la première produit le texte, la deuxième
résout la table des matières et les listes, la troisième stabilise les numéros
de page que ces listes ont décalés.

Le résultat est `main.pdf`.

### Régler la couverture sans recompiler tout

```bash
pdflatex couverture-seule && pdflatex couverture-seule
```

`couverture-seule.tex` produit **la couverture seule, en une page**. Elle
appelle le même `page-de-garde.tex` que le rapport : ce qui est réglé là se
retrouve ici, sans recopie. Sur Overleaf : Menu → *Main document* →
`couverture-seule.tex`, puis rebasculer sur `main.tex` une fois satisfait.

⚠️ **Deux passes obligatoires** pour la couverture. Elle est dessinée en
surimpression avec `remember picture`, qui n'apprend la position des coins de
la page qu'au passage suivant. Une couverture décalée au premier essai est
normale — ce n'est pas une erreur.

### Dépendances

Une distribution TeX Live complète suffit. Sur Debian ou Ubuntu :

```bash
sudo apt install texlive-latex-recommended texlive-latex-extra \
                 texlive-lang-french texlive-fonts-recommended texlive-pictures
```

---

## Ce qu'il reste à renseigner

**Les noms.** Ils vivent tous en tête de `main.tex`, entre les lignes 20 et 34.
Tant qu'ils ne le sont pas, ils apparaissent dans le PDF en *gris italique* —
impossible de les rater à la relecture.

| Commande | À remplacer par |
|---|---|
| `\nouvelleAuteur` | Votre prénom et nom |
| `\nouvelleEncadrantPedagogique` | L'encadrant pédagogique |
| `\nouvelleEncadrantEntreprise` | L'encadrant côté entreprise |
| `\nouvelleEtablissement` | L'établissement, s'il diffère |
| `\nouvelleAnnee` | L'année universitaire |
| `\nouvelleFiliere` | La filière |

**Les figures.** Voir `figures/README.md` : la liste complète des visuels
attendus, avec pour chacun le nom de fichier exact et le contenu attendu.
Chaque figure manquante s'affiche pour l'instant comme un **cadre d'attente**
portant son nom de fichier — le document compile donc complètement dès
maintenant, et déposer une image dans `figures/` suffit à la remplacer, sans
toucher au texte.

Le logo est déjà en place (`figures/logo.png`, copié depuis
`brand/logo-master.png`).

---

## Organisation des fichiers

```
rapport/
├── main.tex                 # document maître : ordre des parties, valeurs à renseigner
├── page-de-garde.tex        # la couverture (format EMSI)
├── couverture-seule.tex     # ↑ la même, en document d'une page (mise au point)
├── preambule.tex            # paquets, charte graphique, macros
├── contenu/
│   ├── 00-liminaires.tex            # dédicace, remerciements, résumé, abstract, glossaire
│   ├── 01-introduction-generale.tex
│   ├── 02-chapitre1-organisme.tex   # organisme d'accueil, contexte, conduite du projet
│   ├── 03-chapitre2-analyse.tex     # besoins, cas d'utilisation, séquences, classes
│   ├── 04-chapitre3-technique.tex   # technologies, architecture, déploiement
│   ├── 05-chapitre4-securite.tex    # menaces, authentification, contrôle d'accès, données personnelles
│   ├── 06-chapitre5-mise-en-oeuvre.tex  # structure du code, tests, interfaces, exploitation
│   ├── 07-conclusion-generale.tex
│   └── 08-webographie.tex
└── figures/
    ├── README.md            # liste des visuels attendus
    └── logo.png
```

---

## Conventions

**Insérer une figure** — jamais `\includegraphics` directement, toujours :

```latex
\figProjet[0.85]{nom-du-fichier.png}{Légende de la figure}{cle-de-label}
```

La largeur (premier argument, optionnel) est une fraction de `\textwidth`.
C'est cette macro qui bascule automatiquement sur le cadre d'attente quand le
fichier n'existe pas encore. Renvoi dans le texte : `\figref{cle-de-label}`.

Pour deux captures côte à côte (écrans mobiles) :

```latex
\figDouble{gauche.png}{Légende gauche}{droite.png}{Légende droite}{cle}
```

**Tableaux** — `tabularx` sur `\textwidth`, colonnes `L{largeur}` (alignées à
gauche) ou `C{largeur}` (centrées), `X` pour la colonne élastique, en-têtes
avec `\entete{...}`. Renvoi : `\tabref{cle}`.

**Couleurs** — `yaniOr`, `yaniOrProfond`, `yaniNoir`, `yaniCreme`, `yaniGris`.
Ce sont les valeurs réelles de la charte de l'application, reprises de
`mobile/src/theme/colors.ts`.

**Encadré d'avertissement** :

```latex
\begin{attention}[Titre de l'encadré]
Texte.
\end{attention}
```

---

## Vérifier avant impression

```bash
pdflatex -interaction=nonstopmode main.tex
grep -E "Overfull|Warning: Reference" main.log
```

En l'état, la compilation ne produit **aucun débordement de ligne ni renvoi
non résolu**. Si l'ajout d'une figure ou d'un texte en introduit, c'est là que
cela se verra.
