import axios from 'axios'
axios.defaults.withCredentials = true;
const API_BASE = import.meta.env.VITE_API_URL ;

const baseUrl = `${API_BASE}/auth/login`;

export const loginUser = async (credentials) => {
    try 
    {
        const response = await axios.post(baseUrl, credentials)
        return response?.data
    }catch(error)
    {
        throw error?.response?.data?.message || "Login Failed "
    }
}

export const registerUser = async (userData) => {
    try
    {
        const response = await axios.post(`${API_BASE}/auth/register`, userData)
        return response?.data
    }catch(error)
    {
        throw error?.response?.data?.message || "Registration Failed"
    }       
}

export const logoutUser = async () => {
    try
    {
        const response = await axios.post(`${API_BASE}/auth/logout`)
        return response?.data
    }catch(error)
    {
        throw error?.response?.data?.message || "Logout Failed"
    }   
}

export const getUserProfile = async () => {
    try {
        const response = await axios.get(`${API_BASE}/auth/profile`)
        return response?.data
    } catch (error) {
        throw error?.response?.data?.message || "Failed to fetch user profile"
    }
}

export const updateUserProfile = async (profileData) => {
    try {
        const response = await axios.put(`${API_BASE}/auth/profile`, profileData)   
        return response?.data
    } catch (error) {
        throw error?.response?.data?.message || "Failed to update user profile"
    }   
}