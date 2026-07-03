export type MenuCategory = "base" | "pizza" | "topping";

export type MenuItem = {
  id: string;
  category: MenuCategory;
  name: string;
  price: number;
  is_active: boolean;
};

export type PaymentMode = "Cash" | "Card" | "UPI";

export type OrderRecord = {
  id: string;
  customer_name: string;
  phone: string;
  quantity: number;
  unit_total: number;
  subtotal: number;
  discount_rate: number;
  discount_amount: number;
  post_discount_total: number;
  gst_amount: number;
  grand_total: number;
  payment_mode: PaymentMode;
  created_at: string;
};

export type OrderItemRecord = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  category: MenuCategory;
  item_name: string;
  unit_price: number;
};

export type OrderWithItems = OrderRecord & { order_items: OrderItemRecord[] };
