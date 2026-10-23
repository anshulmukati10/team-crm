import { Link } from "react-router";
import LoginForm from "../features/auth/LoginForm";
import RegisterForm from "../features/auth/RegisterForm";

export default function Auth({ mode = "signin" }) {
  const isSignup = mode === "signup";
  return (
    <main className="auth-page">
      <Link className="brand auth-brand" to="/">
        <span className="brand-mark">t</span>
        <span className="brand-name">
          team<span>crm</span>
        </span>
      </Link>
      <section className="auth-card">
        <span className="auth-kicker">TEAM CRM WORKSPACE</span>
        <h1>{isSignup ? "Create your profile" : "Welcome back"}</h1>
        {isSignup ? <RegisterForm /> : <LoginForm />}
      </section>
    </main>
  );
}
