
import axios from "axios";
import {
    createChat,
    getAllUsers,
    removeMember,
} from "../chat/chatApi";

axios.defaults.withCredentials = true;

const API_BASE = import.meta.env.VITE_API_URL;
const baseUrl = `${API_BASE}/admin`;


export const getAdminRequests = async () => {
    try {
        const response = await axios.get(`${baseUrl}/get-request`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to load requests.";
    }
};


export const getAdminBalance = async () => {
    try {
        const response = await axios.get(`${baseUrl}/balance`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to load the admin wallet balance.";
    }
};


export const getAdminLeads = async () => {
    try {
        const response = await axios.get(`${baseUrl}/lead`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to load leads.";
    }
};

export const processAdminRequest = async (requestId) => {
    try {
        const response = await axios.post(
            `${baseUrl}/handle-request`,
            null,
            {
                params: { reqId: requestId },
            }
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to process this request.";
    }
};


export const createAdminProduct = async (product) => {
    try {
        const response = await axios.post(
            `${baseUrl}/product/create-product`,
            product
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to create this product.";
    }
};

export const createAdminLead = async (lead) => {
    try {
        const response = await axios.post(
            `${baseUrl}/lead/create-lead`,
            lead
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to create this lead.";
    }
};


export const creditAdminWallet = async (amount) => {
    try {
        const response = await axios.post(
            `${baseUrl}/credit-amount`,
            { amount }
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to add funds to the admin wallet.";
    }
};


export const getAdminUsers = async () => {
    try {
        const response = await getAllUsers();
        return response;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to load team members.";
    }
};


export const deleteAdminUser = async (userId) => {
    try {
        const response = await axios.delete(
            `${API_BASE}/auth/delete-user`,
            {
                params: { id: userId },
            }
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to remove this user.";
    }
};


export const createAdminRoom = async (groupName, memberIds) => {
    try {
        const response = await createChat({
            groupName,
            memberIds,
        });
        return response;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to create this room.";
    }
};


export const removeAdminRoomMember = async (roomId, memberId) => {
    try {
        const response = await removeMember({
            roomId,
            memberId,
        });
        return response;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to remove this member.";
    }
};
