import {Scalar, ZqField} from "ffjavascript";

const SNARK_FIELD_SIZE = 0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;
const F = new ZqField(Scalar.fromString(SNARK_FIELD_SIZE.toString()));
const BASE = F.e(2);

export function sigToKeyPair(signature) {
  const priv = F.e(signature);
  return { priv, pub: F.pow(BASE, priv) };
}

export function randomBigInt(bits) {
    const bytes = Math.ceil(bits / 8);
    const randomBytes = new Uint8Array(bytes);
    crypto.getRandomValues(randomBytes);

    let bigint = BigInt(0);
    for (let byte of randomBytes) {
        bigint = (bigint << BigInt(8)) | BigInt(byte);
    }

    return bigint;
}
