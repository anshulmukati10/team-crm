import axios from 'axios'
axios.defaults.withCredentials = true;

const API_BASE = import.meta.env.VITE_API_URL;

export const createChat = async (data) => {
    try {
        const response = await axios.post(`${API_BASE}/admin/room`, data)
        return response?.data
    }
    catch (error) {
        throw error?.response?.data?.message || "Failed to create chat"
    }
}


export const removeMember = async ({ roomId, memberId }) => {
    try {
        const response = await axios.delete(`${API_BASE}/admin/room`, {
            params: { roomId, memberId }
        });
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Failed to remove member";
    }
}


export const getMessages = async (roomId) => {
    try {
        const response = await axios.get(`${API_BASE}/auth/chat/${roomId}/messages`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Failed to fetch messages";
    }
}

export const getAllUsers = async () => {
    try {
        const response = await axios.get(`${API_BASE}/admin/get-all-user`);
        return response?.data;
    } catch (error) {
        throw error?.response?.data?.message || "Failed to fetch users";
    }
}


export const getRooms = async() =>
{
    try 
    {
        const rooms = await axios.get(`${API_BASE}/auth/get-rooms`)
        return rooms.data ;
    }
    catch(error)
    {
        throw error?.response?.data?.message || "Failed to fetch rooms";

    }
}