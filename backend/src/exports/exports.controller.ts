import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
// `import type` : le type ne sert qu'à la signature, et l'importer
// normalement casse la compilation (isolatedModules + métadonnées de décorateur).
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ExportsService } from './exports.service';
import {
  ExportAppointmentsQueryDto,
  ExportOrdersQueryDto,
  ExportUsersQueryDto,
} from './dto/export-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Les exports sont le bilan de l'institut : chiffre d'affaires, fichier
// clientes complet. Ils sont réservés à l'administratrice, ET LE VERROU EST
// ICI — masquer le bouton dans le backoffice ne serait qu'un rideau, l'adresse
// appelée à la main répondrait quand même (même raisonnement que la page
// /users côté backoffice).
@ApiTags('exports')
@Controller('exports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('users.xlsx')
  async users(@Query() query: ExportUsersQueryDto, @Res() res: Response) {
    this.envoyer(res, await this.exportsService.users(query));
  }

  @Get('orders.xlsx')
  async orders(@Query() query: ExportOrdersQueryDto, @Res() res: Response) {
    this.envoyer(res, await this.exportsService.orders(query));
  }

  @Get('appointments.xlsx')
  async appointments(
    @Query() query: ExportAppointmentsQueryDto,
    @Res() res: Response,
  ) {
    this.envoyer(res, await this.exportsService.appointments(query));
  }

  private envoyer(
    res: Response,
    fichier: { buffer: Buffer; filename: string },
  ) {
    res.setHeader('Content-Type', XLSX);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fichier.filename}"`,
    );
    res.setHeader('Content-Length', fichier.buffer.length);
    res.send(fichier.buffer);
  }
}
