// `paytmchecksum` ships no types (plain CommonJS). Minimal shim for the two
// static methods we use. See https://github.com/paytm/Paytm_Node_Checksum
declare module 'paytmchecksum' {
  function generateSignature(
    params: Record<string, unknown> | string,
    key: string,
  ): Promise<string>;

  function verifySignature(
    params: Record<string, unknown>,
    key: string,
    checksum: string,
  ): Promise<boolean> | boolean;

  export = { generateSignature, verifySignature };
}
