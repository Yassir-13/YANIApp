import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { UPLOADS_ROUTE, resolveUploadsDir } from './uploads.config';

/**
 * Formats acceptés, reconnus à leurs premiers octets.
 *
 * ⚠️ Le type déclaré par le navigateur (`file.mimetype`) et l'extension du
 * fichier viennent tous les deux du client : ils se falsifient en une ligne.
 * Se fier à eux, c'est accepter d'écrire n'importe quoi dans un dossier que le
 * serveur publie ensuite en HTTP. Seule la signature binaire dit ce que le
 * fichier EST réellement, et c'est elle qui choisit l'extension enregistrée.
 *
 * Le SVG est absent, et ce n'est pas un oubli : c'est du XML qui peut contenir
 * du JavaScript. Servi depuis notre propre domaine, il s'exécuterait avec les
 * droits du backoffice — une faille XSS ouverte par un simple téléversement.
 */
const SIGNATURES: { extension: string; matches: (buffer: Buffer) => boolean }[] = [
  {
    extension: 'jpg',
    matches: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extension: 'png',
    matches: (b) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    extension: 'webp',
    matches: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP',
  },
];

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger('Uploads');
  private readonly directory: string;

  constructor(config: ConfigService) {
    this.directory = resolveUploadsDir(config.get<string>('UPLOADS_DIR'));
  }

  // Au démarrage plutôt qu'au premier téléversement : un dossier impossible à
  // créer (droits, chemin erroné) doit se voir tout de suite dans les logs, et
  // non le jour où Fati ajoute sa première prestation.
  async onModuleInit() {
    await mkdir(this.directory, { recursive: true });
    this.logger.log(`Images stockées dans ${this.directory}`);
  }

  /**
   * Écrit l'image et renvoie le chemin PUBLIC à enregistrer en base.
   *
   * Le nom du fichier est tiré au sort ici, jamais repris de celui du client :
   * c'est ce qui interdit d'un seul coup la traversée de répertoire
   * (`../../.env`), l'écrasement d'un fichier existant et les extensions
   * mensongères.
   */
  async saveImage(buffer: Buffer): Promise<string> {
    const format = SIGNATURES.find((signature) => signature.matches(buffer));

    if (!format) {
      throw new BadRequestException(
        'Format non reconnu. Seules les images JPEG, PNG et WebP sont acceptées.',
      );
    }

    const filename = `${randomUUID()}.${format.extension}`;
    await writeFile(join(this.directory, filename), buffer);

    return `${UPLOADS_ROUTE}/${filename}`;
  }
}
