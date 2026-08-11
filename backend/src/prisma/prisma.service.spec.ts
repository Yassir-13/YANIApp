import 'dotenv/config';
import { PrismaService } from './prisma.service';

// Ce test ne touche PAS la base : `$connect` est remplacé, et c'est le but.
// Ce qu'on vérifie ici, c'est le comportement du démarrage quand la base ne
// répond pas encore — une situation qu'on ne peut pas provoquer à la demande
// sur un vrai Postgres, mais qui arrive à chaque redéploiement en production.

describe('PrismaService — connexion au démarrage', () => {
  let service: PrismaService;
  let sleep: jest.SpyInstance<Promise<void>, [number]>;

  beforeEach(() => {
    service = new PrismaService();

    // Neutralise l'attente réelle : sans ça, le cas « la base ne revient
    // jamais » ferait durer la suite une trentaine de secondes.
    //
    // `sleep` est privée. On la retype plutôt que de la forcer en `never` :
    // les durées d'attente redeviennent des `number`, et le test qui vérifie
    // la progression 1/2/4/8 s peut les comparer sans casting.
    sleep = jest.spyOn(
      service as unknown as { sleep: (ms: number) => Promise<void> },
      'sleep',
    ) as jest.SpyInstance<Promise<void>, [number]>;
    sleep.mockResolvedValue(undefined);

    // Les essais ratés journalisent volontairement en warn/error. Attendu ici,
    // donc on garde la sortie des tests lisible.
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Remplace `$connect` par assignation directe plutôt que par `jest.spyOn` :
  // le client Prisma expose ses méthodes derrière un Proxy, que spyOn ne sait
  // pas toujours redéfinir.
  function simulerConnexion(...resultats: ('ok' | 'ko')[]) {
    const connect = jest.fn();
    for (const resultat of resultats) {
      if (resultat === 'ok') {
        connect.mockResolvedValueOnce(undefined);
      } else {
        connect.mockRejectedValueOnce(
          new Error("Can't reach database server at `localhost:5432`"),
        );
      }
    }
    // Au-delà des résultats fournis, on reste sur le dernier comportement.
    const dernier = resultats[resultats.length - 1];
    if (dernier === 'ok') {
      connect.mockResolvedValue(undefined);
    } else {
      connect.mockRejectedValue(
        new Error("Can't reach database server at `localhost:5432`"),
      );
    }
    (service as unknown as { $connect: unknown }).$connect = connect;
    return connect;
  }

  it('se connecte du premier coup quand la base est déjà prête', async () => {
    const connect = simulerConnexion('ok');

    await service.onModuleInit();

    expect(connect).toHaveBeenCalledTimes(1);
    // Aucune attente : le cas normal ne doit rien ralentir au démarrage.
    expect(sleep).not.toHaveBeenCalled();
  });

  it('démarre quand même si la base met quelques secondes à se lever', async () => {
    const connect = simulerConnexion('ko', 'ko', 'ok');

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('espace les essais de plus en plus, et n’attend pas après le dernier', async () => {
    simulerConnexion('ko');

    await expect(service.onModuleInit()).rejects.toThrow();

    // 4 attentes pour 5 essais : on ne fait pas patienter pour rien avant
    // d'abandonner.
    expect(sleep.mock.calls.map((appel) => appel[0])).toEqual([
      1_000, 2_000, 4_000, 8_000,
    ]);
  });

  it('fait échouer le démarrage si la base ne revient jamais', async () => {
    const connect = simulerConnexion('ko');

    // L'erreur doit remonter : une API debout sans base répondrait 500 à
    // chaque requête en se croyant en bonne santé. En échouant, elle laisse
    // l'orchestrateur la relancer.
    await expect(service.onModuleInit()).rejects.toThrow(
      "Can't reach database server",
    );
    expect(connect).toHaveBeenCalledTimes(5);
  });
});
