export type Role = 'STAFF' | 'ADMIN' | 'RUNNER';
export type ItemStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'OUT_OF_STOCK';
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
  role: Role;
  floor?: string;
  officeNumber?: string;
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
}

export interface OrderItem {
  id: string;
  menuItem: MenuItem;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  user: { email: string; floor: string | null; officeNumber: string | null };
  items: OrderItem[];
  deliveryFee: number;
  status: OrderStatus;
  floor: string;
  officeNumber: string;
  paystackRef?: string;
  paid: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  type: AnnouncementType;
  message: string;
  active: boolean;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
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
