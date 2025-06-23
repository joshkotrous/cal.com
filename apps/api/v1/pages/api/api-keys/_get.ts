import type { Prisma } from "@prisma/client";
import type { NextApiRequest } from "next";

import { defaultResponder } from "@calcom/lib/server/defaultResponder";
import prisma from "@calcom/prisma";
import type { Ensure } from "@calcom/types/utils";

import { apiKeyPublicSchema } from "~/lib/validations/api-key";
import { schemaQuerySingleOrMultipleUserIds } from "~/lib/validations/shared/queryUserId";

/**
 * Narrowed request type that allows attaching prisma arguments during
 * processing. This field is removed before the response is returned.
 */
 type CustomNextApiRequest = NextApiRequest & {
  args?: Prisma.ApiKeyFindManyArgs;
};

/**
 * Safely determine if the current request was flagged as system-wide admin by
 * trusted middleware.  We explicitly check that the property exists **directly**
 * on the request instance and that its value is exactly `true`.  This blocks
 * prototype-pollution attacks that add the flag on `Object.prototype` or coerce
 * it into a truthy non-boolean value.
 */
function isTrustedSystemWideAdmin(req: NextApiRequest): boolean {
  return Object.prototype.hasOwnProperty.call(req, "isSystemWideAdmin") && req.isSystemWideAdmin === true;
}

/** Admins can query other users' API keys */
function handleAdminRequests(req: CustomNextApiRequest, isAdmin: boolean) {
  // To match type safety with runtime
  if (!hasReqArgs(req)) throw Error("Missing req.args");
  const { userId } = req;
  if (isAdmin && req.query.userId) {
    const query = schemaQuerySingleOrMultipleUserIds.parse(req.query);
    const userIds = Array.isArray(query.userId) ? query.userId : [query.userId || userId];
    req.args.where = { userId: { in: userIds } };
    if (Array.isArray(query.userId)) req.args.orderBy = { userId: "asc" };
  }
}

function hasReqArgs(req: CustomNextApiRequest): req is Ensure<CustomNextApiRequest, "args"> {
  return "args" in req;
}

async function getHandler(req: CustomNextApiRequest) {
  const { userId } = req;
  const isAdmin = isTrustedSystemWideAdmin(req);

  // Initialise base prisma arguments depending on the caller's privilege.
  req.args = isAdmin ? {} : { where: { userId } };

  // Allow further mutations that depend on the privilege level.
  handleAdminRequests(req, isAdmin);

  const data = await prisma.apiKey.findMany(req.args);
  return { api_keys: data.map((v) => apiKeyPublicSchema.parse(v)) };
}

export default defaultResponder(getHandler);
