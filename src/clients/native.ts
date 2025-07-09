/**
 * Better Auth QR Client Plugin - React Native/Mobile
 * 
 * Optimized for React Native environments to avoid Web Crypto API issues.
 * Provides both QR code generation and scanning functionality.
 */

import type { BetterAuthClientPlugin } from "better-auth/client";
import type { BetterFetchOption } from "@better-fetch/fetch";
import type { qrAuth } from "../plugin/server.js";
import type { 
  QRCodeData, 
  QRAuthStartOptions, 
  QRClientConfig 
} from "../types/index.js";

/**
 * Better Auth QR client plugin for React Native
 * Provides unified interface for both QR generation and scanning
 */
export const qrAuthClient = (config?: QRClientConfig) => {
  const defaultEndpoints = {
    generateToken: "/qr/generate",
    verifyToken: "/qr/verify", 
    pollStatus: "/qr/status",
    claimSession: "/qr/claim-session",
    ...config?.endpoints
  };

  return {
    id: "qr-auth",
    $InferServerPlugin: {} as ReturnType<typeof qrAuth>,
    
    pathMethods: {
      [defaultEndpoints.generateToken]: "POST",
      [defaultEndpoints.verifyToken]: "POST",
      [defaultEndpoints.pollStatus]: "GET",
      [defaultEndpoints.claimSession]: "POST",
    },
    
    getActions: ($fetch: any, ctx: any) => ({
      qrAuth: {
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
            
            // Handle both direct response and wrapped response formats
            const responseData = qrResponse.data || qrResponse;
            
            if (!responseData || (!responseData.tokenId && !responseData.data)) {
              throw new Error(qrResponse.error || responseData?.error || "Failed to generate QR code");
            }
            
            // Extract data from nested structure if needed
            const actualData = responseData.data || responseData;
            const { tokenId, qrCode, expiresAt } = actualData;
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
                
                // Handle both direct response and nested .data response
                const responseData = statusResponse.data || statusResponse;
                
                if (responseData?.status === "completed" && responseData?.sessionCreationToken) {
                  clearInterval(pollInterval);
                  
                  try {
                    // Step 2: Claim the session with the sessionCreationToken
                    const claimResponse = await $fetch(defaultEndpoints.claimSession, {
                      method: "POST",
                      body: JSON.stringify({
                        sessionCreationToken: responseData.sessionCreationToken
                      }),
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Client-Type': 'react-native',
                        ...(config?.headers || {}),
                        ...(fetchOptions?.headers || {})
                      },
                      ...fetchOptions
                    });
                    
                    if (claimResponse.error) {
                      options?.onError?.(claimResponse.error);
                    } else {
                      options?.onSuccess?.(claimResponse.data || claimResponse);
                    }
                  } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Failed to claim session";
                    options?.onError?.(errorMessage);
                  }
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
         * Parse QR code data from scanned string (base64 encoded like WhatsApp)
         */
        parseQRCode: (qrCodeValue: string) => {
          try {
            // Parse JSON directly
            const parsed = JSON.parse(qrCodeValue);
            
            if (!parsed.tokenId || !parsed.token || !parsed.serverUrl) {
              throw new Error('Invalid QR code data structure');
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
              body: JSON.stringify(data),
              headers: {
                'Content-Type': 'application/json',
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
            // Parse the QR code string first
            const parseResult = (() => {
              try {
                const parsed = JSON.parse(qrCodeValue);
                if (!parsed.tokenId || !parsed.token) {
                  throw new Error('Invalid QR code data structure');
                }
                return { data: parsed as QRCodeData, error: null };
              } catch (error) {
                return {
                  data: null,
                  error: error instanceof Error ? error.message : 'Failed to parse QR code data'
                };
              }
            })();
            
            if (parseResult.error || !parseResult.data) {
              return {
                data: null,
                error: parseResult.error || 'Failed to parse QR code'
              };
            }
            
            const { tokenId, token } = parseResult.data;
            
            const headers = {
              'Content-Type': 'application/json',
              'X-Client-Type': 'react-native',
              ...(config?.headers || {}),
              ...(fetchOptions?.headers || {})
            };
            const bodyString = JSON.stringify({ tokenId, token });
            const requestOptions = {
              method: "POST",
              body: bodyString,
              headers
            };
            const result = await $fetch(defaultEndpoints.verifyToken, requestOptions);
            
            return {
              data: result.data || null,
              error: result.error || null
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
        },
        
        /**
         * Claim session using sessionCreationToken (second step of secure flow)
         */
        claimSession: async (
          sessionCreationToken: string,
          fetchOptions?: BetterFetchOption
        ) => {
          try {
            const response = await $fetch(defaultEndpoints.claimSession, {
              method: "POST",
              body: JSON.stringify({
                sessionCreationToken
              }),
              headers: {
                'Content-Type': 'application/json',
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
              error: error instanceof Error ? error.message : "Session claim failed"
            };
          }
        }
      }
    })
  } satisfies BetterAuthClientPlugin;
};