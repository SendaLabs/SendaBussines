export type SessionSigner = {
  name: string;
  account: string;
  personal: boolean;
};

export function sessionSigner(session: { account: string; name: string | null }): SessionSigner {
  const account = shortAccount(session.account);
  const name = session.name?.trim() ?? "";
  if (name.length > 0) return { name, account, personal: true };
  return { name: account, account, personal: false };
}

function shortAccount(account: string): string {
  if (account.length <= 10) return account;
  return `${account.slice(0, 4)}…${account.slice(-4)}`;
}
