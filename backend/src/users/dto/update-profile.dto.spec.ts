import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

/**
 * Le téléphone était ineffaçable (I25).
 *
 * L'app envoyait `undefined` pour un champ vidé — or `undefined` disparaît du
 * JSON, le serveur ne voyait donc aucun champ `phone` et laissait l'ancien
 * numéro en base, pendant que l'écran annonçait « Votre profil a été mis à
 * jour ». Le champ est pourtant libellé « (optionnel) ».
 *
 * La distinction `null` / `undefined` porte donc tout le correctif, et elle est
 * invisible à la lecture : ces tests la verrouillent.
 */
describe('UpdateProfileDto', () => {
  const valider = (valeurs: Record<string, unknown>) => {
    const dto = plainToInstance(UpdateProfileDto, valeurs);
    return {
      erreurs: validateSync(dto as object, { whitelist: true }).map(
        (e) => e.property,
      ),
      dto: dto as UpdateProfileDto,
    };
  };

  describe('téléphone', () => {
    it('accepte null, et le transmet — c’est l’effacement', () => {
      const { erreurs, dto } = valider({ phone: null });

      expect(erreurs).toEqual([]);
      // Le point crucial : `phone` doit SURVIVRE à la validation avec la
      // valeur null. S'il disparaissait de l'objet, Prisma ne toucherait pas
      // à la colonne et le numéro resterait — le bug d'origine, intact.
      expect('phone' in dto).toBe(true);
      expect(dto.phone).toBeNull();
    });

    it('laisse le numéro intact quand le champ est absent', () => {
      const { erreurs, dto } = valider({ firstName: 'Sarah' });

      expect(erreurs).toEqual([]);
      // Absent du DTO = absent du `data` de Prisma = colonne non modifiée.
      // C'est le comportement voulu pour une mise à jour partielle, et c'est
      // exactement ce qu'il ne faut PAS faire quand la cliente vide le champ.
      expect(dto.phone).toBeUndefined();
    });

    it('accepte un numéro marocain valide', () => {
      expect(valider({ phone: '0612345678' }).erreurs).toEqual([]);
      expect(valider({ phone: '+212612345678' }).erreurs).toEqual([]);
    });

    it('refuse un numéro qui n’en est pas un', () => {
      // Le numéro est le seul moyen de contact de l'institut : une faute de
      // frappe et la cliente n'est joignable ni pour sa commande, ni pour son
      // rendez-vous.
      expect(valider({ phone: 'pas-un-numero' }).erreurs).toContain('phone');
      expect(valider({ phone: '0012345678' }).erreurs).toContain('phone');
    });
  });

  describe('prénom et nom', () => {
    it('refuse de les vider par une chaîne vide', () => {
      // Effacer son numéro est légitime, effacer son nom ne l'est pas :
      // l'institut doit savoir qui vient au rendez-vous.
      expect(valider({ firstName: '' }).erreurs).toContain('firstName');
      expect(valider({ lastName: '' }).erreurs).toContain('lastName');
    });

    it('accepte une mise à jour partielle', () => {
      expect(valider({ firstName: 'Sarah' }).erreurs).toEqual([]);
    });
  });
});
