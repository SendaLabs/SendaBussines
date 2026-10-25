/** API error shape from the parent contract: `{ "error": "<mensaje en español>" }`. */
export class EscrowClientError extends Error {
  readonly statusCode: number;
  readonly body: { error: string };

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "EscrowClientError";
    this.statusCode = statusCode;
    this.body = { error: message };
  }
}

export const RECEIVER_IS_ADMIN =
  "El proveedor no puede ser la cuenta de la empresa.";

export const TRUSTLINE_REJECTED =
  "La cuenta del proveedor tiene que poder recibir USDC de testnet.";

export const DEPLOY_FAILED =
  "No se pudo preparar el depósito. El pago sigue pendiente.";

export const FUND_FAILED =
  "No se pudo fondear el depósito. El pago sigue pendiente.";

export const RELEASE_FAILED =
  "No se pudo liberar el hito. El depósito sigue fondeado.";

export const AMOUNT_INVALID = "El monto del pago tiene que ser un número.";

export const FUND_AMOUNT_MISMATCH =
  "El monto a fondear tiene que ser la suma de los hitos.";

export const TREASURY_MISSING = "La tesorería no está configurada.";

export const TREASURY_MISMATCH =
  "La tesorería no coincide con la cuenta de la empresa.";

export const SIGN_FAILED =
  "No se pudo firmar la transacción de la tesorería.";
