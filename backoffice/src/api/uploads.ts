import { apiClient } from './client';

// Doit rester aligné sur MAX_IMAGE_BYTES côté backend. Le contrôle est refait
// ici uniquement pour éviter d'envoyer 20 Mo à travers le réseau avant de se
// faire refuser : le serveur reste seul juge.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const uploadsApi = {
  /**
   * Téléverse une image et renvoie son chemin (« /uploads/….webp »), à passer
   * tel quel en `imageUrl` lors de l'enregistrement de la prestation ou du
   * produit. Utiliser mediaUrl() pour l'afficher.
   */
  async uploadImage(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);

    // Aucun en-tête Content-Type posé à la main : le navigateur doit générer
    // lui-même la frontière (« boundary ») du multipart. L'écrire ici donnait
    // un corps que le serveur n'arrivait pas à découper.
    const { data } = await apiClient.post<{ url: string }>('/uploads/image', form);
    return data.url;
  },
};
