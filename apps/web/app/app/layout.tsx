import { AppShell } from "@/components/app/AppShell";

export const metadata = { title: "Kept" };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
