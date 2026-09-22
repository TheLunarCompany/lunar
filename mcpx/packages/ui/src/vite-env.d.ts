/// <reference types="vite/client" />

declare module "*.svg?react" {
  import type { FC, SVGProps } from "react";
  const content: FC<SVGProps<SVGSVGElement>>;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}
