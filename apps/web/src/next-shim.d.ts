declare module "next/link" {
  import type { AnchorHTMLAttributes, PropsWithChildren, ReactElement } from "react";

  export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
  }

  export default function Link(props: PropsWithChildren<LinkProps>): ReactElement;
}

declare module "next/navigation" {
  export function notFound(): never;
}

declare module "next/headers" {
  export function cookies(): Promise<{
    get: (name: string) => { value: string } | undefined;
  }>;
}

declare module "next/server" {
  export class NextResponse extends Response {
    static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
    cookies: {
      set: (options: {
        name: string;
        value: string;
        httpOnly?: boolean;
        maxAge?: number;
        path?: string;
        sameSite?: "lax" | "strict" | "none";
      }) => void;
    };
  }
}
