import { requireAuth } from "@/lib/auth";
import { ListingsClient } from "@/components/listings/listings-client";

export default async function ListingsPage() {
  const profile = await requireAuth();
  return <ListingsClient profile={profile} />;
}
