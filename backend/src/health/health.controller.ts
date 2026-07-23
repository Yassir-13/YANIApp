import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({
    summary: "Sonde de santé de l'API (Docker, supervision)",
    description:
      "Vérifie que l'API répond ET que la base est joignable. " +
      'Volontairement non authentifiée : les sondes de déploiement ne portent pas de token.',
  })
  @ApiResponse({ status: 200, description: 'API et base de données opérationnelles.' })
  @ApiResponse({ status: 503, description: 'Base de données injoignable.' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async check() {
    // Une API qui répond mais dont la base est tombée ne sert à rien :
    // la sonde doit échouer pour que l'orchestrateur retire l'instance.
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // Aucun détail de l'erreur : cette route est publique, elle ne doit
      // rien révéler de l'infrastructure (hôte, port, identifiants).
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unreachable',
      });
    }

    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
