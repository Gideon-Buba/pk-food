import type { FoodCategory } from '../types';

export const CATEGORY_META: Record<FoodCategory, { label: string }> = {
  RICE:     { label: 'Rice Dishes'       },
  SWALLOW:  { label: 'Swallow & Soups'   },
  PROTEIN:  { label: 'Proteins'          },
  SIDES:    { label: 'Sides'             },
  PASTA:    { label: 'Pasta'             },
  PASTRIES: { label: 'Pastries & Snacks' },
  BUFFET:   { label: 'Buffet'            },
  DRINKS:   { label: 'Drinks'            },
};

export const CATEGORY_ORDER: FoodCategory[] = [
  'RICE', 'SWALLOW', 'PROTEIN', 'SIDES', 'PASTA', 'PASTRIES', 'BUFFET', 'DRINKS',
];
