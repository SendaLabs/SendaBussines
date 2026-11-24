import { NoWalletsAvailableError, type StellarWalletPort } from "./stellar-wallet-login";

type Kit = (typeof import("@creit.tech/stellar-wallets-kit/sdk"))["StellarWalletsKit"];

let kitPromise: Promise<Kit> | null = null;

/**
 * Loads and initialises the Stellar Wallets Kit once, on first use. It is
 * imported lazily because it touches `document` and `window`, so it must never
 * run during server rendering, and because it is heavy.
 */
function loadKit(): Promise<Kit> {
  kitPromise ??= (async () => {
    const [{ StellarWalletsKit }, { defaultModules }] = await Promise.all([
      import("@creit.tech/stellar-wallets-kit/sdk"),
      import("@creit.tech/stellar-wallets-kit/modules/utils"),
    ]);
    StellarWalletsKit.init({ modules: defaultModules() });
    return StellarWalletsKit;
  })().catch((caught: unknown) => {
    kitPromise = null; // allow a retry if the chunk failed to load
    throw caught;
  });
  return kitPromise;
}

/**
 * The login flow's view of the Wallets Kit. The kit's own modal is the wallet
 * selector: nothing is pre-selected, and every wallet the kit supports is
 * listed, not only Freighter.
 */
export function createStellarWalletsKitPort(): StellarWalletPort {
  return {
    async connect() {
      const kit = await loadKit();
      const wallets = await kit.refreshSupportedWallets();
      if (!wallets.some((wallet) => wallet.isAvailable)) throw new NoWalletsAvailableError();
      return kit.authModal();
    },
    async signTransaction(xdr, options) {
      const kit = await loadKit();
      return kit.signTransaction(xdr, options);
    },
    async reset() {
      // Forget the selected wallet so the next attempt starts from the selector.
      // Nothing to reset if the kit never loaded.
      if (!kitPromise) return;
      const kit = await kitPromise;
      await kit.disconnect();
    },
  };
}
