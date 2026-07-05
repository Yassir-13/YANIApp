import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // retire les champs non déclarés dans le DTO
      forbidNonWhitelisted: true, // rejette la requête si champ inconnu
      transform: true,            // convertit les types automatiquement
    }),
  );

  await app.listen(3000);
}
bootstrap();