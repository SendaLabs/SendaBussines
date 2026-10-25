import { Keypair, StrKey } from "@stellar/stellar-sdk";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { API_ROUTES, SESSION_COOKIE, type ApiErrorBody } from "@senda/shared";
import { createNonceStore } from "../auth/nonce-store.js";
import { createSep10Challenge, networkPassphraseFor, redeemSep10Challenge } from "../auth/sep10.js";
import {
  clearSessionCookieHeader,
  readRequestCookie,
  sessionCookieHeader,
  signSession,
  verifySession,
} from "../auth/session.js";
import type { Env } from "../config/env.js";

const INVALID_ACCOUNT = "Ingresá una cuenta Stellar válida.";
const UNKNOWN_ACCOUNT = "Esa cuenta no pertenece a la empresa.";
const BAD_SIGNATURE = "No se pudo verificar la firma.";
const LOGIN_REQUIRED = "Tenés que ingresar.";

export function businessAuthRoutes(env: Env): FastifyPluginAsync {
  const nonces = createNonceStore();
  const serverKeypair = Keypair.fromSecret(env.SEP10_SIGNING_SECRET);
  const networkPassphrase = networkPassphraseFor(env.STELLAR_NETWORK);
  const secure = env.NODE_ENV === "production";

  return async (app) => {
    app.post(API_ROUTES.sep10Challenge, async (request, reply) => {
      const account = publicAccount(request.body);
      if (!account) return error(reply, 400, INVALID_ACCOUNT);
      if (account !== env.STELLAR_ADMIN_PUBLIC) return error(reply, 401, UNKNOWN_ACCOUNT);
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
        ? redeemSep10Challenge({
            transaction,
            serverKeypair,
            adminAccount: env.STELLAR_ADMIN_PUBLIC,
            homeDomain: env.SEP10_HOME_DOMAIN,
            networkPassphrase,
            nonces,
          })
        : null;
      if (!account) return error(reply, 401, BAD_SIGNATURE);

      const token = signSession(account, env.SESSION_SECRET);
      return reply.header("set-cookie", sessionCookieHeader(token, secure)).code(204).send();
    });

    app.get(API_ROUTES.businessSession, async (request, reply) => {
      const account = sessionAccount(request.headers.cookie, env);
      if (!account) return error(reply, 401, LOGIN_REQUIRED);
      return { account };
    });

    app.delete(API_ROUTES.businessSession, async (_request, reply) => {
      return reply.header("set-cookie", clearSessionCookieHeader(secure)).code(204).send();
    });
  };
}

function sessionAccount(cookie: string | string[] | undefined, env: Env): string | null {
  const token = readRequestCookie(cookie, SESSION_COOKIE);
  if (!token) return null;
  const session = verifySession(token, env.SESSION_SECRET);
  if (!session || session.account !== env.STELLAR_ADMIN_PUBLIC) return null;
  return session.account;
}

function publicAccount(body: unknown): string | null {
  if (!isRecord(body) || typeof body.account !== "string") return null;
  try {
    return StrKey.isValidEd25519PublicKey(body.account) ? body.account : null;
  } catch {
    return null;
  }
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
