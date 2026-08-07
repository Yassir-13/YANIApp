import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, productsApi } from '../api/products';

export interface CartLine {
  product: Product;
  quantity: number;
}

// Résultat d'une réconciliation avec le catalogue : ce qui a disparu et
// ce qui a changé de prix pendant que le panier dormait.
export interface CartSyncResult {
  removed: string[];
  repriced: { name: string; before: string; after: string }[];
}

interface CartState {
  lines: CartLine[];
  /** false tant que le panier n'a pas été relu depuis le stockage. */
  hasHydrated: boolean;

  count: () => number;
  subtotal: () => number;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
  sync: () => Promise<CartSyncResult>;
  setHydrated: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      hasHydrated: false,

      count: () => get().lines.reduce((n, l) => n + l.quantity, 0),

      subtotal: () =>
        get().lines.reduce((sum, l) => sum + parseFloat(l.product.price) * l.quantity, 0),

      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.product.id === product.id);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l
              ),
            };
          }
          return { lines: [...state.lines, { product, quantity }] };
        }),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.product.id !== productId)
              : state.lines.map((l) =>
                  l.product.id === productId ? { ...l, quantity } : l
                ),
        })),

      increment: (productId) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.product.id === productId ? { ...l, quantity: l.quantity + 1 } : l
          ),
        })),

      decrement: (productId) =>
        set((state) => ({
          lines: state.lines
            .map((l) =>
              l.product.id === productId ? { ...l, quantity: l.quantity - 1 } : l
            )
            .filter((l) => l.quantity > 0),
        })),

      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.product.id !== productId) })),

      clear: () => set({ lines: [] }),

      setHydrated: () => set({ hasHydrated: true }),

      // ─────────────────────────────────────────
      //  Réconciliation avec le catalogue
      // ─────────────────────────────────────────
      //
      // Un panier persistant peut dormir plusieurs jours. Entre-temps, Fati a
      // pu changer un tarif ou désactiver un produit. Sans cette étape, la
      // cliente verrait un prix périmé, puis un total différent au moment de
      // commander (le serveur recalcule toujours le total) — ou un refus
      // global « produit indisponible » sans savoir lequel.
      //
      // On rafraîchit donc les lignes depuis le catalogue actif, et on renvoie
      // ce qui a changé pour pouvoir le dire clairement à la cliente.
      sync: async () => {
        const lines = get().lines;
        if (lines.length === 0) return { removed: [], repriced: [] };

        // /products ne renvoie que les produits actifs : un produit absent de
        // la réponse est supprimé ou désactivé — dans les deux cas il n'est
        // plus commandable.
        const actifs = await productsApi.getAll();
        const parId = new Map(actifs.map((p) => [p.id, p]));

        const removed: string[] = [];
        const repriced: CartSyncResult['repriced'] = [];
        const kept: CartLine[] = [];

        for (const line of lines) {
          const frais = parId.get(line.product.id);
          if (!frais) {
            removed.push(line.product.name);
            continue;
          }
          if (frais.price !== line.product.price) {
            repriced.push({
              name: frais.name,
              before: line.product.price,
              after: frais.price,
            });
          }
          // Remplacé par la version fraîche : prix, nom, image, stock.
          kept.push({ product: frais, quantity: line.quantity });
        }

        set({ lines: kept });
        return { removed, repriced };
      },
    }),
    {
      name: 'yani-cart',
      storage: createJSONStorage(() => AsyncStorage),
      // Seules les lignes vont sur le disque : les fonctions et l'indicateur
      // d'hydratation n'ont pas à être persistés.
      partialize: (state) => ({ lines: state.lines }),
      onRehydrateStorage: () => (state) => {
        // Signale que la lecture du disque est terminée. Sans ce drapeau,
        // l'écran afficherait brièvement « votre panier est vide » avant que
        // les lignes n'apparaissent — de quoi croire qu'on a tout perdu.
        state?.setHydrated();
      },
    }
  )
);
