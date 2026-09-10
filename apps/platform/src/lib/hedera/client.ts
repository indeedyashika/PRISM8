import { AccountId, Client, PrivateKey } from "@hiero-ledger/sdk";

// Server-only singleton: one operator/treasury account backs every token this app creates.
// This is a deliberate hackathon simplification (see README "Security model") — a production
// version would generate per-token keys and/or move signing behind an HSM/KMS.

declare global {
  var __hederaClient: Client | undefined;
  var __hederaOperatorKey: PrivateKey | undefined;
  var __hederaOperatorId: AccountId | undefined;
}

function network(): "mainnet" | "testnet" | "previewnet" {
  const n = (process.env.HEDERA_NETWORK ?? "testnet").toLowerCase();
  if (n === "mainnet" || n === "previewnet") return n;
  return "testnet";
}

function init(): void {
  const idStr = process.env.HEDERA_OPERATOR_ID;
  const keyStr = process.env.HEDERA_OPERATOR_KEY;
  if (!idStr || !keyStr) {
    throw new Error(
      "HEDERA_OPERATOR_ID / HEDERA_OPERATOR_KEY are not set. Copy .env.example to .env and fill in a testnet account (see README)."
    );
  }

  const operatorId = AccountId.fromString(idStr);
  // PrivateKey.fromString() silently assumes ED25519 for non-DER raw hex,
  // which is wrong for EVM-alias accounts (evm_address/MetaMask-style keys),
  // whose keys are ECDSA secp256k1 — that mismatch produces an INVALID_SIGNATURE
  // precheck failure that looks unrelated to key parsing.
  const operatorKey = PrivateKey.isDerKey(keyStr) ? PrivateKey.fromStringDer(keyStr) : PrivateKey.fromStringECDSA(keyStr);

  const net = network();
  const client =
    net === "mainnet" ? Client.forMainnet() : net === "previewnet" ? Client.forPreviewnet() : Client.forTestnet();
  client.setOperator(operatorId, operatorKey);

  globalThis.__hederaClient = client;
  globalThis.__hederaOperatorKey = operatorKey;
  globalThis.__hederaOperatorId = operatorId;
}

export function getOperatorClient(): Client {
  if (!globalThis.__hederaClient) init();
  return globalThis.__hederaClient!;
}

export function getOperatorKey(): PrivateKey {
  if (!globalThis.__hederaOperatorKey) init();
  return globalThis.__hederaOperatorKey!;
}

export function getOperatorId(): AccountId {
  if (!globalThis.__hederaOperatorId) init();
  return globalThis.__hederaOperatorId!;
}
