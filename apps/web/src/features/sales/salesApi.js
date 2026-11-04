
import axios from "axios";

axios.defaults.withCredentials = true;

const API_BASE = import.meta.env.VITE_API_URL;
const baseUrl = `${API_BASE}/sales`;


export const createSalesOrder = async (order, idempotencyKey) => {
    try {
        const response = await axios.post(
            `${baseUrl}/create-order`,
            order,
            { headers: { "Idempotency-Key": idempotencyKey } }
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to create this order.";
    }
};

export const getOrderPaymentIntent = async (orderId) => {
    try {
        const response = await axios.post(`${baseUrl}/orders/${orderId}/payment`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to load order payment.";
    }
};

export const confirmOrderPayment = async (orderId) => {
    try {
        const response = await axios.post(
            `${baseUrl}/orders/${orderId}/confirm-payment`,
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to confirm order payment.";
    }
};


export const getSalesLeads = async () => {
    try {
        const response = await axios.get(`${baseUrl}/leads`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to load leads.";
    }
};


export const getSalesOrders = async () => {
    try {
        const response = await axios.get(`${baseUrl}/orders`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to load orders.";
    }
};


export const updateLeadStatus = async (leadId, status) => {
    try {
        const response = await axios.put(
            `${baseUrl}/lead`,
            { status },
            { params: { id: leadId } },
        );
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Unable to update lead status.";
    }
};