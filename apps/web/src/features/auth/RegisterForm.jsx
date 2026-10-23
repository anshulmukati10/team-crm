import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { registerUser } from "./authApi";

export default function RegisterForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: "SALES",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function handleChange(event) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function getErrorMessage(value) {
    return typeof value === "string"
      ? value
      : value?.message || "Unable to create your account.";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await registerUser(formData);
      navigate("/signin");
    } catch (registerError) {
      setError(getErrorMessage(registerError));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-form-container">
      <h2>Create account</h2>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="register-name">Full name</label>
          <input
            autoComplete="name"
            disabled={isLoading}
            id="register-name"
            name="name"
            onChange={handleChange}
            required
            value={formData.name}
          />
        </div>
        <div className="input-group">
          <label htmlFor="register-email">Email</label>
          <input
            autoComplete="email"
            disabled={isLoading}
            id="register-email"
            name="email"
            onChange={handleChange}
            required
            type="email"
            value={formData.email}
          />
        </div>
        <div className="input-group">
          <label htmlFor="register-password">Password</label>
          <input
            autoComplete="new-password"
            disabled={isLoading}
            id="register-password"
            name="password"
            onChange={handleChange}
            required
            type="password"
            value={formData.password}
          />
        </div>
        <div className="input-group">
          <label htmlFor="register-role">Role</label>
          <select
            disabled={isLoading}
            id="register-role"
            name="role"
            onChange={handleChange}
            value={formData.role}
          >
            <option value="SALES">Sales</option>
            <option value="WAREHOUSE">Warehouse</option>
            <option value="ACCOUNTS">Accounts</option>
          </select>
        </div>
        <button
          className="button button-primary auth-submit"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already registered? <Link to="/signin">Sign in</Link>
      </p>
    </div>
  );
}