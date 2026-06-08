import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, MenuItem } from '../types';

interface CartStore {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity?: number) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  itemsTotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (menuItem, quantity = 1) => {
        const items = get().items;
        const existing = items.find((i) => i.menuItem.id === menuItem.id);
        if (existing) {
          set({
            items: items.map((i) =>
              i.menuItem.id === menuItem.id
                ? { ...i, quantity: i.quantity + quantity }
                : i,
            ),
          });
        } else {
          set({ items: [...items, { menuItem, quantity }] });
        }
      },

      removeItem: (menuItemId) => {
        set({ items: get().items.filter((i) => i.menuItem.id !== menuItemId) });
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.menuItem.id === menuItemId ? { ...i, quantity } : i,
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      itemsTotal: () =>
        get().items.reduce(
          (sum, item) => sum + item.menuItem.price * item.quantity,
          0,
        ),

      itemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    { name: 'pk-food-cart' },
  ),
);
