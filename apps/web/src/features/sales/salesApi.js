import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function getSalesApi() {
  if (!API_BASE) {
    throw new Error("VITE_API_URL must be configured to use sales features.");
  }
  return axios.create({
    baseURL: `${API_BASE}/sales`,
    withCredentials: true,
  });
}

export async function createSalesOrder(order) {
  try {
    const response = await getSalesApi().post("/create-order", order);
    return response.data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || error?.message || "Unable to create this order.",
      { cause: error },
    );
  }
}

export async function getSalesLeads() {
  try {
    const response = await getSalesApi().get("/leads");
    if (!Array.isArray(response.data)) {
      throw new Error("The API returned invalid lead data.");
    }
    return response.data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || error?.message || "Unable to load leads.",
      { cause: error },
    );
  }
}

export async function getSalesOrders() {
  try {
    const response = await getSalesApi().get("/orders");
    if (!Array.isArray(response.data)) {
      throw new Error("The API returned invalid order data.");
    }
    return response.data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message || error?.message || "Unable to load orders.",
      { cause: error },
    );
  }
}
