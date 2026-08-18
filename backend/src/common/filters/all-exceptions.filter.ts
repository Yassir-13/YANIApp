import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { pickLanguage, translateMessage } from '../../i18n';

/**
 * Filtre global : dernier passage obligé avant que la réponse ne parte.
 *
 * Sans lui, une erreur Prisma remontait telle quelle en 500, avec son message
 * technique — noms de tables, de colonnes, de contraintes. Illisible pour
 * l'utilisatrice, et révélateur du schéma pour un attaquant.
 *
 * Trois cas : les exceptions volontaires passent intactes, les erreurs Prisma
 * connues sont traduites, tout le reste devient un message neutre dont le
 * détail ne vit que dans les logs du serveur.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { id?: string } }>();

    const { status, message } = this.resolve(exception);

    // Traduction au tout dernier moment, ici et nulle part ailleurs : les
    // services continuent de lever leurs exceptions en français, et c'est ce
    // seul passage obligé qui les rend dans la langue de la requête. Sans
    // en-tête `Accept-Language` — le cas du back-office — rien ne change.
    const langue = pickLanguage(request.headers['accept-language']);
    const messageTraduit = translateMessage(message, langue);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Anomalie : on veut tout, y compris la pile d'appels. L'identifiant
      // de l'utilisateur (jamais son email) aide à rejouer l'incident.
      const who = request.user?.id ? ` [user ${request.user.id}]` : '';
      this.logger.error(
        `${request.method} ${request.url} → ${status}${who}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      // Erreur d'usage attendue (validation, droits, quota) : une ligne suffit.
      this.logger.warn(`${request.method} ${request.url} → ${status}`);
    }

    response.status(status).json({
      statusCode: status,
      message: messageTraduit,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private resolve(exception: unknown): { status: number; message: unknown } {
    // 1. Exceptions levées volontairement par le code métier
    //    (BadRequest, NotFound, Throttler…). Le message est déjà rédigé
    //    en français pour l'utilisatrice : on n'y touche pas.
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      return {
        status: exception.getStatus(),
        // ValidationPipe renvoie { message: [...] } : on conserve le tableau
        // pour que le client puisse afficher chaque erreur de champ.
        message:
          typeof body === 'object' && body !== null && 'message' in body
            ? (body as { message: unknown }).message
            : body,
      };
    }

    // 2. Erreurs Prisma identifiées → langage métier
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrisma(exception);
    }

    // 3. Requête Prisma malformée : le message d'origine décrit le schéma,
    //    il ne doit jamais sortir.
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { status: HttpStatus.BAD_REQUEST, message: 'Requête invalide.' };
    }

    // 4. Base injoignable pendant la requête.
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Service temporairement indisponible. Réessayez dans un instant.',
      };
    }

    // 5. Bug non anticipé : rien ne filtre vers le client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Une erreur interne est survenue.',
    };
  }

  // Codes Prisma courants → réponses HTTP correctes.
  // Référence : https://www.prisma.io/docs/orm/reference/error-reference
  private fromPrisma(error: Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // Contrainte unique (email déjà pris, crédit fidélité déjà accordé…)
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'Cette valeur est déjà utilisée.',
        };

      // Clé étrangère invalide : on référence un élément inexistant
      // (ex. créer un produit avec un categoryId qui n'existe pas)
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Référence invalide : un élément lié est introuvable.',
        };

      // Enregistrement absent lors d'un update/delete
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Élément introuvable.',
        };

      // Valeur trop longue pour la colonne
      case 'P2000':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Une valeur dépasse la longueur autorisée.',
        };

      default:
        // Code non traité : considéré comme un bug, sans fuite de détail.
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Une erreur interne est survenue.',
        };
    }
  }
}
