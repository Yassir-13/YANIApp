import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

/**
 * Le verrou de l'export tient à deux décorateurs posés sur le contrôleur. Les
 * supprimer ne casserait rien de visible : le backoffice continuerait de
 * n'afficher le bouton qu'à l'administratrice, et le personnel pourrait
 * pourtant télécharger le chiffre d'affaires en tapant l'adresse. D'où ces
 * deux vérifications, qui ne testent pas un comportement mais une consigne.
 */
describe('ExportsController — accès', () => {
  it("n'est ouvert qu'à l'administratrice", () => {
    expect(new Reflector().get(ROLES_KEY, ExportsController)).toEqual([
      'ADMIN',
    ]);
  });

  it('vérifie le jeton PUIS le rôle', () => {
    // L'ordre compte : RolesGuard lit l'utilisateur que JwtAuthGuard a posé
    // sur la requête. Seul, il laisserait passer une requête anonyme.
    expect(Reflect.getMetadata(GUARDS_METADATA, ExportsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
  });
});

describe('ExportsController — réponse', () => {
  it('annonce un classeur Excel et son nom de fichier', async () => {
    const service = {
      orders: jest.fn().mockResolvedValue({
        buffer: Buffer.from('classeur'),
        filename: 'commandes_2026-08-01_2026-08-31.xlsx',
      }),
    };
    const controller = new ExportsController(
      service as unknown as ExportsService,
    );
    const res = { setHeader: jest.fn(), send: jest.fn() };

    await controller.orders({}, res as any);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    // Forme exacte attendue par le backoffice, qui y lit le nom du fichier.
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="commandes_2026-08-01_2026-08-31.xlsx"',
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('classeur'));
  });
});
