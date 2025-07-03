import type { BetterAuthClientPlugin } from "better-auth/client";
import type { BetterFetchOption } from "@better-fetch/fetch";
import type { qrAuth } from "./server.js";

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

export const qrAuthClient = (config?: {
  endpoints?: {
    generateToken?: string;
    verifyToken?: string;
    pollStatus?: string;
  };
}) => {
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
    
    getActions: ($fetch: any) => {
      const actions = {
        // Start QR authentication flow for web clients
        startQRAuth: async (
          options?: QRAuthStartOptions,
          fetchOptions?: BetterFetchOption
        ) => {
          try {
            // Generate QR code
            const qrResponse = await $fetch(defaultEndpoints.generateToken, {
              method: "POST",
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
            }, options?.pollInterval || 2000);
            
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
        
        // Parse QR code data for mobile clients
        parseQRCode: (qrCodeData: string) => {
          try {
            const parsed = JSON.parse(qrCodeData);
            
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
        
        // Verify QR scan from mobile clients
        verifyQRScan: async (
          data: { tokenId: string; token: string },
          fetchOptions?: BetterFetchOption
        ) => {
          try {
            const response = await $fetch(defaultEndpoints.verifyToken, {
              method: "POST",
              body: data,
              ...fetchOptions
            });
            
            return {
              data: response.data || null,
              error: response.error || null
            };
          } catch (error) {
            return {
              data: null,
              error: error instanceof Error ? error.message : "Verification failed"
            };
          }
        },
        
        // Handle complete QR scan flow for mobile
        handleQRCodeScan: async (
          qrCodeValue: string,
          fetchOptions?: BetterFetchOption
        ) => {
          // Parse QR code
          const parseResult = actions.parseQRCode(qrCodeValue);
          if (parseResult.error) {
            return parseResult;
          }
          
          // Verify with server
          return await actions.verifyQRScan(parseResult.data!, fetchOptions);
        },
        
        // Poll status manually (useful for custom polling logic)
        pollStatus: async (
          tokenId: string,
          fetchOptions?: BetterFetchOption
        ) => {
          try {
            const response = await $fetch(defaultEndpoints.pollStatus, {
              method: "GET",
              query: { tokenId },
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
      };
      
      return actions;
    }
  } satisfies BetterAuthClientPlugin;
};