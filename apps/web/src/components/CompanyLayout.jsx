import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { useCompanyAuth } from "../context/CompanyAuthContext";
import { Icon, initials } from "./ui/Navbar";
import Footer from "./ui/Footer";
import teamcrmMark from "../assets/teamcrm-mark.svg";

const companyNavigation = [
  { to: "/company", label: "Overview", icon: "grid", end: true },
  { to: "/company/team", label: "Team members", icon: "users" },
  { to: "/company/orders", label: "Orders", icon: "box" },
  { to: "/company/wallet", label: "Wallet", icon: "chart" },
  { to: "/company/subscription", label: "Plans & billing", icon: "chart" },
];

const companyTitles = {
  "/company": "Company overview",
  "/company/dashboard": "Company overview",
  "/company/team": "Team members",
  "/company/orders": "Company orders",
  "/company/wallet": "Company wallet",
  "/company/subscription": "Plans & billing",
};

export default function CompanyLayout() {
  const { company, signOut } = useCompanyAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!company) return <Navigate replace to="/company/signin" />;

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="app-shell company-shell">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="mobile-scrim"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <NavLink
          className="brand"
          onClick={() => setSidebarOpen(false)}
          to="/company"
        >
          <img alt="" className="brand-mark" src={teamcrmMark} />
          <span className="brand-name">
            team<span>crm</span>
          </span>
        </NavLink>
        <div className="workspace-picker">
          <span className="workspace-avatar">
            {initials(company.name).slice(0, 1)}
          </span>
          <span className="workspace-label">
            <strong>{company.name}</strong>
            <small>Company owner</small>
          </span>
        </div>
        <div className="nav-scroll">
          <div className="nav-group">
            <p className="nav-label">Company</p>
            {companyNavigation.map((item) => (
              <NavLink
                className={({ isActive }) =>
                  `nav-link ${isActive ? "nav-link-active" : ""}`
                }
                end={item.end}
                key={item.to}
                onClick={() => setSidebarOpen(false)}
                to={item.to}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar avatar-blue">{initials(company.name)}</div>
            <div className="user-mini-copy">
              <strong>{company.name}</strong>
              <small>Owner account</small>
            </div>
          </div>
          <button
            className="company-signout"
            onClick={handleSignOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar company-topbar">
          <div className="company-topbar-title">
            <button
              aria-label="Open navigation"
              className="icon-button company-menu-button"
              onClick={() => setSidebarOpen(true)}
              type="button"
            >
              <Icon name="menu" size={20} />
            </button>
            <div className="breadcrumb">
              <span>Company</span>
              <Icon name="chevron" size={14} />
              <strong>{companyTitles[location.pathname] || "Company portal"}</strong>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="company-account-email">{company.email}</span>
            <div className="avatar avatar-blue topbar-avatar">
              {initials(company.name)}
            </div>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
          <Footer />
        </main>
      </div>
    </div>
  );
}
