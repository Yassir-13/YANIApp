import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { firstValueFrom, of } from 'rxjs';
import { LocalizeCatalogInterceptor } from './localize-catalog.interceptor';

/**
 * Cet intercepteur traverse TOUTES les réponses de l'API, pas seulement celles
 * du catalogue. Les tests portent donc autant sur ce qu'il traduit que sur ce
 * qu'il doit laisser strictement intact.
 */
function reponse(headers: Record<string, string>, body: unknown) {
  const contexte = {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
  const suite = { handle: () => of(body) } as CallHandler;

  return firstValueFrom(
    new LocalizeCatalogInterceptor().intercept(contexte, suite),
  );
}

const PRESTATION = {
  id: 'abc',
  name: 'Soin Normal',
  nameAr: 'عناية عادية',
  nameEn: 'Standard treatment',
  description: 'Nettoyage en profondeur.',
  descriptionAr: 'تنظيف عميق.',
  descriptionEn: 'Deep cleansing.',
  active: true,
};

describe('LocalizeCatalogInterceptor', () => {
  it('ne touche à rien en français', async () => {
    const recu = await reponse({ 'accept-language': 'fr' }, PRESTATION);

    // Identité, et pas seulement égalité : le back-office doit recevoir
    // l'objet tel quel, colonnes de traduction comprises, sinon son
    // formulaire n'aurait rien à éditer.
    expect(recu).toBe(PRESTATION);
  });

  it("sert la traduction et retire les colonnes qui l'ont fournie", async () => {
    const recu = await reponse({ 'accept-language': 'ar' }, PRESTATION);

    expect(recu).toEqual({
      id: 'abc',
      name: 'عناية عادية',
      description: 'تنظيف عميق.',
      active: true,
    });
  });

  it('sert la langue demandée, et elle seule', async () => {
    expect(
      await reponse({ 'accept-language': 'en' }, PRESTATION),
    ).toMatchObject({
      name: 'Standard treatment',
      description: 'Deep cleansing.',
    });
  });

  it("garde le français tant que la fiche n'est pas traduite", async () => {
    const recu = await reponse(
      { 'accept-language': 'ar' },
      {
        name: 'Plasma Pen',
        nameAr: null,
        description: 'Un arc de plasma…',
        descriptionAr: '   ',
      },
    );

    // Une case vide n'est pas une traduction, et une case d'espaces non plus :
    // un nom blanc dans la liste serait pire que du français au milieu d'un
    // écran arabe.
    expect(recu).toEqual({
      name: 'Plasma Pen',
      description: 'Un arc de plasma…',
    });
  });

  it('traduit aussi une fiche imbriquée dans autre chose', async () => {
    // Le cas qui a décidé de l'intercepteur : un nom de prestation ne sort pas
    // que de `GET /services`. Ici, un rendez-vous.
    const recu = (await reponse(
      { 'accept-language': 'ar' },
      {
        id: 'rdv-1',
        startAt: '2026-09-01T10:00:00.000Z',
        service: PRESTATION,
      },
    )) as { service: { name: string } };

    expect(recu.service.name).toBe('عناية عادية');
  });

  it("traduit chaque élément d'une liste", async () => {
    const recu = (await reponse({ 'accept-language': 'en' }, [
      PRESTATION,
      { ...PRESTATION, id: 'def', nameEn: 'Royal treatment' },
    ])) as { name: string }[];

    expect(recu.map((s) => s.name)).toEqual([
      'Standard treatment',
      'Royal treatment',
    ]);
  });

  it('laisse intacts les prix et les dates', async () => {
    // Un Decimal et une Date sont des objets : recopiés champ par champ, un
    // prix arriverait au mobile en `{ s: 1, e: 2, d: [150] }`.
    const prix = new Prisma.Decimal('150.00');
    const date = new Date('2026-09-01T10:00:00.000Z');

    const recu = (await reponse(
      { 'accept-language': 'ar' },
      {
        ...PRESTATION,
        price: prix,
        createdAt: date,
      },
    )) as { price: unknown; createdAt: unknown };

    expect(recu.price).toBe(prix);
    expect(recu.createdAt).toBe(date);
  });

  it("n'invente pas un champ à un objet qui n'en a pas", async () => {
    const recu = await reponse(
      { 'accept-language': 'ar' },
      {
        id: 'u1',
        firstName: 'Fati',
        email: 'fati@example.com',
      },
    );

    expect(recu).toEqual({
      id: 'u1',
      firstName: 'Fati',
      email: 'fati@example.com',
    });
  });

  it('laisse passer null et les réponses vides', async () => {
    expect(await reponse({ 'accept-language': 'ar' }, null)).toBeNull();
    expect(
      await reponse({ 'accept-language': 'ar' }, undefined),
    ).toBeUndefined();
  });

  it('obéit à X-Locale avant Accept-Language', async () => {
    // Le cas du back-office ouvert dans un navigateur en anglais : c'est lui,
    // et non la page, qui pose `Accept-Language`. Sans priorité à `X-Locale`,
    // le formulaire aurait chargé l'anglais dans le champ français.
    const recu = await reponse(
      { 'x-locale': 'fr', 'accept-language': 'en-US,en;q=0.9' },
      PRESTATION,
    );

    expect(recu).toBe(PRESTATION);
  });
});
