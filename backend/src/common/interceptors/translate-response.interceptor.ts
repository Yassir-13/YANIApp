import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { pickLanguage, translateMessage } from '../../i18n';

/**
 * Traduit le champ `message` des réponses en SUCCÈS.
 *
 * Le filtre d'exceptions ne voit que les erreurs. Or plusieurs routes
 * répondent 200 avec une phrase destinée à la cliente, et l'application
 * mobile les affiche telles quelles — l'écran « changer mon mot de passe »
 * s'appuie même dessus pour annoncer que les autres appareils ont été
 * déconnectés. Sans cet intercepteur, ces phrases-là seraient restées en
 * français au milieu d'une interface arabe.
 *
 * Ce trou n'avait pas été vu à la conception : c'est `scripts/i18n-manquants.js`
 * qui l'a signalé, en relevant des messages de succès parmi les non traduits.
 *
 * Comme le filtre, la traduction se décide sur `Accept-Language` : le
 * back-office n'en envoie pas et continue de recevoir du français.
 */
@Injectable()
export class TranslateResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const langue = pickLanguage(request.headers['accept-language']);

    if (langue === 'fr') return next.handle();

    return next.handle().pipe(
      map((body) => {
        // Seul un objet portant un `message` textuel est concerné. Les
        // listes, les entités et les réponses vides passent intactes.
        if (
          body !== null &&
          typeof body === 'object' &&
          !Array.isArray(body) &&
          typeof (body as { message?: unknown }).message === 'string'
        ) {
          return {
            ...body,
            message: translateMessage(
              (body as { message: string }).message,
              langue,
            ),
          };
        }
        return body;
      }),
    );
  }
}
