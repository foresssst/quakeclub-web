declare module 'openid' {
  export class RelyingParty {
    constructor(
      returnUrl: string,
      realm: string,
      stateless: boolean,
      strict: boolean,
      extensions: any[]
    );
    authenticate(
      identifier: string,
      immediate: boolean,
      callback: (error: any, authUrl: string) => void
    ): void;
    verifyAssertion(
      requestOrUrl: string,
      callback: (error: any, result: any) => void
    ): void;
  }
}
