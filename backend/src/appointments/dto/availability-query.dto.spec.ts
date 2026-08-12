import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AvailabilityQueryDto } from './availability-query.dto';

/**
 * `GET /appointments/availability` est la seule route publique du projet :
 * ses deux paramètres sont les seuls qu'on puisse envoyer sans compte. Ils
 * arrivaient bruts jusqu'à Prisma (I6).
 */
describe('AvailabilityQueryDto', () => {
  const champsEnErreur = (valeurs: Record<string, unknown>) =>
    validateSync(plainToInstance(AvailabilityQueryDto, valeurs)).map(
      (e) => e.property,
    );

  const SERVICE_ID = '63965408-ce9c-4f3f-9052-906538890053';

  it('accepte une demande bien formée', () => {
    expect(champsEnErreur({ serviceId: SERVICE_ID, date: '2026-08-31' })).toEqual(
      [],
    );
  });

  it('refuse un serviceId qui n’est pas un identifiant', () => {
    expect(
      champsEnErreur({ serviceId: 'brushing', date: '2026-08-31' }),
    ).toContain('serviceId');
  });

  it('refuse une date fantaisiste', () => {
    expect(
      champsEnErreur({ serviceId: SERVICE_ID, date: 'nimportequoi' }),
    ).toContain('date');
  });

  // Le service compose `${date}T12:00:00.000Z` : une date-heure complète
  // donnerait une chaîne invalide, et donc une erreur technique illisible.
  it('refuse une date-heure complète : on attend un jour seul', () => {
    expect(
      champsEnErreur({
        serviceId: SERVICE_ID,
        date: '2026-08-31T12:00:00.000Z',
      }),
    ).toContain('date');
  });

  it('refuse un jour qui n’existe pas', () => {
    // Le motif seul laisserait passer le 31 février, que `new Date`
    // déplacerait en silence au 3 mars — une réponse fausse, pas un refus.
    expect(
      champsEnErreur({ serviceId: SERVICE_ID, date: '2026-02-31' }),
    ).toContain('date');
  });

  it('refuse une demande sans date ni prestation', () => {
    expect(champsEnErreur({})).toEqual(
      expect.arrayContaining(['serviceId', 'date']),
    );
  });
});
