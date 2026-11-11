import type { User } from "@supabase/supabase-js";

export function canUserChangePassword(user: Pick<User, "app_metadata">) {
  return user.app_metadata.provider === "email";
}
