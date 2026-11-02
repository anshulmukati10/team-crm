import { io } from "socket.io-client";

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, "");

export const meetingSocket = io(API_BASE, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
});