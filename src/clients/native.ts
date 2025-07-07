/**
 * Better Auth QR Client Plugin - React Native/Mobile
 * 
 * Optimized for React Native environments to avoid Web Crypto API issues.
 * Provides both QR code generation and scanning functionality.
 */

import type { BetterAuthClientPlugin } from "better-auth/client";
import type { BetterFetchOption } from "@better-fetch/fetch";
import type { qrAuth } from "../plugin/server.js";

export interface QRCodeData {
  tokenId: string;
  token: string;
  serverUrl: string;
}

export interface QRAuthStartOptions {
  pollInterval?: number;
  onQRGenerated?: (qrCode: string, tokenId: string) => void;
  onSuccess?: (sessionData: any) => void;
  onError?: (error: string) => void;
}

export interface QRClientConfig {
  /**
   * Custom headers to include with requests
   */
  headers?: Record<string, string>;
  
  /**
   * Request timeout in milliseconds
   * @default 10000
   */
  timeout?: number;
  
  /**
   * Polling interval in milliseconds for QR status
   * @default 2000
   */
  pollInterval?: number;
  
  /**
   * Custom endpoint paths
   */
  endpoints?: {
    generateToken?: string;
    verifyToken?: string;
    pollStatus?: string;
  };
}

/**
 * Better Auth QR client plugin for React Native
 * Provides unified interface for both QR generation and scanning
 */
