// Les polices du projet sont toutes en .ttf. La déclaration '*.otf' a été
// retirée : aucun fichier de ce format n'est importé.
declare module '*.ttf' {
  const asset: number;
  export default asset;
}