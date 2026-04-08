declare module 'cookie-parser' {
  import { RequestHandler } from 'express';

  interface CookieParserOptions {
    decode?(val: string): string;
  }

  interface CookieParseOptions {
    signed?: boolean;
  }

  type CookieParser = {
    (secret?: string | string[], options?: CookieParserOptions): RequestHandler;
    JSONCookie(str: string): any;
    JSONCookies(obj: Record<string, any>): Record<string, any>;
    signedCookie(str: string, secret: string): string | false;
    signedCookies(obj: Record<string, any>, secret: string | string[]): Record<string, any>;
  };

  const cookieParser: CookieParser;
  export = cookieParser;
}

declare namespace Express {
  interface Request {
    secret?: string;
    cookies: Record<string, any>;
    signedCookies: Record<string, any>;
  }
}
