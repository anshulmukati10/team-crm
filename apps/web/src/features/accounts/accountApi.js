import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function getAccountApi() {
  if (!API_BASE) {
    throw new Error("VITE_API_URL must be configured to load account data.");
  }
  return axios.create({
    baseURL: `${API_BASE}/accounts`,
    withCredentials: true,
  });
}

export async function getAccountSales() {
  try {
    const response = await getAccountApi().get("/sales-list");
    if (!Array.isArray(response.data)) {
      throw new Error("The API returned invalid sales data.");
    }
    return response.data;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message ||
        error?.message ||
        "Unable to load sales data.",
      { cause: error },
    );
  }
}

export async function getAccountBalance() {
  try {
    const response = await getAccountApi().get("/get-balance");
    const balance = Number(response.data?.balance);
    if (!Number.isFinite(balance)) {
      throw new Error("The API returned an invalid account balance.");
    }
    return balance;
  } catch (error) {
    throw new Error(
      error?.response?.data?.message ||
        error?.message ||
        "Unable to load account balance.",
      { cause: error },
    );
  }
}
