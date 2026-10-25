type NonceRecord = {
  account: string;
  expiresAt: number;
};

export function createNonceStore() {
  const entries = new Map<string, NonceRecord>();

  return {
    remember(nonce: string, account: string, expiresAt: number, now = Date.now()) {
      for (const [key, record] of entries) {
        if (record.expiresAt <= now) entries.delete(key);
      }
      entries.set(nonce, { account, expiresAt });
    },
    consume(nonce: string, account: string, now = Date.now()) {
      const record = entries.get(nonce);
      if (!record) return false;
      entries.delete(nonce);
      return record.account === account && record.expiresAt > now;
    },
  };
}

export type NonceStore = ReturnType<typeof createNonceStore>;
