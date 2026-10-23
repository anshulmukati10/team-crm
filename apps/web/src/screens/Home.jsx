import { Link } from "react-router";
import { PageHeading } from "../components/ui/Navbar";
import { useAuth } from "../context/WorkspaceContext";

export default function Home() {
  const { role } = useAuth();
  return (
    <>
      <PageHeading
        title="Your workspace"
        description={`Welcome to Team CRM. You are previewing the ${role.toLowerCase()} workspace.`}
      />
      <section className="panel home-card">
        <h2>Bring your team together</h2>
        <p>
          Manage prospects, coordinate orders, keep inventory moving, and review
          account activity from one workspace.
        </p>
        <div className="home-actions">
          <Link className="button button-primary" to="/dashboard">
            Open overview
          </Link>
          <Link className="button button-secondary" to="/leads">
            View leads
          </Link>
          <Link className="button button-secondary" to="/chat">
            Talk to your team
          </Link>
        </div>
      </section>
    </>
  );
}
