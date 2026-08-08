export type AdminRole = "super" | "staff";

export type StaffAccount = {
  id: string;
  username: string;
  role: AdminRole;
  created_at: string;
};
