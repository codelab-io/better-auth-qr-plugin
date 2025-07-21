import type { BetterAuthPlugin } from "better-auth/plugins";
import { createAuthEndpoint } from "better-auth/api";
import { sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";

/**
 * Configuration schema for QR Authentication plugin
 */
const qrAuthConfigSchema = z.object({
  /**
   * Token expiration time in minutes
   * @default 5
   */
  tokenExpirationMinutes: z.number().min(1).max(60).default(5),
  /**
   * QR code image size in pixels
   * @default 256
   */
  qrCodeSize: z.number().min(128).max(512).default(256),
  /**
   * Custom endpoint paths
   */
  endpoints: z.object({
    generateToken: z.string().default("/qr/generate"),
    verifyToken: z.string().default("/qr/verify"),
    pollStatus: z.string().default("/qr/status"),
    claimSession: z.string().default("/qr/claim-session"),
  }).default({}),
});

export type QRAuthConfig = z.infer<typeof qrAuthConfigSchema>;
type QRAuthConfigInput = z.input<typeof qrAuthConfigSchema>;

/**
 * Better Auth QR Authentication Plugin
 * 
 * Enables QR code-based authentication between web and mobile applications.
 * Provides secure two-step authentication flow with session token exchange.
 * 
 * @param config - Plugin configuration options
 * @returns BetterAuthPlugin instance
 */
export const qrAuth = (config?: QRAuthConfigInput): BetterAuthPlugin => {
  const parsedConfig = qrAuthConfigSchema.parse(config || {});
  
  return {
    id: "qr-auth",
    
    schema: {
      qrToken: {
        fields: {
          id: { type: "string", required: true },
          token: { type: "string", required: true },
          createdAt: { type: "date", required: true },
          expiresAt: { type: "date", required: true },
          isUsed: { type: "boolean", required: true },
          userId: { 
            type: "string", 
            required: false,
            references: {
              model: "user",
              field: "id"
            }
          },
          verifiedAt: { type: "date", required: false },
          sessionCreationToken: { type: "string", required: false },
          sessionCreationTokenExpiresAt: { type: "date", required: false },
        },
        modelName: "qrToken"
      }
    },
    
    endpoints: {
      [parsedConfig.endpoints.generateToken]: createAuthEndpoint(
        parsedConfig.endpoints.generateToken,
        {
          method: "POST",
        },
        async (ctx) => {
          const tokenId = uuidv4();
          const token = uuidv4();
          const now = new Date();
          const expiresAt = new Date(now.getTime() + parsedConfig.tokenExpirationMinutes * 60 * 1000);
          
          // Store token in database
          await ctx.context.adapter.create({
            model: "qrToken",
            data: {
              id: tokenId,
              token,
              createdAt: now,
              expiresAt,
              isUsed: false,
            },
            forceAllowId: true,
          });
          
          // Create QR code data with JSON object
          const qrDataObject = {
            tokenId,
            token,
            serverUrl: ctx.context.baseURL,
          };
          
          const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrDataObject), {
            width: parsedConfig.qrCodeSize,
            margin: 2,
          });
          
          return ctx.json({
            success: true,
            data: {
              tokenId,
              qrCode: qrCodeDataUrl,
              expiresAt: expiresAt.toISOString(),
            },
          });
        }
      ),
      
      [parsedConfig.endpoints.verifyToken]: createAuthEndpoint(
        parsedConfig.endpoints.verifyToken,
        {
          method: "POST",
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const { tokenId, token } = ctx.body;
          
          if (!tokenId || !token) {
            return ctx.json({ error: "Token ID and token are required" }, { status: 400 });
          }
          
          // Get current session (mobile user)
          const session = ctx.context.session;
          if (!session || !session.user) {
            return ctx.json({ error: "No authenticated user" }, { status: 401 });
          }
          
          // Find QR token in database
          const qrToken = await ctx.context.adapter.findOne({
            model: "qrToken",
            where: [{
              field: "id",
              value: tokenId,
              operator: 'eq'
            }],
          }) as any;
          
          if (!qrToken) {
            return ctx.json({ error: "Token not found" }, { status: 404 });
          }
          
          if (qrToken.token !== token) {
            return ctx.json({ error: "Invalid token" }, { status: 401 });
          }
          
          if (new Date(qrToken.expiresAt) < new Date()) {
            // Clean up expired token
            await ctx.context.adapter.delete({
              model: "qrToken",
              where: [{
                field: "id",
                value: tokenId,
                operator: 'eq'
              }],
            });
            return ctx.json({ error: "Token expired" }, { status: 410 });
          }
          
          if (qrToken.isUsed) {
            return ctx.json({ error: "Token already used" }, { status: 409 });
          }
          
          // Create session creation token for secure claim process
          const sessionCreationToken = uuidv4();
          const sessionCreationTokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
          
          // Mark token as used and associate with user, store session creation token
          await ctx.context.adapter.update({
            model: "qrToken",
            where: [{
              field: "id",
              value: tokenId,
              operator: 'eq'
            }],
            update: {
              isUsed: true,
              userId: session.user.id,
              verifiedAt: new Date(),
              sessionCreationToken,
              sessionCreationTokenExpiresAt,
            },
          });
          
          return ctx.json({
            userId: session.user.id,
            user: session.user,
            sessionCreationToken,
            sessionCreationTokenExpiresAt: sessionCreationTokenExpiresAt.toISOString(),
          });
        }
      ),
      
      [parsedConfig.endpoints.pollStatus]: createAuthEndpoint(
        parsedConfig.endpoints.pollStatus,
        {
          method: "GET",
        },
        async (ctx) => {
          const url = new URL(ctx.request?.url || "");
          const tokenId = url.searchParams.get('tokenId');
          
          if (!tokenId) {
            return ctx.json({ error: "Token ID required" }, { status: 400 });
          }
          
          const qrToken = await ctx.context.adapter.findOne({
            model: "qrToken",
            where: [{
              field: "id",
              value: tokenId,
              operator: 'eq'
            }],
          }) as any;
          
          if (!qrToken) {
            return ctx.json({ error: "Token not found" }, { status: 404 });
          }
          
          // Check if token is expired
          if (new Date(qrToken.expiresAt) < new Date()) {
            // Clean up expired token
            await ctx.context.adapter.delete({
              model: "qrToken",
              where: [{
                field: "id",
                value: tokenId,
                operator: 'eq'
              }],
            });
            return ctx.json({ error: "Token expired" }, { status: 410 });
          }
          
          // If completed, return session creation token for secure claiming
          if (qrToken.isUsed) {
            // Get user data
            const user = await ctx.context.adapter.findOne({
              model: "user",
              where: [{
                field: "id",
                value: qrToken.userId,
                operator: 'eq'
              }],
            });
            
            if (user && qrToken.sessionCreationToken) {
              // Check if session creation token is not expired
              if (new Date(qrToken.sessionCreationTokenExpiresAt) > new Date()) {
                return ctx.json({
                  status: "completed",
                  userId: qrToken.userId,
                  user: user,
                  sessionCreationToken: qrToken.sessionCreationToken,
                  verifiedAt: qrToken.verifiedAt ? new Date(qrToken.verifiedAt).toISOString() : null,
                  expiresAt: new Date(qrToken.expiresAt).toISOString(),
                });
              }
            }
          }
          
          return ctx.json({
            status: qrToken.isUsed ? "completed" : "pending",
            userId: qrToken.userId,
            user: qrToken.user,
            verifiedAt: qrToken.verifiedAt ? new Date(qrToken.verifiedAt).toISOString() : null,
            expiresAt: new Date(qrToken.expiresAt).toISOString(),
          });
        }
      ),
      
      [parsedConfig.endpoints.claimSession]: createAuthEndpoint(
        parsedConfig.endpoints.claimSession,
        {
          method: "POST",
        },
        async (ctx) => {
          const { sessionCreationToken } = ctx.body;
          
          if (!sessionCreationToken) {
            return ctx.json({ error: "Session creation token is required" }, { status: 400 });
          }
          
          // Find QR token with the session creation token
          const qrToken = await ctx.context.adapter.findOne({
            model: "qrToken",
            where: [{
              field: "sessionCreationToken",
              value: sessionCreationToken,
              operator: 'eq'
            }],
          }) as any;
          
          if (!qrToken) {
            return ctx.json({ error: "Invalid session creation token" }, { status: 404 });
          }
          
          if (!qrToken.isUsed || !qrToken.userId) {
            return ctx.json({ error: "QR token not properly verified" }, { status: 400 });
          }
          
          // Check if session creation token is expired
          const tokenExpiresAt = new Date(qrToken.sessionCreationTokenExpiresAt);
          const now = new Date();
          
          if (tokenExpiresAt <= now) {
            return ctx.json({ error: "Session creation token expired" }, { status: 410 });
          }
          
          // Get user data
          const user = await ctx.context.adapter.findOne({
            model: "user",
            where: [{
              field: "id",
              value: qrToken.userId,
              operator: 'eq'
            }],
          });
          
          if (!user) {
            return ctx.json({ error: "User not found" }, { status: 404 });
          }
          
          // Create a new independent session for the web client
          try {
            const sessionToken = await ctx.context.internalAdapter.createSession(
              qrToken.userId,
              ctx
            );
            
            if (!sessionToken) {
              return ctx.json({ error: "Failed to create session" }, { status: 500 });
            }
            
            // Set the session cookie using Better Auth's built-in utility
            await setSessionCookie(ctx, {
              session: sessionToken,
              user: user as any
            });
            
            // Clear the session creation token to prevent reuse
            await ctx.context.adapter.update({
              model: "qrToken",
              where: [{
                field: "sessionCreationToken",
                value: sessionCreationToken,
                operator: 'eq'
              }],
              update: {
                sessionCreationToken: null,
                sessionCreationTokenExpiresAt: null,
              },
            });
            
            return ctx.json({
              success: true,
              userId: qrToken.userId,
              user: user,
              sessionToken: sessionToken.token,
              expiresAt: sessionToken.expiresAt instanceof Date ? sessionToken.expiresAt.toISOString() : sessionToken.expiresAt,
            });
            
          } catch (error) {
            return ctx.json({ 
              error: "Failed to create session: " + (error instanceof Error ? error.message : 'Unknown error') 
            }, { status: 500 });
          }
          
        }
      ),
    },
    
    hooks: {
      after: [
        {
          matcher: (context) => context.path === parsedConfig.endpoints.verifyToken,
          handler: async (ctx) => {
            // Hook for real-time updates integration (WebSocket/SSE)
            return ctx;
          },
        },
      ],
    },
    
    rateLimit: [
      {
        pathMatcher: (path) => path.startsWith("/qr/"),
        max: 10,
        window: 60, // 1 minute
      },
    ],
  } satisfies BetterAuthPlugin;
};