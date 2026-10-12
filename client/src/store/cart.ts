import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, MenuItem, Side } from '../types';
import { applyDiscount } from '../lib/utils';

function sidesKey(sides: Side[]): string {
  return [...sides].map((s) => s.id).sort().join('|');
}

export function lineTotal(item: CartItem): number {
  const sidesPrice = item.selectedSides.reduce((sum, s) => sum + s.price, 0);
  const unit = applyDiscount(Number(item.menuItem.price), item.menuItem.discountPercent ?? 0);
  return (unit + sidesPrice) * item.quantity;
}

// How much the line's item discount saves, for "You save" in the cart.
export function lineSavings(item: CartItem): number {
  const price = Number(item.menuItem.price);
  return (price - applyDiscount(price, item.menuItem.discountPercent ?? 0)) * item.quantity;
}

interface CartStore {
  items: CartItem[];
  addItem: (menuItem: MenuItem, selectedSides?: Side[], quantity?: number) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  itemsTotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (menuItem, selectedSides = [], quantity = 1) => {
        const items = get().items;
        const key = sidesKey(selectedSides);
        const existing = items.find(
          (i) => i.menuItem.id === menuItem.id && sidesKey(i.selectedSides) === key,
        );
        if (existing) {
          set({
            items: items.map((i) =>
              i.lineId === existing.lineId
                ? { ...i, quantity: i.quantity + quantity }
                : i,
            ),
          });
        } else {
          const lineId =
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `${menuItem.id}-${Date.now()}-${Math.random()}`;
          set({ items: [...items, { lineId, menuItem, quantity, selectedSides }] });
        }
      },

      removeItem: (lineId) => {
        set({ items: get().items.filter((i) => i.lineId !== lineId) });
      },

      updateQuantity: (lineId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(lineId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.lineId === lineId ? { ...i, quantity } : i,
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      itemsTotal: () => get().items.reduce((sum, item) => sum + lineTotal(item), 0),

      itemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: 'pk-food-cart' },
  ),
);
