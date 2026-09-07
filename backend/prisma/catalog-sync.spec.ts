import * as fs from 'fs';
import * as path from 'path';
import { controler, Fichier } from './catalog-sync';

/**
 * Le contrôle du catalogue initial est ce qui tient l'installation neuve : le
 * fichier décrit 103 fiches et 36 photos que personne ne relit à la main.
 *
 * Les deux premières anomalies testées ici ne sont pas imaginaires. Une adresse
 * hors contrat a bel et bien été écrite en base — les fiches s'affichaient, et
 * leur modification partait en 400. Un même visuel recopié sous deux adresses a
 * laissé vingt-trois fichiers orphelins dans le dossier d'images.
 */
describe('Contrôle du catalogue initial', () => {
  const CHEMIN = path.join(__dirname, 'catalog-initial.json');
  const lire = () => JSON.parse(fs.readFileSync(CHEMIN, 'utf8')) as Fichier;

  const anomalies = (f: Fichier) => controler(f).join(' | ');

  it('le catalogue livré ne présente aucune anomalie', () => {
    expect(controler(lire())).toEqual([]);
  });

  it('signale une adresse hors du contrat d’URL', () => {
    const f = lire();
    f.services[0].imageUrl = '/uploads/service-brow-lift-20260831.webp';
    expect(anomalies(f)).toContain('adresse hors contrat');
  });

  it('signale un visuel servi sous deux adresses', () => {
    const f = lire();
    f.services.push({
      ...f.services[0],
      name: 'Prestation recopiée',
      imageUrl: '/uploads/28fb4be1-4e0a-4a4e-92a2-4e8b9c8b0f11.webp',
    });
    expect(anomalies(f)).toContain('déjà servi en');
  });

  it('signale deux fiches de même nom', () => {
    const f = lire();
    f.products.push({ ...f.products[0] });
    expect(anomalies(f)).toContain('nom en double');
  });

  it('signale une catégorie qui n’existe pas', () => {
    const f = lire();
    f.products[0].category = 'Bougies parfumées';
    expect(anomalies(f)).toContain('catégorie inconnue');
  });

  it('signale un visuel absent du dépôt', () => {
    const f = lire();
    f.services[0].image = 'prestation-sans-photo.webp';
    expect(anomalies(f)).toContain('visuel absent');
  });
});
