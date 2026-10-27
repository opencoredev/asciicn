import { ROUTES } from "@/constants/routes";
import { getStatus } from "@/lib/agent-discovery/status-api";

// Unversioned alias of /api/v1/status, kept for existing monitors. It is
// deprecated (RFC 9745) with no removal date yet; a Sunset header (RFC 8594)
// goes out at least 90 days before it is removed.
export { DELETE, OPTIONS, PATCH, POST, PUT } from "../v1/status/route";

export const dynamic = "force-dynamic";

/** 2026-10-27T00:00:00Z, the day the alias was deprecated, as RFC 9745 wants it. */
const DEPRECATED_AT = "@1793059200";

export const GET = (request: Request): Response => {
  const response = getStatus(request);
  response.headers.set("Deprecation", DEPRECATED_AT);
  response.headers.set(
    "Link",
    `<${ROUTES.API_STATUS_V1}>; rel="successor-version", <${ROUTES.OPENAPI}>; rel="deprecation"; type="application/json"`
  );
  return response;
};
