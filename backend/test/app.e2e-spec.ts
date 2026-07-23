import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Santé de l\'API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // La sonde doit répondre sans token : Docker et la supervision n'en ont pas.
  it('GET /health répond 200 avec un statut ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime).toBe('number');
        expect(typeof res.body.timestamp).toBe('string');
      });
  });

  // La racine n'expose plus rien : le « Hello World! » de Nest a été retiré.
  it('GET / ne renvoie plus de contenu par défaut', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });

  afterEach(async () => {
    await app.close();
  });
});
