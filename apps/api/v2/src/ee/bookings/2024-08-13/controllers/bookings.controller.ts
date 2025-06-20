import { BookingUidGuard } from "@/ee/bookings/2024-08-13/guards/booking-uid.guard";
import { BookingReferencesFilterInput_2024_08_13 } from "@/ee/bookings/2024-08-13/inputs/booking-references-filter.input";
import { BookingReferencesOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/booking-references.output";
import { CalendarLinksOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/calendar-links.output";
import { CancelBookingOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/cancel-booking.output";
import { CreateBookingOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/create-booking.output";
import { MarkAbsentBookingOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/mark-absent.output";
import { ReassignBookingOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/reassign-booking.output";
import { RescheduleBookingOutput_2024_08_13 } from "@/ee/bookings/2024-08-13/outputs/reschedule-booking.output";
import { BookingReferencesService_2024_08_13 } from "@/ee/bookings/2024-08-13/services/booking-references.service";
import { BookingsService_2024_08_13 } from "@/ee/bookings/2024-08-13/services/bookings.service";
import { CalVideoService } from "@/ee/bookings/2024-08-13/services/cal-video.service";
import { VERSION_2024_08_13_VALUE, VERSION_2024_08_13 } from "@/lib/api-versions";
import { API_KEY_OR_ACCESS_TOKEN_HEADER } from "@/lib/docs/headers";
import { PlatformPlan } from "@/modules/auth/decorators/billing/platform-plan.decorator";
import { GetUser } from "@/modules/auth/decorators/get-user/get-user.decorator";
import { Permissions } from "@/modules/auth/decorators/permissions/permissions.decorator";
import { Roles } from "@/modules/auth/decorators/roles/roles.decorator";
import { ApiAuthGuard } from "@/modules/auth/guards/api-auth/api-auth.guard";
import { PermissionsGuard } from "@/modules/auth/guards/permissions/permissions.guard";
import { UsersService } from "@/modules/users/services/users.service";
import { UserWithProfile } from "@/modules/users/users.repository";
import {
  Controller,
  Post,
  Logger,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags as DocsTags,
  ApiHeader,
  getSchemaPath,
  ApiBody,
  ApiExtraModels,
} from "@nestjs/swagger";
import { Request } from "express";

import { BOOKING_READ, BOOKING_WRITE, SUCCESS_STATUS } from "@calcom/platform-constants";
import {
  CancelBookingInput,
  CancelBookingInput_2024_08_13,
  CancelBookingInputPipe,
  CancelSeatedBookingInput_2024_08_13,
  GetBookingOutput_2024_08_13,
  GetBookingsOutput_2024_08_13,
  RescheduleBookingInput,
  RescheduleBookingInput_2024_08_13,
  RescheduleBookingInputPipe,
  RescheduleSeatedBookingInput_2024_08_13,
  GetBookingRecordingsOutput,
  GetBookingTranscriptsOutput,
} from "@calcom/platform-types";
import {
  CreateBookingInputPipe,
  CreateBookingInput,
  GetBookingsInput_2024_08_13,
  ReassignToUserBookingInput_2024_08_13,
  MarkAbsentBookingInput_2024_08_13,
  CreateBookingInput_2024_08_13,
  CreateInstantBookingInput_2024_08_13,
  CreateRecurringBookingInput_2024_08_13,
  DeclineBookingInput_2024_08_13,
} from "@calcom/platform-types";

@Controller({
  path: "/v2/bookings",
  version: VERSION_2024_08_13_VALUE,
})
@UseGuards(PermissionsGuard)
@DocsTags("Bookings")
@ApiHeader({
  name: "cal-api-version",
  description: `Must be set to ${VERSION_2024_08_13}`,
  example: VERSION_2024_08_13,
  required: true,
  schema: {
    default: VERSION_2024_08_13,
  },
})
export class BookingsController_2024_08_13 {
  private readonly logger = new Logger("BookingsController_2024_08_13");

  constructor(
    private readonly bookingsService: BookingsService_2024_08_13,
    private readonly usersService: UsersService,
    private readonly bookingReferencesService: BookingReferencesService_2024_08_13,
    private readonly calVideoService: CalVideoService
  ) {}

  /* existing methods remain unchanged */

  @Post("/:bookingUid/reschedule")
  @Permissions([BOOKING_WRITE])
  @UseGuards(ApiAuthGuard, BookingUidGuard)
  @ApiHeader(API_KEY_OR_ACCESS_TOKEN_HEADER)
  @ApiOperation({
    summary: "Reschedule a booking",
    description: "Reschedule a booking or seated booking",
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(RescheduleBookingInput_2024_08_13) },
        { $ref: getSchemaPath(RescheduleSeatedBookingInput_2024_08_13) },
      ],
    },
    description:
      "Accepts different types of reschedule booking input: Reschedule Booking (Option 1) or Reschedule Seated Booking (Option 2)",
  })
  @ApiExtraModels(RescheduleBookingInput_2024_08_13, RescheduleSeatedBookingInput_2024_08_13)
  async rescheduleBooking(
    @Param("bookingUid") bookingUid: string,
    @Body(new RescheduleBookingInputPipe())
    body: RescheduleBookingInput,
    @Req() request: Request
  ): Promise<RescheduleBookingOutput_2024_08_13> {
    const newBooking = await this.bookingsService.rescheduleBooking(request, bookingUid, body);
    await this.bookingsService.billRescheduledBooking(newBooking, bookingUid);

    return {
      status: SUCCESS_STATUS,
      data: newBooking,
    };
  }

  /* rest of the file remains unchanged */
}