export const qrAuthClient = (config?: QRClientConfig) => {
  const defaultEndpoints = {
    generateToken: "/qr/generate",
    verifyToken: "/qr/verify", 
    pollStatus: "/qr/status",
    ...config?.endpoints
  };

  return {
    id: "qr-auth",
    $InferServerPlugin: {} as ReturnType<typeof qrAuth>,
    
    pathMethods: {
      [defaultEndpoints.generateToken]: "POST",
      [defaultEndpoints.verifyToken]: "POST",
      [defaultEndpoints.pollStatus]: "GET",
    },
    
    getActions: ($fetch: any) => ({
      /**
       * Start QR authentication flow (for displaying QR codes)
       */
      startQRAuth: async (
        options?: QRAuthStartOptions,
        fetchOptions?: BetterFetchOption
      ) => {
        try {
          // Generate QR code
          const qrResponse = await $fetch(defaultEndpoints.generateToken, {
            method: "POST",
            headers: {
              'X-Client-Type': 'react-native',
              ...(config?.headers || {}),
              ...(fetchOptions?.headers || {})
            },
            ...fetchOptions
          });
          
          if (!qrResponse.data) {
            throw new Error(qrResponse.error || "Failed to generate QR code");
          }
          
          const { tokenId, qrCode, expiresAt } = qrResponse.data;
          options?.onQRGenerated?.(qrCode, tokenId);
          
          // Start polling for status
          const pollInterval = setInterval(async () => {
            try {
              const statusResponse = await $fetch(defaultEndpoints.pollStatus, {
                method: "GET",
                query: { tokenId },
                headers: {
                  'X-Client-Type': 'react-native',
                  ...(config?.headers || {}),
                  ...(fetchOptions?.headers || {})
                },
                ...fetchOptions
              });
              
              if (statusResponse.data?.status === "completed") {
                clearInterval(pollInterval);
                options?.onSuccess?.(statusResponse.data);
              }
            } catch (error) {
              clearInterval(pollInterval);
              const errorMessage = error instanceof Error ? error.message : "Polling failed";
              options?.onError?.(errorMessage);
            }
          }, options?.pollInterval || config?.pollInterval || 2000);
          
          // Set up expiration cleanup
          const expirationTime = new Date(expiresAt).getTime() - Date.now();
          const expirationTimeout = setTimeout(() => {
            clearInterval(pollInterval);
            options?.onError?.("QR code has expired");
          }, expirationTime);
          
          return {
            data: { tokenId, qrCode, expiresAt },
            cleanup: () => {
              clearInterval(pollInterval);
              clearTimeout(expirationTimeout);
            },
            error: null
          };
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "QR auth failed";
          return {
            data: null,
            error: errorMessage,
            cleanup: () => {}
          };
        }
      },

      /**
       * Parse QR code data from scanned string
       */
      parseQRCode: (qrCodeValue: string) => {
        try {
          const parsed = JSON.parse(qrCodeValue);
          
          if (!parsed.tokenId || !parsed.token || !parsed.serverUrl) {
            throw new Error('Invalid QR code format');
          }

          return {
            data: parsed as QRCodeData,
            error: null
          };
        } catch (error) {
          return {
            data: null,
            error: error instanceof Error ? error.message : 'Failed to parse QR code data'
          };
        }
      },

      /**
       * Verify QR scan with the server
       */
      verifyQRScan: async (
        data: { tokenId: string; token: string },
        fetchOptions?: BetterFetchOption
      ) => {
        try {
          const requestOptions: any = {
            method: "POST",
            body: data,
            headers: {
              'Content-Type': 'application/json',
              'X-Mobile-Client': 'true',
              'X-Client-Type': 'react-native',
              ...(config?.headers || {}),
              ...(fetchOptions?.headers || {})
            },
            ...fetchOptions
          };

          const response = await $fetch(defaultEndpoints.verifyToken, requestOptions);
          
          return {
            data: response.data || null,
            error: response.error || null
          };
        } catch (error) {
          let errorMessage = "Verification failed";
          
          if (error instanceof Error) {
            if (error.message.includes('timeout')) {
              errorMessage = "Request timeout. Please try again.";
            } else if (error.message.includes('fetch') || error.message.includes('network')) {
              errorMessage = "Network error. Please check your internet connection.";
            } else {
              errorMessage = error.message;
            }
          }
          
          return {
            data: null,
            error: errorMessage
          };
        }
      },

      /**
       * Handle complete QR scan flow for mobile
       */
      handleQRCodeScan: async (
        qrCodeValue: string,
        fetchOptions?: BetterFetchOption
      ) => {
        try {
          // Parse QR code
          const parsed = JSON.parse(qrCodeValue);
          
          if (!parsed.tokenId || !parsed.token || !parsed.serverUrl) {
            return {
              data: null,
              error: 'Invalid QR code format. Missing required fields.'
            };
          }

          // Verify with server
          const requestOptions: any = {
            method: "POST",
            body: { tokenId: parsed.tokenId, token: parsed.token },
            headers: {
              'Content-Type': 'application/json',
              'X-Mobile-Client': 'true',
              'X-Client-Type': 'react-native',
              ...(config?.headers || {}),
              ...(fetchOptions?.headers || {})
            },
            ...fetchOptions
          };

          const response = await $fetch(defaultEndpoints.verifyToken, requestOptions);
          
          return {
            data: response.data || null,
            error: response.error || null
          };
        } catch (error) {
          let errorMessage = "QR scan failed";
          
          if (error instanceof Error) {
            if (error.message.includes('timeout')) {
              errorMessage = "Request timeout. Please try again.";
            } else if (error.message.includes('fetch') || error.message.includes('network')) {
              errorMessage = "Network error. Please check your internet connection.";
            } else if (error.message.includes('JSON')) {
              errorMessage = "Invalid QR code format.";
            } else {
              errorMessage = error.message;
            }
          }
          
          return {
            data: null,
            error: errorMessage
          };
        }
      },

      /**
       * Poll status manually (useful for custom polling logic)
       */
      pollStatus: async (
        tokenId: string,
        fetchOptions?: BetterFetchOption
      ) => {
        try {
          const response = await $fetch(defaultEndpoints.pollStatus, {
            method: "GET",
            query: { tokenId },
            headers: {
              'X-Client-Type': 'react-native',
              ...(config?.headers || {}),
              ...(fetchOptions?.headers || {})
            },
            ...fetchOptions
          });
          
          return {
            data: response.data || null,
            error: response.error || null
          };
        } catch (error) {
          return {
            data: null,
            error: error instanceof Error ? error.message : "Status polling failed"
          };
        }
      }
    })
  } satisfies BetterAuthClientPlugin;
};