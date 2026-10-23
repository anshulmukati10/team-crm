import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function getWarehouseApi() {
  if (!API_BASE) {
    throw new Error("VITE_API_URL must be configured to use warehouse features.");
  }
  return axios.create({
    baseURL: `${API_BASE}/warehouse`,
    withCredentials: true,
  });
}

function rethrowApiError(error, fallback) {
  throw new Error(
    error?.response?.data?.message || error?.message || fallback,
    { cause: error },
  );
}

export async function getWarehouseStock() {
  try {
    const response = await getWarehouseApi().get("/get-stock-data");
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to load inventory.");
  }
}

export async function getWarehouseOrders() {
  try {
    const response = await getWarehouseApi().get("/get-order-list");
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to load orders for fulfillment.");
  }
}

export async function exportWarehouseOrder(orderId) {
  try {
    const response = await getWarehouseApi().post(
      `/export-order/${encodeURIComponent(orderId)}`,
    );
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to fulfill this order.");
  }
}

export async function getWarehouseRequests() {
  try {
    const response = await getWarehouseApi().get("/get-req-list");
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to load stock requests.");
  }
}

export async function createWarehouseImportRequest(request) {
  try {
    const response = await getWarehouseApi().post("/import-stock", request);
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to submit the stock request.");
  }
}