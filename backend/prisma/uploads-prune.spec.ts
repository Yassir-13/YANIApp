import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { trier } from './uploads-prune';

/**
 * Le tri décide de suppressions définitives : les photos du catalogue ne sont
 * dans aucun dump SQL, et le back-office ne sait pas les recréer.
 *
 * L'essai se fait donc sur un dossier temporaire, jamais sur `uploads/`.
 */
describe('Tri du dossier d’images', () => {
  const HEURE = 3600 * 1000;
  let dossier: string;

  const deposer = (nom: string, ageEnHeures: number) => {
    const chemin = path.join(dossier, nom);
    fs.writeFileSync(chemin, 'image');
    const date = new Date(Date.now() - ageEnHeures * HEURE);
    fs.utimesSync(chemin, date, date);
  };

  beforeAll(() => {
    dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'yani-uploads-'));
    deposer('referencee.webp', 72);
    deposer('orpheline-ancienne.webp', 72);
    deposer('orpheline-recente.webp', 1);
    fs.mkdirSync(path.join(dossier, '_sauvegarde-2026-08-31'));
  });

  afterAll(() => fs.rmSync(dossier, { recursive: true, force: true }));

  const tri = () =>
    trier(dossier, new Set(['referencee.webp']), Date.now() - 24 * HEURE);

  it('ne retient que les orphelines assez anciennes', () => {
    expect(tri().orphelins.map((o) => o.nom)).toEqual([
      'orpheline-ancienne.webp',
    ]);
  });

  it('laisse la photo qu’une fiche affiche', () => {
    expect(tri().references).toBe(1);
  });

  // Le back-office téléverse la photo avant d'enregistrer la fiche : pendant
  // la saisie, le fichier est un orphelin en tout point.
  it('laisse un téléversement encore en cours de saisie', () => {
    expect(tri().recents).toBe(1);
  });

  it('ne descend pas dans les sous-dossiers', () => {
    expect(tri().ignores).toBe(1);
  });
});
