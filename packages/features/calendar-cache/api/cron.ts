import type { NextApiRequest } from "next";

import { HttpError } from "@calcom/lib/http-error";
import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { defaultHandler } from "@calcom/lib/server/defaultHandler";
import { defaultResponder } from "@calcom/lib/server/defaultResponder";
import { SelectedCalendarRepository } from "@calcom/lib/server/repository/selectedCalendar";
import type { SelectedCalendarEventTypeIds } from "@calcom/types/Calendar";

import { CalendarCache } from "../calendar-cache";

const log = logger.getSubLogger({ prefix: ["CalendarCacheCron"] });

const validateRequest = (req: NextApiRequest) => {
  const apiKey = req.headers.authorization || req.query.apiKey;
  if (![process.env.CRON_API_KEY, `Bearer ${process.env.CRON_SECRET}`].includes(`${apiKey}`)) {
    throw new HttpError({ statusCode: 401, message: "Unauthorized" });
  }
};

function logRejected(result: PromiseSettledResult<unknown>) {
  if (result.status === "rejected") {
    console.error(result.reason);
  }
}

// Fix: Group by both externalId and credentialId to prevent cross-tenant mixing
function getUniqueCalendarsByExternalIdAndCredentialId<
  T extends {
    externalId: string;
    eventTypeId: number | null;
    credentialId: number | null;
    id: string;
  }
>(calendars: T[]) {
  type Key = string;
  return calendars.reduce(
    (acc, sc) => {
      if (!sc.credentialId) {
        // Skip grouping if credentialId is missing; will be handled later
        return acc;
      }
      const key = `${sc.externalId}::${sc.credentialId}`;
      if (!acc[key]) {
        acc[key] = {
          eventTypeIds: [sc.eventTypeId],
          credentialId: sc.credentialId,
          externalId: sc.externalId,
          ids: [sc.id],
        };
      } else {
        acc[key].eventTypeIds.push(sc.eventTypeId);
        acc[key].ids.push(sc.id);
      }
      return acc;
    },
    {} as Record<
      Key,
      {
        eventTypeIds: SelectedCalendarEventTypeIds;
        credentialId: number;
        externalId: string;
        ids: string[];
      }
    >
  );
}

const handleCalendarsToUnwatch = async () => {
  const calendarsToUnwatch = await SelectedCalendarRepository.getNextBatchToUnwatch(500);
  const calendarsWithEventTypeIdsGroupedTogether = getUniqueCalendarsByExternalIdAndCredentialId(calendarsToUnwatch);
  const result = await Promise.allSettled(
    Object.values(calendarsWithEventTypeIdsGroupedTogether).map(
      async ({ eventTypeIds, credentialId, externalId, ids }) => {
        if (!credentialId) {
          // So we don't retry on next cron run
          await Promise.all(
            ids.map(id =>
              SelectedCalendarRepository.setErrorInUnwatching({
                id,
                error: "Missing credentialId",
              })
            )
          );
          log.error("no credentialId for SelectedCalendar(s): ", ids.join(", "));
          return;
        }

        try {
          const cc = await CalendarCache.initFromCredentialId(credentialId);
          await cc.unwatchCalendar({ calendarId: externalId, eventTypeIds });
          await Promise.all(ids.map(id => SelectedCalendarRepository.removeUnwatchingError({ id })));
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          log.error(
            `Error unwatching calendar ${externalId}`,
            safeStringify({
              selectedCalendarIds: ids,
              error: errorMessage,
            })
          );
          await Promise.all(
            ids.map(id =>
              SelectedCalendarRepository.setErrorInUnwatching({
                id,
                error: `${errorMessage}`,
              })
            )
          );
        }
      }
    )
  );

  log.info(`Processed ${result.length} calendars for unwatching`);

  result.forEach(logRejected);
  return result;
};

const handleCalendarsToWatch = async () => {
  const calendarsToWatch = await SelectedCalendarRepository.getNextBatchToWatch(500);
  const calendarsWithEventTypeIdsGroupedTogether = getUniqueCalendarsByExternalIdAndCredentialId(calendarsToWatch);
  const result = await Promise.allSettled(
    Object.values(calendarsWithEventTypeIdsGroupedTogether).map(
      async ({ credentialId, eventTypeIds, externalId, ids }) => {
        if (!credentialId) {
          // So we don't retry on next cron run
          await Promise.all(
            ids.map(id =>
              SelectedCalendarRepository.setErrorInWatching({ id, error: "Missing credentialId" })
            )
          );
          log.error("no credentialId for SelectedCalendar(s): ", ids.join(", "));
          return;
        }

        try {
          const cc = await CalendarCache.initFromCredentialId(credentialId);
          await cc.watchCalendar({ calendarId: externalId, eventTypeIds });
          await Promise.all(ids.map(id => SelectedCalendarRepository.removeWatchingError({ id })));
        } catch (error) {
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          }
          log.error(
            `Error watching calendar ${externalId}`,
            safeStringify({
              selectedCalendarIds: ids,
              error: errorMessage,
            })
          );
          await Promise.all(
            ids.map(id =>
              SelectedCalendarRepository.setErrorInWatching({
                id,
                error: `${errorMessage}`,
              })
            )
          );
        }
      }
    )
  );
  log.info(`Processed ${result.length} calendars for watching`);
  result.forEach(logRejected);
  return result;
};

// This cron is used to activate and renew calendar subscriptions
const handler = defaultResponder(async (request: NextApiRequest) => {
  validateRequest(request);
  await Promise.allSettled([handleCalendarsToWatch(), handleCalendarsToUnwatch()]);

  // TODO: Credentials can be installed on a whole team, check for selected calendars on the team
  return {
    executedAt: new Date().toISOString(),
  };
});

export default defaultHandler({
  GET: Promise.resolve({ default: defaultResponder(handler) }),
});
