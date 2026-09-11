import type { CartLine } from "@/src/store/cart";
import type { MenuItem, Order } from "@/src/types";

/**
 * Build cart lines for a re-order. Only items that still exist and are
 * currently available are included. Returns the lines plus how many were
 * skipped (out of stock / removed from menu / outside time window).
 */
export function buildReorderLines(order: Order, menu: MenuItem[]): { lines: CartLine[]; skipped: number } {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const lines: CartLine[] = [];
  let skipped = 0;

  for (const it of order.items) {
    const item = byId.get(it.menu_item_id);
    if (item && item.available) {
      lines.push({
        id: item.id,
        name: item.name,
        price: item.price,
        image_url: item.image_url,
        dietary: item.dietary,
        qty: it.qty,
      });
    } else {
      skipped += 1;
    }
  }
  return { lines, skipped };
}
