import axios from "axios";
import { getStoredToken } from "./member";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/market";

export const getAllMarkets = async () => {
    // getStoredToken handles localStorage if needed
    const token = getStoredToken(localStorage?.getItem?.("token"));

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await axios.get(`${API_BASE}/all`, {
        headers,
    });

    return res.data;
};