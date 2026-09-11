import { create } from "zustand";

import type { Dietary, MenuItem } from "@/src/types";

export type CartLine = {
  id: string;
  name: string;
  price: number;
  image_url: string;
  dietary: Dietary;
  qty: number;
};

type CartState = {
  lines: Record<string, CartLine>;
  add: (item: MenuItem) => void;
  increment: (id: string) => void;
  decrement: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  addMany: (lines: CartLine[]) => void;
};

export const useCart = create<CartState>((set) => ({
  lines: {},
  add: (item) =>
    set((state) => {
      const existing = state.lines[item.id];
      const qty = existing ? existing.qty + 1 : 1;
      return {
        lines: {
          ...state.lines,
          [item.id]: {
            id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            dietary: item.dietary,
            qty,
          },
        },
      };
    }),
  increment: (id) =>
    set((state) => {
      const line = state.lines[id];
      if (!line) return state;
      return { lines: { ...state.lines, [id]: { ...line, qty: line.qty + 1 } } };
    }),
  decrement: (id) =>
    set((state) => {
      const line = state.lines[id];
      if (!line) return state;
      if (line.qty <= 1) {
        const next = { ...state.lines };
        delete next[id];
        return { lines: next };
      }
      return { lines: { ...state.lines, [id]: { ...line, qty: line.qty - 1 } } };
    }),
  remove: (id) =>
    set((state) => {
      const next = { ...state.lines };
      delete next[id];
      return { lines: next };
    }),
  clear: () => set({ lines: {} }),
  addMany: (newLines) =>
    set((state) => {
      const lines = { ...state.lines };
      newLines.forEach((l) => {
        lines[l.id] = l;
      });
      return { lines };
    }),
}));

export function cartCount(lines: Record<string, CartLine>): number {
  return Object.values(lines).reduce((sum, l) => sum + l.qty, 0);
}

export function cartTotal(lines: Record<string, CartLine>): number {
  return Object.values(lines).reduce((sum, l) => sum + l.qty * l.price, 0);
}
