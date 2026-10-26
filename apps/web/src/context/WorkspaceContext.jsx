import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";
import { dispatchWorkspaceUpdate } from "./useWorkspaceUpdates";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");


export const ROLES = {
  ADMIN: "ADMIN",
  SALES: "SALES",
  WAREHOUSE: "WAREHOUSE",
  ACCOUNTS: "ACCOUNTS",
};



export const ROLE_LABELS = {
  [ROLES.ADMIN]: "Administrator",
  [ROLES.SALES]: "Sales",
  [ROLES.WAREHOUSE]: "Warehouse",
  [ROLES.ACCOUNTS]: "Accounts",
};

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const auth = useContext(AuthContext);
  const authenticatedUser = auth?.user;
  const authenticatedUserId = authenticatedUser?.id;
  const authenticatedRole = authenticatedUser?.role?.toUpperCase();
  const role = Object.values(ROLES).includes(authenticatedRole)
    ? authenticatedRole
    : null;
  const [leads, setLeads] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [expenses] = useState([]);
  const [messages] = useState([]);
  const [team] = useState([]);

  useEffect(() => {
    if (!authenticatedUserId || !API_BASE) return undefined;

    const socket = io(API_BASE, { withCredentials: true });
    socket.on("workspace_update", dispatchWorkspaceUpdate);
    return () => socket.disconnect();
  }, [authenticatedUserId]);

  const addLead = useCallback(
    (lead) => setLeads((current) => [lead, ...current]),
    [],
  );
  const addProduct = useCallback(
    (product) => setProducts((current) => [product, ...current]),
    [],
  );
  const addRequest = useCallback(
    (request) => setRequests((current) => [request, ...current]),
    [],
  );
  const updateRequest = useCallback(
    (requestId, status) =>
      setRequests((current) =>
        current.map((request) =>
          request.id === requestId ? { ...request, status } : request,
        ),
      ),
    [],
  );
  const addOrder = useCallback(
    (order) => setOrders((current) => [order, ...current]),
    [],
  );
  const fulfillOrder = useCallback(
    (orderId) =>
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status: "Fulfilled" } : order,
        ),
      ),
    [],
  );
  const sendMessage = useCallback(() => {
    throw new Error("Team messaging is not connected to this workspace.");
  }, []);
  const authLogin = auth?.login;
  const login = useCallback(
    (nextUser, token) => authLogin(nextUser, token),
    [authLogin],
  );
  const user = useMemo(
    () =>
      authenticatedUser
        ? {
            ...authenticatedUser,
            name: authenticatedUser.name || authenticatedUser.userName || "Team member",
            role: role || "UNKNOWN",
            loggedIn: true,
          }
        : { name: "Team member", role: role || "UNKNOWN", loggedIn: false },
    [authenticatedUser, role],
  );

  const value = useMemo(
    () => ({
      user,
      role,
      leads,
      orders,
      products,
      requests,
      expenses,
      messages,
      team,
      addLead,
      addProduct,
      addRequest,
      updateRequest,
      addOrder,
      fulfillOrder,
      sendMessage,
      login,
      signOut: auth?.logout,
    }),
    [
      user,
      role,
      leads,
      orders,
      products,
      requests,
      expenses,
      messages,
      team,
      addLead,
      addProduct,
      addRequest,
      updateRequest,
      addOrder,
      fulfillOrder,
      sendMessage,
      login,
      auth?.logout,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useAuth must be used within WorkspaceProvider.");
  }
  return context;
}
