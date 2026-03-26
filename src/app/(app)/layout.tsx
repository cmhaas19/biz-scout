import { requireAuth } from "@/lib/auth";
import { SidebarLayout } from "@/components/layout/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();

  return (
    <SidebarLayout profile={profile}>
      <div className="p-6 pb-20 md:pb-6">
        {children}
      </div>
    </SidebarLayout>
  );
}
