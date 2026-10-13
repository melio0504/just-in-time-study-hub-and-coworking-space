import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Customer Login",
  description: "Sign in to manage your Just In Time Study Hub reservations.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
