import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../context/WorkspaceContext";
import { loginUser } from "./authApi";

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await loginUser({ email, password });
      login(
        {
          id: result.userId,
          name: result.userName,
          email: result.userEmail,
          role: result.userRole,
        },
        "http-only-cookie-session",
      );
      navigate("/dashboard", { replace: true });
    } catch (loginError) {
      setError(
        typeof loginError === "string"
          ? loginError
          : loginError?.message || "Unable to sign in.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-form-container">
      <h2>Sign in</h2>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="login-email">Email address</label>
          <input
            autoComplete="email"
            id="login-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div className="input-group">
          <label htmlFor="login-password">Password</label>
          <input
            autoComplete="current-password"
            id="login-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        <button className="button button-primary auth-submit" disabled={isLoading} type="submit">
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="auth-switch">
        Don’t have an account? <Link to="/signup">Create one</Link>
      </p>
    </div>
  );
}