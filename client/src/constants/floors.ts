export type FloorValue =
  | 'GF'
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8'
  | 'F9' | 'F10' | 'F11' | 'F12' | 'F13' | 'F14' | 'F15' | 'F16';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
};

export const FLOORS: { value: FloorValue; label: string }[] = [
  { value: 'GF', label: 'Ground Floor' },
  ...Array.from({ length: 16 }, (_, i) => ({
    value: `F${i + 1}` as FloorValue,
    label: `${ordinal(i + 1)} Floor`,
  })),
];
