// URL de l'API. En dev, le backend NestJS tourne sur le port 3000.
// Surchargeable via un fichier .env : VITE_API_URL=https://api.exemple.ma
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
