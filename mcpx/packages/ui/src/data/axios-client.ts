import axios from "axios";

const API_SERVER_URL =
  import.meta.env.VITE_API_SERVER_URL || "http://127.0.0.1:9001";

export const axiosClient = axios.create({
  baseURL: API_SERVER_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
