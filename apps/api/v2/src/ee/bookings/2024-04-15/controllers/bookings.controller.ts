import { CreateBookingInput_2024_04_15 } from "@/ee/bookings/2024-04-15/inputs/create-booking.input";
import { CreateRecurringBookingInput_2024_04-15 } from "@/ee/bookings/2024-04-15/inputs/create-recurring-booking.input";
import { MarkNoShowInput_2024_04-15 } from "@/ee/bookings/2024-04-15/inputs/mark-no-show.input";
import { GetBookingOutput_2024_04-15 } from "@/ee/bookings/2024-04-15/outputs/get-booking.output";
import { GetBookingsOutput_2024_04-15 } from "@/ee/bookings/2024-04-15/outputs/get-bookings.output";
import { MarkNoShowOutput_2024_04-15 } from "@/ee/bookings/2024-04-15/outputs/mark-no-show.output";
import { PlatformBookingsService } from "@/ee/bookings/shared/platform-bookings.service";
import { hashAPIKey, isApiKey, stripApiKey } from "@/lib/api-key";
import { VERSION_2024_04-15, VERSION_2024_06-11, VERSION_2024_06-14 } from "@/lib/api-versions";
import { ApiKeysRepository } from "@/modules/api-keys/api-keys-repository";
import { GetUser } from "@/modules/auth/decorators/get-user/get-user.decorator";
import { Permissions } from "@/modules/auth/decorators/permissions/permissions.decorator";
import { ApiAuthGuard } from "@/modules/auth/guards/api-auth/api-auth.guard";
import { PermissionsGuard } from "@/modules/auth/guards/permissions/permissions.guard";
import { BillingService } from "@/modules/billing/services/billing.service";
import { KyselyReadService } from "@/modules/kysely/kysely-read.service";
import { OAuthClientRepository } from "@/modules/oauth-clients/oauth-client.repository";
import { OAuthClientUsersService } from "@/modules/oauth-clients/services/oauth-clients-users.service";
import { OAuthFlowService } from "@/modules/oauth-clients/services/oauth-flow.service";
import { PrismaReadService } from "@/modules/prisma/prisma-read.service";
import { UsersService } from "@/modules/users/services/users.service";
import { UsersRepository, UserWithProfile } from "@/modules/users/users.repository";
import {
  Controller,
  Post,
  Logger,
  Req,
  InternalServerErrorException,
  Body,
  Headers,
  HttpException,
  Param,
  Get,
  Query,
  NotFoundException,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiQuery, ApiExcludeController as DocsExcludeController } from "@nestjs/swagger";
import { CreationSource } from "@prisma/client";
import { Request } from "express";
import { NextApiRequest } from "next/types";
import { v4 as uuidv4 } from "uuid";

import { X_CAL_CLIENT_ID, X_CAL_PLATFORM_EMBED } from "@calcom/platform-constants";
import { BOOKING_READ, SUCCESS_STATUS, BOOKING_WRITE } from "@calcom/platform-constants";
import {
  handleNewRecurringBooking,
  handleNewBooking,
  BookingResponse,
  HttpError,
  handleInstantMeeting,
  handleMarkNoShow,
  getAllUserBookings,
  getBookingInfo,
  handleCancelBooking,
  getBookingForReschedule,
  ErrorCode,
} from "@calcom/platform-libraries";
import {
  GetBookingsInput_2024_04-15,
  CancelBookingInput_2024_04-15,
  Status_2024_04-15,
} from "@calcom/platform-types";
import { ApiResponse } from "@calcom/platform-types";
import { PrismaClient } from "@calcom/prisma";

// (rest of the file remains unchanged until the cancelBooking method)

  @Post("/:bookingUid/cancel")
  @Permissions([BOOKING_WRITE]) // Added permission requirement
  @UseGuards(ApiAuthGuard) // Enforce authentication
  async cancelBooking(
    @Req() req: BookingRequest,
    @Param("bookingUid") bookingUid: string,
    @Body() body: CancelBookingInput_2024_04-15,
    @Headers(X_CAL_CLIENT_ID) clientId?: string,
    @Headers(X_CAL_PLATFORM_EMBED) isEmbed?: string
  ): Promise<ApiResponse<{ bookingId: number; bookingUid: string; onlyRemovedAttendee: boolean }>> {
    const oAuthClientId = clientId?.toString();
    const isUidNumber = !isNaN(Number(bookingUid));

    if (isUidNumber) {
      throw new BadRequestException("Please provide booking uid instead of booking id.");
    }

    if (bookingUid) {
      try {
        req.body.uid = bookingUid;
        const bookingRequest = await this.createNextApiBookingRequest(req, oAuthClientId, undefined, isEmbed);
        const res = await handleCancelBooking({
          bookingData: bookingRequest.body,
          userId: bookingRequest.userId,
          arePlatformEmailsEnabled: bookingRequest.arePlatformEmailsEnabled,
          platformClientId: bookingRequest.platformClientId,
          platformCancelUrl: bookingRequest.platformCancelUrl,
          platformRescheduleUrl: bookingRequest.platformRescheduleUrl,
          platformBookingUrl: bookingRequest.platformBookingUrl,
        });
        if (!res.onlyRemovedAttendee) {
          void (await this.billingService.cancelUsageByBookingUid(res.bookingUid));
        }
        return {
          status: SUCCESS_STATUS,
          data: {
            bookingId: res.bookingId,
            bookingUid: res.bookingUid,
            onlyRemovedAttendee: res.onlyRemovedAttendee,
          },
        };
      } catch (err) {
        this.handleBookingErrors(err);
      }
    } else {
      throw new NotFoundException("Booking ID is required.");
    }
    throw new InternalServerErrorException("Could not cancel booking.");
  }

// (rest of the file remains unchanged)
