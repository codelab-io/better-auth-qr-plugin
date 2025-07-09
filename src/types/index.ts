/**
 * QR Token database model
 */
export interface QRToken {
  id: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  isUsed: boolean;
  userId?: string;
  verifiedAt?: Date;
  sessionCreationToken?: string;
  sessionCreationTokenExpiresAt?: Date;
}

/**
 * QR code data structure
 */
export interface QRCodeData {
  tokenId: string;
  token: string;
  serverUrl: string;
}

/**
 * Server plugin configuration
 */
export interface QRAuthConfig {
  tokenExpirationMinutes?: number;
  qrCodeSize?: number;
  endpoints?: {
    generateToken?: string;
    verifyToken?: string;
    pollStatus?: string;
    claimSession?: string;
  };
}

/**
 * Client plugin configuration
 */
export interface QRClientConfig {
  headers?: Record<string, string>;
  timeout?: number;
  pollInterval?: number;
  endpoints?: {
    generateToken?: string;
    verifyToken?: string;
    pollStatus?: string;
    claimSession?: string;
  };
}

/**
 * QR auth start options for client
 */
export interface QRAuthStartOptions {
  pollInterval?: number;
  onQRGenerated?: (qrCode: string, tokenId: string) => void;
  onSuccess?: (sessionData: any) => void;
  onError?: (error: string) => void;
}

/**
 * Standard API response structure
 */
export interface APIResponse<T = any> {
  data: T | null;
  error: string | null;
}

/**
 * Events that can be emitted during QR auth flow
 */
export interface QRAuthEvents {
  'token:generated': { tokenId: string; qrCode: string };
  'token:verified': { tokenId: string; userId: string };
  'session:claimed': { tokenId: string; userId: string; sessionToken: string };
  'token:expired': { tokenId: string };
}

export type QRAuthEventHandler<T extends keyof QRAuthEvents> = (data: QRAuthEvents[T]) => void;