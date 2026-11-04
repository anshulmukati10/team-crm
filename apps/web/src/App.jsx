import { Navigate, Route, Routes } from "react-router";
import CompanyLayout from "./components/CompanyLayout";
import Layout from "./components/Layout";
import { ROLES, useAuth } from "./context/WorkspaceContext";
import CompanyAuth from "./features/company/CompanyAuth";
import CompanyBilling from "./features/company/CompanyBilling";
import CompanyDashboard from "./features/company/CompanyDashboard";
import CompanyOrders from "./features/company/CompanyOrders";
import CompanyPayments from "./features/company/CompanyPayments";
import CompanyTeam from "./features/company/CompanyTeam";
import CompanyWallet from "./features/company/CompanyWallet";
import ManageRequests from "./features/admin/manageRequest";
import UserManagement from "./features/admin/userManagment";
import Lead from "./features/sales/Lead";
import SaleOrder from "./features/sales/SaleOrder";
import ImportInventory from "./features/warehouse/ImportInventory";
import ImportRequest from "./features/warehouse/ImportRequest";
import Account from "./screens/Account";
import Auth from "./screens/Auth";
import ChatScreen from "./screens/Chat";
import Dashboard from "./screens/Dashboard";
import Home from "./screens/Home";
import MeetingLobby from "./screens/meetingLobby";
import MeetingRoom from "./screens/meetingRoom";
import Profile from "./screens/Profile";

function RequestRoute() {
  const { role } = useAuth();
  if (role === ROLES.ADMIN) return <ManageRequests />;
  if (role === ROLES.WAREHOUSE) return <ImportRequest />;
  return <Navigate replace to="/" />;
}

function RoleRoute({ roles, children }) {
  const { role } = useAuth();
  return roles.includes(role) ? children : <Navigate to="/" replace />;
}

function MeetingRoomRoute() {
  const { user } = useAuth();
  return user.loggedIn ? <MeetingRoom /> : <Navigate replace to="/signin" />;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="home" element={<Home />} />
        <Route path="meetings" element={<MeetingLobby />} />
        <Route
          path="leads"
          element={
            <RoleRoute roles={[ROLES.ADMIN, ROLES.SALES, ROLES.ACCOUNTS]}>
              <Lead />
            </RoleRoute>
          }
        />
        <Route path="orders" element={<SaleOrder />} />
        <Route
          path="inventory"
          element={
            <RoleRoute roles={[ROLES.ADMIN, ROLES.WAREHOUSE]}>
              <ImportInventory />
            </RoleRoute>
          }
        />
        <Route path="requests" element={<RequestRoute />} />
        <Route
          path="accounts"
          element={
            <RoleRoute roles={[ROLES.ADMIN, ROLES.ACCOUNTS]}>
              <Account />
            </RoleRoute>
          }
        />
        <Route path="chat" element={<ChatScreen />} />
        <Route
          path="team"
          element={
            <RoleRoute roles={[ROLES.ADMIN]}>
              <UserManagement />
            </RoleRoute>
          }
        />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="/meetings/:meetingId" element={<MeetingRoomRoute />} />
      <Route
        path="/company/signin"
        element={<CompanyAuth mode="signin" />}
      />
      <Route
        path="/company/signup"
        element={<CompanyAuth mode="signup" />}
      />
      <Route path="/company" element={<CompanyLayout />}>
        <Route index element={<CompanyDashboard />} />
        <Route path="dashboard" element={<CompanyDashboard />} />
        <Route path="team" element={<CompanyTeam />} />
        <Route path="orders" element={<CompanyOrders />} />
        <Route path="wallet" element={<CompanyWallet />} />
        <Route path="payments" element={<CompanyPayments />} />
        <Route path="stripe/return" element={<CompanyPayments />} />
        <Route path="stripe/refresh" element={<CompanyPayments />} />
        <Route path="subscription" element={<CompanyBilling />} />
      </Route>
      <Route path="/signin" element={<Auth mode="signin" />} />
      <Route path="/signup" element={<Auth mode="signup" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
