import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TranslateResponseInterceptor } from './common/interceptors/translate-response.interceptor';
import { UPLOADS_ROUTE, resolveUploadsDir } from './uploads/uploads.config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // ── En-têtes de sécurité HTTP ──
  // Helmet supprime « X-Powered-By » (qui annonçait la technologie du serveur)
  // et ajoute une douzaine d'en-têtes que le navigateur applique : HSTS,
  // nosniff, anti-clickjacking…
  //
  // Le CSP par défaut interdit les scripts inline. Or Swagger UI s'initialise
  // avec un <script> inline : l'activer en développement afficherait une page
  // blanche sur /api-docs. On ne le désactive donc QUE là où Swagger tourne —
  // en production, Swagger est coupé et le CSP s'applique pleinement.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );

  // ── Images du catalogue ──
  // Les photos de prestations et de produits sont hébergées par l'API et
  // servies ici, en clair et sans authentification : ce sont les mêmes images
  // que n'importe quelle visiteuse voit dans l'application.
  //
  // APRÈS helmet, et c'est tout l'enjeu de l'en-tête réécrit plus bas : helmet
  // pose « Cross-Origin-Resource-Policy: same-origin », qui interdit à une
  // autre origine d'afficher la ressource. Le backoffice (localhost:5173, ou
  // un sous-domaine en production) n'est pas la même origine que l'API — ses
  // vignettes restaient donc vides, sans la moindre erreur réseau visible.
  //
  // `immutable` avec un an de cache : chaque fichier porte un nom tiré au sort
  // et son contenu ne change jamais. Remplacer une photo crée un nouveau nom,
  // jamais une nouvelle version du même — il n'y a donc rien à invalider.
  app.useStaticAssets(resolveUploadsDir(config.get<string>('UPLOADS_DIR')), {
    prefix: UPLOADS_ROUTE,
    index: false,
    redirect: false,
    dotfiles: 'ignore',
    maxAge: '365d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
  });

  // ── Traitement uniforme des erreurs ──
  // Sans ce filtre, les erreurs Prisma partaient brutes au client, avec les
  // noms de tables et de contraintes.
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Langue des réponses ──
  // Le filtre ci-dessus ne voit que les erreurs. Plusieurs routes répondent
  // 200 avec une phrase destinée à la cliente (« Mot de passe modifié… ») que
  // l'application affiche telle quelle : cet intercepteur les traduit aussi,
  // d'après le même en-tête `Accept-Language`.
  app.useGlobalInterceptors(new TranslateResponseInterceptor());

  // ── Adresse IP réelle derrière un reverse proxy ──
  // Le rate limiting compte les requêtes par IP. Derrière nginx ou un
  // hébergeur, req.ip vaut l'IP DU PROXY : toutes les clientes partageraient
  // alors un seul compteur et se bloqueraient mutuellement.
  // TRUST_PROXY=1 fait lire l'IP réelle dans l'en-tête X-Forwarded-For.
  // À n'activer QUE si un proxy de confiance est réellement devant l'API :
  // en accès direct, cet en-tête est falsifiable et contournerait le compteur.
  if (config.get<string>('TRUST_PROXY') === '1') {
    app.set('trust proxy', 1);
  }

  // ── CORS : autorise le backoffice web à consommer l'API ──
  // En dev, Vite tourne sur 5173. En prod, définir CORS_ORIGINS dans le .env
  // (liste séparée par des virgules, ex. https://admin.yaniconcept.ma).
  //
  // `exposedHeaders` : sans lui, le navigateur CACHE l'en-tête
  // Content-Disposition au code JavaScript. Le backoffice télécharge les
  // exports Excel par requête authentifiée (le jeton ne voyage pas dans une
  // URL) et y lit le nom du fichier : sans cette ligne, tous les exports
  // arriveraient sous un nom générique.
  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS')?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Documentation Swagger (développement uniquement) ──
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Yani Concept by Fati — API')
      .setDescription(
        "API du centre de beauté : réservation, fidélité, catalogues.\n\n" +
        "**Convention de dates** : toutes les dates sont en UTC (format ISO 8601 avec `Z`). " +
        "Les horaires d'ouverture sont exprimés en heure locale du centre (Africa/Casablanca).",
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: "Collez l'access token obtenu via /auth/login",
        },
        'access-token',
      )
      .addTag('health', 'Sonde de santé (déploiement, supervision)')
      .addTag('auth', 'Authentification et sessions')
      .addTag('users', 'Gestion des utilisateurs')
      .addTag('services', 'Catalogue de prestations')
      .addTag('products', 'Catalogue de produits')
      .addTag('appointments', 'Rendez-vous')
      .addTag('orders', 'Commandes de produits')
      .addTag('loyalty', 'Programme de fidélité')
      .addTag('opening-hours', "Horaires d'ouverture")
      .addTag('exports', 'Exports Excel (administratrice)')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  // ── Port d'écoute ──
  // Il vient de l'environnement, et non du code. La plupart des hébergeurs
  // imposent le leur : écrit en dur, le serveur écoutait à côté et restait
  // injoignable, sans la moindre erreur pour le signaler.
  //
  // Le repli sur 3000 garde le développement inchangé. À noter pour le poste
  // Windows : la plage 2933–3032 y est réservée par Hyper-V/WSL, et 3000 donne
  // alors « listen EACCES » — un PORT=3100 dans le .env suffit à contourner.
  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);

  // Tracé au démarrage : dans un conteneur, c'est la seule façon de savoir sur
  // quel port l'API a réellement fini par écouter.
  new Logger('Bootstrap').log(`API à l'écoute sur le port ${port}`);
}
bootstrap();