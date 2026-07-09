import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Documentation Swagger (développement uniquement) ──
  if (config.get<string>('NODE_ENV') !== 'production') {
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
      .addTag('auth', 'Authentification et sessions')
      .addTag('users', 'Gestion des utilisateurs')
      .addTag('services', 'Catalogue de prestations')
      .addTag('products', 'Catalogue de produits')
      .addTag('appointments', 'Rendez-vous')
      .addTag('loyalty', 'Programme de fidélité')
      .addTag('opening-hours', "Horaires d'ouverture")
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api-docs', app, document);
  }

  await app.listen(3000);
}
bootstrap();