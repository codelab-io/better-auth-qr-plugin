import type { BetterAuthPlugin } from "better-auth/plugins";
import { createAuthEndpoint } from "better-auth/api";
import { sessionMiddleware } from "better-auth/api";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import QRCode from "qrcode";

const qrAuthConfigSchema = z.object({
  tokenExpirationMinutes: z.number().default(5),
  qrCodeSize: z.number().default(256),
  endpoints: z.object({
    generateToken: z.string().default("/qr/generate"),
    verifyToken: z.string().default("/qr/verify"),
    pollStatus: z.string().default("/qr/status"),
  }).default({}),
});

type QRAuthConfigInput = z.input<typeof qrAuthConfigSchema>;

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
          });
          
          // Create QR code data
          const qrData = JSON.stringify({
            tokenId,
            token,
            serverUrl: ctx.context.baseURL,
          });
          
          const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
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
          const body = await ctx.request?.json();
          const { tokenId, token } = body;
          
          if (!tokenId || !token) {
            return ctx.json({ success: false, error: "Token ID and token are required" }, { status: 400 });
          }
          
          // Get current session (mobile user)
          const session = ctx.context.session;
          if (!session || !session.user) {
            return ctx.json({ success: false, error: "No authenticated user" }, { status: 401 });
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
            return ctx.json({ success: false, error: "Token not found" }, { status: 404 });
          }
          
          if (qrToken.token !== token) {
            return ctx.json({ success: false, error: "Invalid token" }, { status: 401 });
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
            return ctx.json({ success: false, error: "Token expired" }, { status: 410 });
          }
          
          if (qrToken.isUsed) {
            return ctx.json({ success: false, error: "Token already used" }, { status: 409 });
          }
          
          // Mark token as used and associate with user
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
            },
          });
          
          // Create a new session for the web client  
          const sessionToken = uuidv4();
          const newSession = {
            id: uuidv4(),
            token: sessionToken,
            userId: session.user.id,
            expiresAt: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          return ctx.json({
            success: true,
            data: {
              userId: session.user.id,
              sessionToken: newSession.token,
              user: session.user,
            },
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
            return ctx.json({ success: false, error: "Token ID required" }, { status: 400 });
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
            return ctx.json({ success: false, error: "Token not found" }, { status: 404 });
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
            return ctx.json({ success: false, error: "Token expired" }, { status: 410 });
          }
          
          return ctx.json({
            success: true,
            data: {
              status: qrToken.isUsed ? "completed" : "pending",
              userId: qrToken.userId,
              user: qrToken.user,
              verifiedAt: qrToken.verifiedAt?.toISOString(),
              expiresAt: qrToken.expiresAt.toISOString(),
            },
          });
        }
      ),
    },
    
    hooks: {
      after: [
        {
          matcher: (context) => {
            return context.path === parsedConfig.endpoints.verifyToken;
          },
          handler: async (ctx) => {
            // Could emit events here for real-time updates
            // This would integrate with WebSocket/SSE solutions
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