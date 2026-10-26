import "server-only";

import { SESSION_COOKIE } from "@senda/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { BUSINESS_LOGIN_PATH } from "@/lib/site";

export async function requireBusinessSession() {
  await connection();
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) redirect(BUSINESS_LOGIN_PATH);
}
