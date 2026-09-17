import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "@/components/profile-form";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-[480px] space-y-6">
      <h1 className="font-display text-[32px] font-semibold text-ink">Profile</h1>
      <ProfileForm initialName={user.name ?? ""} initialUsername={user.username} initialEmail={user.email} />
    </div>
  );
}
