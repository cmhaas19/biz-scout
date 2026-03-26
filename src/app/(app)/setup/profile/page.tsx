import { requireAuth } from "@/lib/auth";
import { ProfileEditor } from "@/components/profile/profile-editor";

export default async function ProfileSettingsPage() {
  const profile = await requireAuth();
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Buyer Profile</h1>
        <p className="text-muted-foreground mt-1">
          Define your acquisition criteria. Changes will mark existing evaluations as stale.
        </p>
      </div>
      <ProfileEditor profile={profile} />
    </div>
  );
}
