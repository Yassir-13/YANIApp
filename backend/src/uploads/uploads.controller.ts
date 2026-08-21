import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ImageTooLargeFilter } from './image-too-large.filter';
import { MAX_IMAGE_BYTES } from './uploads.config';
import { UploadsService } from './uploads.service';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @ApiOperation({
    summary: "Téléverser une image de catalogue et obtenir son chemin",
    description:
      "Renvoie `{ url: '/uploads/….webp' }`. Ce chemin RELATIF est celui à " +
      'passer en `imageUrl` lors de la création ou de la modification d’une ' +
      'prestation ou d’un produit. Chaque client le préfixe par sa propre ' +
      "base d'API pour l'afficher.",
  })
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  // ADMIN seule : le dossier est publié en HTTP sans authentification, y écrire
  // revient à publier sur le site de l'institut.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  // Plafond propre à la route, sous le plafond global de 120/min : un
  // téléversement coûte une écriture disque, et rien ne justifie d'en enchaîner
  // des dizaines par minute depuis un formulaire.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseFilters(ImageTooLargeFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      // En mémoire, et non directement sur le disque : le contenu est vérifié
      // AVANT qu'une ligne ne soit écrite. Avec le stockage disque de multer,
      // un fichier refusé aurait d'abord existé dans le dossier publié — le
      // temps d'être supprimé, il était déjà téléchargeable.
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  @Post('image')
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Aucun fichier reçu (champ attendu : « file »).");
    }

    return { url: await this.uploadsService.saveImage(file.buffer) };
  }
}
