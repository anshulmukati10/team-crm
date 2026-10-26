import axios from "axios"; import { ROLES } from "../../context/WorkspaceContext";

axios.defaults.withCredentials = true;

const API_BASE = import.meta.env.VITE_API_URL; 
const baseUrl =` ${API_BASE}`;

export const getDashboardData = async (role) => {
   try {
     if (!API_BASE) {
       throw new Error("VITE_API_URL must be configured to load dashboard data."); 
      }

    if (!Object.values(ROLES).includes(role)) {
        throw new Error("Your account role is not supported for dashboard data.");
    }

    if (role === ROLES.SALES) {
        const [leadsResponse, ordersResponse] = await Promise.all([
            axios.get(`${baseUrl}/sales/leads`),
            axios.get(`${baseUrl}/sales/orders`)
        ]);

        return {
            leads: leadsResponse?.data,
            orders: ordersResponse?.data
        };
    }

    if (role === ROLES.ADMIN) {
        const [leadsResponse, ordersResponse, productsResponse, requestsResponse] = await Promise.all([
            axios.get(`${baseUrl}/admin/lead`),
            axios.get(`${baseUrl}/warehouse/get-order-list`),
            axios.get(`${baseUrl}/warehouse/get-stock-data`),
            axios.get(`${baseUrl}/admin/get-request`)
        ]);

        return {
            leads: leadsResponse?.data,
            orders: ordersResponse?.data,
            products: productsResponse?.data,
            requests: requestsResponse?.data
        };
    }

    if (role === ROLES.WAREHOUSE) {
        const [ordersResponse, productsResponse, requestsResponse] = await Promise.all([
            axios.get(`${baseUrl}/warehouse/get-order-list`),
            axios.get(`${baseUrl}/warehouse/get-stock-data`),
            axios.get(`${baseUrl}/warehouse/get-req-list`)
        ]);

        return {
            orders: ordersResponse?.data,
            products: productsResponse?.data,
            requests: requestsResponse?.data
        };
    }

    if (role === ROLES.ACCOUNTS) {
        const response = await axios.get(`${baseUrl}/accounts/sales-list`);

        return {
            sales: response?.data
        };
    }

    throw new Error("No dashboard data source is configured for this role.");

} catch (error) {
    throw error?.response?.data?.message || error?.message || "Failed to fetch dashboard data";
}


};