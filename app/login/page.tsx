import Link from "next/link";
import { LoginForm } from "@/component/AuthForms";
import "../auth.css";

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <span>C</span>
          CallAI
        </Link>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Sign in to manage your AI calling workspace.</p>
        <LoginForm />
      </div>
    </div>
  );
}
