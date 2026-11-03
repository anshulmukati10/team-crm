import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useCompanyAuth } from "../../context/CompanyAuthContext";
import { registerCompany } from "./companyApi";

export default function CompanyAuth({ mode = "signin" }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const { authNotice, signIn } = useCompanyAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      if (isSignup) {
        await registerCompany(form);
        navigate("/company/signin", { replace: true });
      } else {
        await signIn({ email: form.email, password: form.password });
        navigate("/company", { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message || "Unable to complete your request.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="auth-page company-auth-page">
      <Link className="brand auth-brand" to="/company">
        <span className="brand-name">
          team<span>crm</span>
        </span>
      </Link>
      <section className="auth-card">
        <span className="auth-kicker">COMPANY OWNER PORTAL</span>
        <h1>{isSignup ? "Create your company" : "Company owner sign in"}</h1>
        <div className="login-form-container">
          <h2>{isSignup ? "Company details" : "Sign in"}</h2>
          {authNotice && (
            <p className="error-banner" role="alert">
              {authNotice}
            </p>
          )}
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <div className="input-group">
                <label htmlFor="company-name">Company name</label>
                <input
                  autoComplete="organization"
                  disabled={isLoading}
                  id="company-name"
                  name="name"
                  onChange={handleChange}
                  required
                  value={form.name}
                />
              </div>
            )}
            <div className="input-group">
              <label htmlFor="company-email">Email address</label>
              <input
                autoComplete="email"
                disabled={isLoading}
                id="company-email"
                name="email"
                onChange={handleChange}
                required
                type="email"
                value={form.email}
              />
            </div>
            <div className="input-group">
              <label htmlFor="company-password">Password</label>
              <input
                autoComplete={isSignup ? "new-password" : "current-password"}
                disabled={isLoading}
                id="company-password"
                name="password"
                onChange={handleChange}
                required
                type="password"
                value={form.password}
              />
            </div>
            <button
              className="button button-primary auth-submit"
              disabled={isLoading}
              type="submit"
            >
              {isLoading
                ? isSignup
                  ? "Creating company…"
                  : "Signing in…"
                : isSignup
                  ? "Create company"
                  : "Sign in"}
            </button>
          </form>
          <p className="auth-switch">
            {isSignup ? "Already set up?" : "New to Team CRM?"}{" "}
            <Link to={isSignup ? "/company/signin" : "/company/signup"}>
              {isSignup ? "Company owner sign in" : "Create a company"}
            </Link>
          </p>
          <p className="auth-switch">
            <Link to="/signin">Sign in as a team member</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
