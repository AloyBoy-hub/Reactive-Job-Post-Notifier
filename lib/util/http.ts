import type { VercelRequest } from "@vercel/node";

export const getJsonBody = <T>(req: VercelRequest): T => {
  if (!req.body) {
    return {} as T;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body) as T;
  }

  return req.body as T;
};

export const getAuthToken = (req: VercelRequest): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
};
