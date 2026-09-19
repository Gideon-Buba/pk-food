export type Role = 'STAFF' | 'ADMIN' | 'RUNNER';
export type Floor =
  | 'GF'
  | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7' | 'F8'
  | 'F9' | 'F10' | 'F11' | 'F12' | 'F13' | 'F14' | 'F15' | 'F16';
export type ItemStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_STOCK';
export type FoodCategory = 'RICE' | 'SWALLOW' | 'PROTEIN' | 'SIDES' | 'PASTA' | 'PASTRIES' | 'BUFFET' | 'DRINKS';
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED';
export type AnnouncementType = 'STATUS' | 'GENERAL';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: Role;
  floor?: Floor | null;
  officeNumber?: string | null;
  telegramChatId?: string | null;
}

export interface Vendor {
  id: string;
  name: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  vendor: Vendor;
  vendorId: string;
  totalStock: number;
  onlineStock: number;
  status: ItemStatus;
  category?: FoodCategory | null;
  requiresPackaging: boolean;
}

export interface Side {
  id: string;
  name: string;
  price: number;
  vendorId: string;
  status: ItemStatus;
}

export interface OrderItemSide {
  id: string;
  sideId: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  requiresPackaging: boolean;
  sides: OrderItemSide[];
}

export type PaymentMethod = 'FLUTTERWAVE' | 'BANK_TRANSFER';

export interface Order {
  id: string;
  reference: string;
  user: { name?: string | null; email: string; floor: string | null; officeNumber: string | null };
  items: OrderItem[];
  deliveryFee: number;
  packagingFee: number;
  status: OrderStatus;
  floor: string;
  officeNumber: string;
  phone?: string | null;
  paymentMethod: PaymentMethod;
  paymentRef?: string;
  transferReference?: string | null;
  paid: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  type: AnnouncementType;
  message: string;
  active: boolean;
}

export interface CartItem {
  lineId: string;
  menuItem: MenuItem;
  quantity: number;
  selectedSides: Side[];
}

export interface AppSettings {
  packagingFee: number;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  exp: number;
}
