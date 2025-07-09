/**
 * Better Auth QR Plugin
 * 
 * Guard rail fallback - use platform-specific imports instead.
 *
 * 📱 React Native/Mobile: import from "better-auth-qr-plugin/native"
 * 🌐 Web/Browser: import from "better-auth-qr-plugin/web"
 * 🖥️ Node.js Server: import from "better-auth-qr-plugin"
 */

// Server-side plugin (Better Auth integration)
export { qrAuth, type QRAuthConfig } from "./plugin/server.js";

// Shared types
export type { 
  QRToken, 
  QRCodeData,
  QRClientConfig,
  QRAuthStartOptions,
  APIResponse,
  QRAuthEvents, 
  QRAuthEventHandler 
} from "./types/index.js";

/**
 * @deprecated Use platform-specific imports instead:
 * - React Native: import { qrAuthClient } from "better-auth-qr-plugin/native" 
 * - Web: import { qrAuthClient } from "better-auth-qr-plugin/web"
 * 
 * This fallback export is provided for backwards compatibility but may
 * cause environment-specific issues. Prefer platform-specific imports.
 */
export function qrAuthClient() {
  throw new Error(`
🚫 Platform-specific import required!

Please use the appropriate import for your environment:

📱 React Native/Mobile:
   import { qrAuthClient } from "better-auth-qr-plugin/native"

🌐 Web/Browser: 
   import { qrAuthClient } from "better-auth-qr-plugin/web"

🖥️ Server (Better Auth):
   import { qrAuth } from "better-auth-qr-plugin"

This prevents Web Crypto API compatibility issues and provides 
optimized implementations for each platform.
  `);
}