import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MAX_IMAGE_BYTES } from './uploads.config';

/**
 * Rend en français le refus d'une image trop lourde.
 *
 * ⚠️ Ce filtre attrape une `PayloadTooLargeException`, et NON l'erreur de
 * multer : `FileInterceptor` traduit lui-même les codes de multer en exceptions
 * Nest avant qu'aucun filtre ne les voie. Un `@Catch(MulterError)` ne se
 * déclenchait donc jamais, et Fati lisait « File too large » — le seul message
 * anglais de toute l'application.
 *
 * Posé sur le seul contrôleur de téléversement, où cette exception ne peut
 * venir que de la limite de poids.
 */
@Catch(PayloadTooLargeException)
export class ImageTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const megaoctets = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));

    response.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: `Image trop lourde : ${megaoctets} Mo au maximum.`,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
