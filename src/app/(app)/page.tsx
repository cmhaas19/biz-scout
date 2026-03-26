import { requireAuth } from "@/lib/auth";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const profile = await requireAuth();
  return <DashboardClient profile={profile} />;
}
