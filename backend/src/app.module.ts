import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ServicesModule } from './services/services.module';
import { ProductsModule } from './products/products.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { OpeningHoursModule } from './opening-hours/opening-hours.module';
import { SettingsModule } from './settings/settings.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { OrdersModule } from './orders/orders.module';
import { ExportsModule } from './exports/exports.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // ── Limitation du débit (anti brute-force, anti saturation) ──
    // Compteur par adresse IP, gardé en mémoire. Le plafond global protège
    // toute l'API ; les routes coûteuses (argon2) portent en plus une limite
    // stricte via @Throttle. Voir TRUST_PROXY dans main.ts si l'API est
    // déployée derrière un reverse proxy.
    ThrottlerModule.forRoot({
      errorMessage: 'Trop de requêtes. Merci de patienter un instant.',
      throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ServicesModule,
    ProductsModule,
    AppointmentsModule,
    OpeningHoursModule,
    SettingsModule,
    LoyaltyModule,
    OrdersModule,
    ExportsModule,
    UploadsModule,
  ],
  providers: [
    // Garde global : toute route est comptée, sauf @SkipThrottle explicite.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}