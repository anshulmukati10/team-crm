import { useEffect, useRef, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router";
import { io } from "socket.io-client";
import { ROLE_LABELS, ROLES, useAuth } from "../context/WorkspaceContext";
import { initials } from "./ui/Navbar";
import Footer from "./ui/Footer";
import Navbar, { Icon } from "./ui/Navbar";
import teamcrmMark from "../assets/teamcrm-mark.svg";
import { getRooms } from "../features/chat/chatApi";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

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
      {
        to: "/meetings",
        label: "Meetings",
        icon: "users",
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
  "/meetings": "Meetings",
  "/team": "Team members",
  "/profile": "My profile",
};

export default function Layout() {
  const { role, requests, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnreadChatMessages, setHasUnreadChatMessages] = useState(false);
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);
  const title = pageTitles[location.pathname] ?? "Workspace";
  const pendingCount = requests.filter(
    (request) => request.status === "Pending",
  ).length;

  useEffect(() => {
    pathnameRef.current = location.pathname;
    if (location.pathname === "/chat") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHasUnreadChatMessages(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user.id || !API_BASE) return undefined;

    let active = true;
    let roomIds = [];
    const socket = io(API_BASE, { withCredentials: true });
    const joinRooms = () => {
      roomIds.forEach((roomId) => socket.emit("join_room", roomId));
    };

    socket.on("connect", joinRooms);
    socket.on("receive_message", (message) => {
      if (
        Number(message?.userId) !== Number(user.id) &&
        pathnameRef.current !== "/chat"
      ) {
        setHasUnreadChatMessages(true);
      }
    });

    getRooms()
      .then((result) => {
        if (!Array.isArray(result?.rooms)) {
          throw new Error("The API returned invalid group data.");
        }
        if (!active) return;

        roomIds = result.rooms.map((room) => room.id);
        if (socket.connected) joinRooms();
      })
      .catch((error) => {
        if (active) {
          console.error("Unable to subscribe to chat notifications:", error);
        }
      });

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [user.id]);

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
                    <span className="nav-chat-icon">
                      <Icon name={item.icon} size={19} />
                      {item.to === "/chat" &&
                        hasUnreadChatMessages && (
                        <span
                          aria-label="New messages"
                          className="chat-unread-dot"
                        />
                      )}
                    </span>
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
