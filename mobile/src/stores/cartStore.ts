import { create } from 'zustand';
import { Product } from '../api/products';

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  count: () => number;
  subtotal: () => number;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: string, quantity: number) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  lines: [],

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
}));