import { redirect } from "next/navigation";
import { BusinessForm } from "@/component/BusinessForm";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";

export default async function BusinessOnboardingPage() {
  const { business } = await getCurrentWorkspace();

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-logo">
          <span>C</span>
          CallAI
        </div>
        <h1>Complete your business profile</h1>
        <p className="auth-subtitle">
          Add details for <strong>{business.name}</strong> so your AI agent can
          speak accurately.
        </p>
        <BusinessForm mode="create" business={business} />
      </div>
    </div>
  );
}
