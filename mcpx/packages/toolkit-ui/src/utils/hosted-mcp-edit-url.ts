export const HOSTED_MCP_EDIT_PARAM = "hostedMcpEdit";
export const HOSTED_RETURN_URL_PARAM = "returnUrl";
export const HOSTED_SPACE_ID_PARAM = "hostedSpaceId";
const HOSTED_ADMIN_PATH = "/hosted-mcp-server";

export type HostedMcpEditContext = {
  returnUrl: string | null;
  spaceId: string;
};

export function buildHostedMcpEditUrl({
  returnUrl,
  targetUrl,
  spaceId,
}: {
  returnUrl: string;
  targetUrl: string;
  spaceId: string;
}): string {
  const url = new URL(targetUrl);
  url.searchParams.set(HOSTED_MCP_EDIT_PARAM, "true");
  url.searchParams.set(HOSTED_SPACE_ID_PARAM, spaceId);
  url.searchParams.set(HOSTED_RETURN_URL_PARAM, returnUrl);
  return url.toString();
}

function safeReturnUrl(returnUrl: string | null): string | null {
  if (!returnUrl) return null;

  try {
    const url = new URL(returnUrl);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";

    return isHttp && url.pathname === HOSTED_ADMIN_PATH ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseHostedMcpEditContext(
  searchParams: string | URLSearchParams,
): HostedMcpEditContext | null {
  const params = new URLSearchParams(searchParams);
  const isHostedEdit = params.get(HOSTED_MCP_EDIT_PARAM) === "true";
  const hostedSpaceId = params.get(HOSTED_SPACE_ID_PARAM);
  const returnUrl = params.get(HOSTED_RETURN_URL_PARAM);

  if (!isHostedEdit || !hostedSpaceId) {
    return null;
  }

  return {
    returnUrl: safeReturnUrl(returnUrl),
    spaceId: hostedSpaceId,
  };
}
