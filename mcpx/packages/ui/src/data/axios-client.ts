import axios from "axios";
import { getMcpxServerURL } from "../config/api-config";
import { isEnterpriseEnabled } from "@/config/runtime-config";

const API_SERVER_URL = getMcpxServerURL("http");

export const axiosClient = axios.create({
  baseURL: API_SERVER_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use((config) => {
  // Re-evaluate enterprise flag for every request so runtime config changes apply
  config.withCredentials = isEnterpriseEnabled();
  return config;
});
