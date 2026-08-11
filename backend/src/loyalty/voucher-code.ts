import { randomInt } from 'node:crypto';

// Alphabet volontairement amputé des caractères qu'on confond en dictant un
// code à voix haute au comptoir : ni O ni 0, ni I ni 1 ni L.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const VOUCHER_CODE_LENGTH = 8;

// Code court d'un bon de récompense.
//
// Ce n'est PAS un secret : les routes qui l'acceptent sont déjà réservées au
// personnel authentifié. C'est un identifiant lisible, pour que la cliente
// n'ait pas à dicter un UUID de 36 caractères.
//
// randomInt (et non Math.random) parce qu'il tire uniformément sans biais de
// modulo — un générateur qui favorise les premières lettres de l'alphabet
// rapprocherait les collisions sans qu'on le voie.
export function generateVoucherCode(): string {
  let code = '';
  for (let i = 0; i < VOUCHER_CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
