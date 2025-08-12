import axios from "axios";
import { getWebServerURL } from "../config/api-config";

const API_SERVER_URL = getWebServerURL("http");

export const axiosClient = axios.create({
  baseURL: API_SERVER_URL,
  headers: {
    "Content-Type": "application/json",
  },
});
