import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OrderStatus } from '@prisma/client';
import { FindOrdersQueryDto } from './find-orders-query.dto';

/**
 * Le filtre de statut était typé `OrderStatus` en TypeScript — un type qui
 * disparaît à la compilation et ne valide donc rien à l'exécution (I6).
 */
describe('FindOrdersQueryDto', () => {
  const champsEnErreur = (valeurs: Record<string, unknown>) =>
    validateSync(plainToInstance(FindOrdersQueryDto, valeurs)).map(
      (e) => e.property,
    );

  it('accepte un statut connu', () => {
    expect(champsEnErreur({ status: OrderStatus.PENDING })).toEqual([]);
  });

  it('accepte l’absence de filtre : toutes les commandes', () => {
    expect(champsEnErreur({})).toEqual([]);
  });

  it('refuse un statut inventé', () => {
    expect(champsEnErreur({ status: 'LIVREE' })).toContain('status');
  });

  it('nomme les valeurs acceptées dans le message', () => {
    // Un « statut invalide » sec obligerait à ouvrir le code pour deviner.
    const [erreur] = validateSync(
      plainToInstance(FindOrdersQueryDto, { status: 'LIVREE' }),
    );
    expect(Object.values(erreur.constraints ?? {}).join()).toContain(
      OrderStatus.CONFIRMED,
    );
  });
});
