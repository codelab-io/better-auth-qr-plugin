// Server-side plugin
export { qrAuth } from "./plugin/server.js";

// Client-side plugin
export { qrAuthClient } from "./plugin/client.js";
export type { QRCodeData, QRAuthStartOptions } from "./plugin/client.js";

// Types
export type { QRToken, QRAuthConfig, QRAuthEvents, QRAuthEventHandler } from "./types/index.js";