import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

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

  // ── Traitement uniforme des erreurs ──
  // Sans ce filtre, les erreurs Prisma partaient brutes au client, avec les
  // noms de tables et de contraintes.
  app.useGlobalFilters(new AllExceptionsFilter());

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
  app.enableCors({
    origin: config.get<string>('CORS_ORIGINS')?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
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
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(3000);
}
bootstrap();