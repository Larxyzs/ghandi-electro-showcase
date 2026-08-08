export type Category = { id: string; name: string; slug: string; sort_order: number };

export type Product = {
  id: string;
  category_id: string;
  name: string;
  brand: string;
  serial_number: string;
  stock: number;
  price: number | null;
  image_path: string | null;
  image_url: string | null;
  description: string;
  sort_order: number;
};

export type SiteSettings = {
  primary_color: string;
  secondary_color: string;
  text_color: string;
};

export type SiteData = {
  settings: SiteSettings;
  categories: Category[];
  products: Product[];
};

export const DEFAULT_SETTINGS: SiteSettings = {
  primary_color: "#ffffff",
  secondary_color: "#1266e8",
  text_color: "#0f172a",
};