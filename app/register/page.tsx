import Link from "next/link";
import { RegisterForm } from "@/component/AuthForms";
import "../auth.css";

export default function RegisterPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-logo">
          <span>C</span>
          CallAI
        </Link>
        <h1>Create your account</h1>
        <p className="auth-subtitle">
          Start with your coaching institute profile. Other industries can be
          added later.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
