import jwt from "jsonwebtoken";

import prisma from "@calcom/prisma";
import type { OAuthTokenPayload } from "@calcom/types/oauth";

export default async function isAuthorized(token: string, requiredScopes: string[] = []) {
  let decodedToken: OAuthTokenPayload;
  const secret = process.env.CALENDSO_ENCRYPTION_KEY;
  if (!secret) {
    // Fail securely if the secret is not set
    throw new Error("CALENDSO_ENCRYPTION_KEY environment variable must be set for authentication.");
  }
  try {
    decodedToken = jwt.verify(token, secret) as OAuthTokenPayload;
  } catch {
    return null;
  }

  if (!decodedToken) return null;
  const hasAllRequiredScopes = requiredScopes.every((scope) => decodedToken.scope.includes(scope));

  if (!hasAllRequiredScopes || decodedToken.token_type !== "Access Token") {
    return null;
  }

  if (decodedToken.userId) {
    const user = await prisma.user.findUnique({
      where: {
        id: decodedToken.userId,
      },
      select: {
        id: true,
        username: true,
      },
    });

    if (!user) return null;

    return { id: user.id, name: user.username, isTeam: false };
  }

  if (decodedToken.teamId) {
    const team = await prisma.team.findUnique({
      where: {
        id: decodedToken.teamId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!team) return null;
    return { ...team, isTeam: true };
  }

  return null;
}
