import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Create an Account",
  description: "Create an account to reserve and manage your study hub visits.",
  path: "/register",
  noIndex: true,
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
