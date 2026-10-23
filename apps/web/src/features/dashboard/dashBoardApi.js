import axios from "axios";
import { ROLES } from "../../context/WorkspaceContext";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function getApi() {
  if (!API_BASE) {
    throw new Error("VITE_API_URL must be configured to load dashboard data.");
  }
  return axios.create({
    baseURL: API_BASE,
    withCredentials: true,
  });
}

async function getArray(api, path, label) {
  const response = await api.get(path);
  if (!Array.isArray(response.data)) {
    throw new Error(`The API returned invalid ${label} data.`);
  }
  return response.data;
}

export async function getDashboardData(role) {
  if (!Object.values(ROLES).includes(role)) {
    throw new Error("Your account role is not supported for dashboard data.");
  }

  const api = getApi();
  if (role === ROLES.SALES) {
    const [leads, orders] = await Promise.all([
      getArray(api, "/sales/leads", "lead"),
      getArray(api, "/sales/orders", "order"),
    ]);
    return { leads, orders };
  }

  if (role === ROLES.ADMIN) {
    const [leads, orders, products, requests] = await Promise.all([
      getArray(api, "/admin/lead", "lead"),
      getArray(api, "/warehouse/get-order-list", "order"),
      getArray(api, "/warehouse/get-stock-data", "inventory"),
      getArray(api, "/admin/get-request", "request"),
    ]);
    return { leads, orders, products, requests };
  }

  if (role === ROLES.WAREHOUSE) {
    const [orders, products, requests] = await Promise.all([
      getArray(api, "/warehouse/get-order-list", "order"),
      getArray(api, "/warehouse/get-stock-data", "inventory"),
      getArray(api, "/warehouse/get-req-list", "request"),
    ]);
    return { orders, products, requests };
  }

  if (role === ROLES.ACCOUNTS) {
    const sales = await getArray(api, "/accounts/sales-list", "sales");
    return { sales };
  }

  throw new Error("No dashboard data source is configured for this role.");
}
