// Structural slice of an express handler: keeps express types out of our .d.ts,
// so consumers resolve against their own express copy only.
export type Middleware<Req, Res> = (
  req: Req,
  res: Res,
  next: () => void,
) => void;
