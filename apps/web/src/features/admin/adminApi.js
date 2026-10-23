import axios from "axios";
import {
  createChat,
  getAllUsers,
  removeMember,
} from "../chat/chatApi";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

function ensureApiBase() {
  if (!API_BASE) {
    throw new Error("VITE_API_URL must be configured to use admin features.");
  }
}

function getAdminApi() {
  ensureApiBase();
  return axios.create({
    baseURL: `${API_BASE}/admin`,
    withCredentials: true,
  });
}

function getErrorMessage(error, fallback) {
  return (
    (typeof error === "string" ? error : null) ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function rethrowApiError(error, fallback) {
  throw new Error(getErrorMessage(error, fallback), { cause: error });
}

export async function getAdminRequests() {
  try {
    const response = await getAdminApi().get("/get-request");
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to load requests.");
  }
}

export async function getAdminBalance() {
  try {
    const response = await getAdminApi().get("/balance");
    if (!Number.isFinite(Number(response.data?.balance))) {
      throw new Error("The API response does not contain a valid wallet balance.");
    }
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to load the admin wallet balance.");
  }
}

export async function getAdminLeads() {
  try {
    const response = await getAdminApi().get("/lead");
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to load leads.");
  }
}

export async function processAdminRequest(requestId) {
  try {
    const response = await getAdminApi().post("/handle-request", null, {
      params: { reqId: requestId },
    });
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to process this request.");
  }
}

export async function createAdminProduct(product) {
  try {
    const response = await getAdminApi().post("/product/create-product", product);
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to create this product.");
  }
}

export async function createAdminLead(lead) {
  try {
    const response = await getAdminApi().post("/lead/create-lead", lead);
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to create this lead.");
  }
}

export async function creditAdminWallet(amount) {
  try {
    if (!Number.isInteger(amount) || amount < 1) {
      throw new Error("Wallet funding must be a positive whole number.");
    }
    const response = await getAdminApi().post("/credit-amount", { amount });
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to add funds to the admin wallet.");
  }
}

export async function getAdminUsers() {
  try {
    ensureApiBase();
    return await getAllUsers();
  } catch (error) {
    rethrowApiError(error, "Unable to load team members.");
  }
}

export async function deleteAdminUser(userId) {
  try {
    ensureApiBase();
    const response = await axios.delete(`${API_BASE}/auth/delete-user`, {
      params: { id: userId },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    rethrowApiError(error, "Unable to remove this user.");
  }
}

export async function createAdminRoom(groupName, memberIds) {
  try {
    ensureApiBase();
    return await createChat({
      groupName,
      memberIds,
    });
  } catch (error) {
    rethrowApiError(error, "Unable to create this room.");
  }
}

export async function removeAdminRoomMember(roomId, memberId) {
  try {
    ensureApiBase();
    return await removeMember({ roomId, memberId });
  } catch (error) {
    rethrowApiError(error, "Unable to remove this member.");
  }
}
