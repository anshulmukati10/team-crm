import { useEffect, useState } from "react";
import LogoutButton from "../components/LogoutButton";
import { Icon, initials, PageHeading } from "../components/ui/Navbar";
import { useAuth } from "../context/WorkspaceContext";
import { getUserProfile, updateUserProfile } from "../features/auth/authApi";

function getErrorMessage(error) {
  return typeof error === "string"
    ? error
    : error?.message || "Unable to load your profile.";
}

export default function Profile() {
  const { login } = useAuth();
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getUserProfile()
      .then((result) => {
        if (!active) return;
        setProfile(result);
        setFormData({
          name: result.name || "",
          email: result.email || "",
          password: "",
        });
      })
      .catch((loadError) => {
        if (active) setError(getErrorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleChange(event) {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const updates = { name: formData.name, email: formData.email };
    if (formData.password) updates.password = formData.password;

    try {
      const updatedProfile = await updateUserProfile(updates);
      setProfile(updatedProfile);
      setFormData({
        name: updatedProfile.name || "",
        email: updatedProfile.email || "",
        password: "",
      });
      login(updatedProfile, "http-only-cookie-session");
      setNotice("Profile updated.");
    } catch (updateError) {
      setError(getErrorMessage(updateError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeading title="My profile" />
      {error && (
        <div className="inline-notice error-notice" role="alert">
          <Icon name="close" size={17} />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="inline-notice" role="status">
          <Icon name="check" size={17} />
          <span>{notice}</span>
        </div>
      )}
      {loading ? (
        <div className="empty-state" role="status">
          Loading profile…
        </div>
      ) : profile ? (
        <section className="panel profile-edit-card">
          <div className="profile-card">
            <div className="profile-avatar">{initials(profile.name)}</div>
            <div>
              <h2>{profile.name}</h2>
              <p>{profile.role}</p>
            </div>
            <LogoutButton />
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="profile-name">Full name</label>
              <input
                autoComplete="name"
                id="profile-name"
                name="name"
                onChange={handleChange}
                required
                value={formData.name}
              />
            </div>
            <div className="input-group">
              <label htmlFor="profile-email">Email</label>
              <input
                autoComplete="email"
                id="profile-email"
                name="email"
                onChange={handleChange}
                required
                type="email"
                value={formData.email}
              />
            </div>
            <div className="input-group">
              <label htmlFor="profile-password">New password</label>
              <input
                autoComplete="new-password"
                id="profile-password"
                name="password"
                onChange={handleChange}
                placeholder="Leave blank to keep current password"
                type="password"
                value={formData.password}
              />
            </div>
            <div className="profile-form-actions">
              <button
                className="button button-primary"
                disabled={saving}
                type="submit"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
