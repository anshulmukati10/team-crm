import { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../context/WorkspaceContext";
import { logoutUser } from "../features/auth/authApi";

export default function LogoutButton() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");
    try {
      await logoutUser();
      signOut();
      navigate("/signin", { replace: true });
    } catch (logoutError) {
      setError(
        typeof logoutError === "string"
          ? logoutError
          : logoutError?.message || "Unable to sign out.",
      );
    }
  }

  return (
    <>
      <button className="text-button" onClick={handleLogout} type="button">
        Sign out
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
