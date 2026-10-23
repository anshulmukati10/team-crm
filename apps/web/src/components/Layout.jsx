import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { ROLE_LABELS, ROLES, useAuth } from "../context/WorkspaceContext";
import { initials } from "./ui/Navbar";
import Footer from "./ui/Footer";
import Navbar, { Icon } from "./ui/Navbar";
import teamcrmMark from "../assets/teamcrm-mark.svg";

const navigation = [
  {
    group: "Workspace",
    items: [
      { to: "/", label: "Overview", icon: "grid", roles: Object.values(ROLES) },
      {
        to: "/leads",
        label: "Leads",
        icon: "users",
        roles: [ROLES.ADMIN, ROLES.SALES, ROLES.ACCOUNTS],
      },
      {
        to: "/orders",
        label: "Orders",
        icon: "box",
        roles: Object.values(ROLES),
      },
      {
        to: "/inventory",
        label: "Inventory",
        icon: "package",
        roles: [ROLES.ADMIN, ROLES.WAREHOUSE],
      },
      {
        to: "/requests",
        label: "Stock requests",
        icon: "truck",
        roles: [ROLES.ADMIN, ROLES.WAREHOUSE],
      },
    ],
  },
  {
    group: "Manage",
    items: [
      {
        to: "/accounts",
        label: "Accounts",
        icon: "chart",
        roles: [ROLES.ADMIN, ROLES.ACCOUNTS],
      },
      { to: "/team", label: "Team", icon: "users", roles: [ROLES.ADMIN] },
      {
        to: "/chat",
        label: "Team chat",
        icon: "chat",
        roles: Object.values(ROLES),
      },
    ],
  },
];

const pageTitles = {
  "/": "Overview",
  "/dashboard": "Overview",
  "/home": "Home",
  "/leads": "Leads",
  "/orders": "Orders",
  "/inventory": "Inventory",
  "/requests": "Stock requests",
  "/accounts": "Accounts",
  "/chat": "Team chat",
  "/team": "Team members",
  "/profile": "My profile",
};

export default function Layout() {
  const { role, requests, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = pageTitles[location.pathname] ?? "Workspace";
  const pendingCount = requests.filter(
    (request) => request.status === "Pending",
  ).length;

  if (!user.loggedIn) return <Navigate replace to="/signin" />;

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          aria-label="Close navigation"
          className="mobile-scrim"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <NavLink className="brand" onClick={() => setSidebarOpen(false)} to="/">
          <img alt="" className="brand-mark" src={teamcrmMark} />
          <span className="brand-name">
            team<span>crm</span>
          </span>
        </NavLink>
        <div className="workspace-picker">
          <span className="workspace-avatar">A</span>
          <span className="workspace-label">
            <strong>Team</strong>
            <small>Workspace</small>
          </span>
          <Icon className="workspace-chevron" name="down" size={16} />
        </div>
        <div className="nav-scroll">
          {navigation.map(({ group, items }) => (
            <div className="nav-group" key={group}>
              <p className="nav-label">{group}</p>
              {items
                .filter((item) => item.roles.includes(role))
                .map((item) => (
                  <NavLink
                    end={item.to === "/"}
                    key={item.to}
                    onClick={() => setSidebarOpen(false)}
                    to={item.to}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "nav-link-active" : ""}`
                    }
                  >
                    <Icon name={item.icon} size={19} />
                    <span>{item.label}</span>
                    {item.to === "/requests" && pendingCount > 0 && (
                      <span className="nav-count">{pendingCount}</span>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </div>
        <div className="sidebar-bottom">
          <NavLink className="user-mini user-profile-link" to="/profile">
            <div className="avatar avatar-blue">{initials(user.name)}</div>
            <div className="user-mini-copy">
              <strong>{user.name}</strong>
              <small>{ROLE_LABELS[role] || "Unassigned role"}</small>
            </div>
            <Icon name="chevron" size={16} />
          </NavLink>
        </div>
      </aside>
      <div className="main-column">
        <Navbar
          onMenu={() => setSidebarOpen(true)}
          title={title}
          user={user}
        />
        <main className="main-content">
          <Outlet />
          <Footer />
        </main>
      </div>
    </div>
  );
}
