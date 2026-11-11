import { Keypair, StrKey } from "@stellar/stellar-sdk";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { API_ROUTES, SESSION_COOKIE, type ApiErrorBody } from "@senda/shared";
import type { NonceStore } from "../auth/nonce-store.js";
import { createSep10Challenge, networkPassphraseFor, redeemSep10Challenge } from "../auth/sep10.js";
import {
  clearSessionCookieHeader,
  readRequestCookie,
  sessionCookieHeader,
  cleanDisplayName,
  signSession,
  verifySession,
} from "../auth/session.js";
import type { Env } from "../config/env.js";
import type { BusinessStore } from "../store/types.js";

const INVALID_ACCOUNT = "Ingresá una cuenta Stellar válida.";
const BAD_SIGNATURE = "No se pudo verificar la firma.";
const LOGIN_REQUIRED = "Tenés que ingresar.";

export function businessAuthRoutes(env: Env, store: BusinessStore): FastifyPluginAsync {
  const nonces: NonceStore = {
    remember(nonce, account, expiresAt) {
      return store.rememberSep10Nonce({
        nonce,
        account,
        expiresAt: new Date(expiresAt).toISOString(),
      });
    },
    consume(nonce, account) {
      return store.consumeSep10Nonce(nonce, account, new Date());
    },
  };
  const serverKeypair = Keypair.fromSecret(env.SEP10_SIGNING_SECRET);
  const networkPassphrase = networkPassphraseFor(env.STELLAR_NETWORK);
  const secure = env.NODE_ENV === "production";

  return async (app) => {
    app.post(API_ROUTES.sep10Challenge, async (request, reply) => {
      const account = publicAccount(request.body);
      if (!account) return error(reply, 400, INVALID_ACCOUNT);
      if (serverKeypair.publicKey() === env.STELLAR_ADMIN_PUBLIC) {
        return reply.code(500).send({
          error: "The SEP-10 signing account and the company account must be different.",
        });
      }

      return createSep10Challenge({
        serverKeypair,
        account,
        homeDomain: env.SEP10_HOME_DOMAIN,
        networkPassphrase,
        nonces,
      });
    });

    app.post(API_ROUTES.sep10Token, async (request, reply) => {
      const transaction = signedTransaction(request.body);
      const account = transaction
        ? await redeemSep10Challenge({
            transaction,
            serverKeypair,
            homeDomain: env.SEP10_HOME_DOMAIN,
            networkPassphrase,
            nonces,
          })
        : null;
      if (!account) return error(reply, 401, BAD_SIGNATURE);

      const token = signSession(account, env.SESSION_SECRET, Date.now(), displayName(request.body));
      return reply.header("set-cookie", sessionCookieHeader(token, secure)).code(204).send();
    });

    app.get(API_ROUTES.businessSession, async (request, reply) => {
      const session = signedSession(request.headers.cookie, env);
      if (!session) return error(reply, 401, LOGIN_REQUIRED);
      return { account: session.account, name: session.name };
    });

    app.delete(API_ROUTES.businessSession, async (_request, reply) => {
      return reply.header("set-cookie", clearSessionCookieHeader(secure)).code(204).send();
    });
  };
}

function signedSession(cookie: string | string[] | undefined, env: Env) {
  const token = readRequestCookie(cookie, SESSION_COOKIE);
  if (!token) return null;
  return verifySession(token, env.SESSION_SECRET);
}

function publicAccount(body: unknown): string | null {
  if (!isRecord(body) || typeof body.account !== "string") return null;
  try {
    return StrKey.isValidEd25519PublicKey(body.account) ? body.account : null;
  } catch {
    return null;
  }
}

function displayName(body: unknown): string | null {
  if (!isRecord(body)) return null;
  return cleanDisplayName(body.name);
}

function signedTransaction(body: unknown): string | null {
  if (!isRecord(body) || typeof body.transaction !== "string" || body.transaction.length === 0) {
    return null;
  }
  return body.transaction;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(reply: FastifyReply, status: 400 | 401, message: string) {
  const body: ApiErrorBody = { error: message };
  return reply.code(status).send(body);
}
