import axios from "axios";
import { getMcpxServerURL } from "../config/api-config";

const API_SERVER_URL = getMcpxServerURL("http");

export const axiosClient = axios.create({
  baseURL: API_SERVER_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
