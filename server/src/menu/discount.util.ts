// Discounted unit price, rounded to the nearest whole naira.
export function applyDiscount(price: number, discountPercent: number): number {
  if (discountPercent <= 0) return price;
  return Math.round((price * (100 - discountPercent)) / 100);
}
