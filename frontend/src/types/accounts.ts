export type Language = "en" | "ar";
export interface Profile {
  user_id: string;
  display_name: string;
  timezone: string;
  weight_unit: "kg" | "lb";
  language: Language;
  goal: "cutting" | "bulking";
  height_cm: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}
export interface Account {
  user: { id: string; email: string; has_password: boolean };
  profile: Profile;
  identities: string[];
  csrf_token: string;
}
