export type Role = "STUDENT" | "KITCHEN_STAFF" | "ADMIN";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type Dietary = "VEG" | "NON_VEG";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  dietary: Dietary;
  image_url: string;
  in_stock: boolean;
  available_from: string;
  available_until: string;
  within_time_window: boolean;
  available: boolean;
};

export type Category = { id: string; name: string; order: number };

export type SlotStatus = "OPEN" | "FILLING" | "FULL";

export type TimeSlot = {
  id: string;
  label: string;
  part_of_day: string;
  capacity: number;
  booked: number;
  remaining: number;
  status: SlotStatus;
};

export type OrderStatus =
  | "PLACED"
  | "PREPARING"
  | "READY_FOR_PICKUP"
  | "COLLECTED"
  | "CANCELLED";

export type OrderItem = {
  menu_item_id: string;
  name: string;
  price: number;
  dietary: Dietary;
  qty: number;
};

export type Order = {
  id: string;
  token: string;
  user_id: string;
  user_name: string;
  items: OrderItem[];
  total: number;
  slot_id: string;
  slot_label: string;
  slot_start_min: number;
  payment_method: "UPI" | "CAMPUS_CARD" | "CASH";
  status: OrderStatus;
  status_history: { status: OrderStatus; at: string }[];
  rating: number | null;
  rating_comment: string | null;
  created_at: string;
  updated_at: string;
};

export type Analytics = {
  total_revenue: number;
  total_orders: number;
  avg_order: number;
  peak_intervals: { label: string; start: number; orders: number; revenue: number }[];
  top_sellers: { name: string; qty: number; revenue: number }[];
  status_counts: Record<string, number>;
  avg_rating: number;
  rated_count: number;
  recent_feedback: { order_token: string; user_name: string; rating: number; comment: string }[];
};
