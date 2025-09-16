import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "../baseQuery";
import {
  BookingScreenProps,
  ServiceTypeProps,
  ValetTypeProps,
  AddOnsProps,
  PaymentSheetResponse,
  CreateBookingProps,
  BookedAppointmentProps,
} from "@/app/interfaces/BookingInterfaces";
import { PromotionsProps } from "@/app/interfaces/GarageInterface";

const createBookingApi = createApi({
  reducerPath: "bookingApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /**
     * Fetch the service types defined by the admin on the server.
     * ARGS : void
     * RESPONSE : ServiceTypeProps[]
     * {
     *  id : string
     *  name : string
     *  description : string[]
     *  price : number
     *  duration : number
     * }
     */
    fetchServiceType: builder.query<ServiceTypeProps[], void>({
      query: () => ({
        url: "/api/v1/booking/get_service_type/",
        method: "GET",
      }),
    }),
    /**
     * Fetch all vallet type which are the type of washes a user prefers to have
     * ARGS : void
     * RESPONSE : ValetTypeProps[]
     * {
     *  id : string
     *  name : string
     *  description : string
     * }
     * This would either be a steam wash, a regular water based wash or a no water wash
     */
    fetchValetType: builder.query<ValetTypeProps[], void>({
      query: () => ({
        url: "/api/v1/booking/get_valet_type/",
        method: "GET",
      }),
    }),

    /**
     * Book the appointment for the client.
     * ARGS : BookedAppointmentProps
     * RESPONSE : {
     *  appointment_id: string
     *  success: boolean
     * }
     */
    bookAppointment: builder.mutation<
      { appointment_id: string },
      BookedAppointmentProps
    >({
      query: (data) => ({
        url: "/api/v1/booking/book_appointment/",
        method: "POST",
        data: { booking_data: data },
      }),
    }),

    /**
     * Fetch the add ons for the user to choose from
     * ARGS : void
     * RESPONSE : AddOnsProps[]
     * {
     *  id : string
     *  name : string
     *  price : number
     *  description : string
     *  extra_duration : number
     * }
     */
    fetchAddOns: builder.query<AddOnsProps[], void>({
      query: () => ({
        url: "/api/v1/booking/get_add_ons/",
        method: "GET",
      }),
      transformResponse: (response: AddOnsProps[]) => {
        return response;
      },
    }),

    /**
     * Cancel a booking for the user.
     * ARGS : void
     * RESPONSE : string of the message from the server
     * QUERY_PARAMS : booking_id : string
     */
    cancelBooking: builder.mutation<string, string>({
      query: (booking_reference) => ({
        url: `/api/v1/booking/cancel_booking/`,
        method: "PATCH",
        data: { booking_reference },
      }),
    }),

    /**
     * Reschedule a booking for the user.
     * ARGS : void
     * RESPONSE : void
     * QUERY_PARAMS : booking_id : string
     * {
     *  service_type : string
     *  valet_type : string
     *  booking_date : string
     *  special_instructions : string
     * }
     */
    rescheduleBooking: builder.mutation<
      string,
      {
        new_date: string;
        new_time: string;
        booking_id: string;
      }
    >({
      query: (data) => ({
        url: `/api/v1/booking/reschedule_booking/`,
        method: "PATCH",
        data: { data },
      }),
    }),

    /**
     * Fetch the payment sheet details from the server.
     * ARGS : number (amount in cents)
     * RESPONSE : PaymentSheetResponse
     * {
     *  paymentIntent: string
     *  ephemeralKey: string
     *  customer: string
     * }
     */
    fetchPaymentSheetDetails: builder.mutation<PaymentSheetResponse, number>({
      query: (amount) => ({
        url: "/api/v1/booking/get_payment_sheet_details/",
        method: "POST",
        data: { amount },
      }),
    }),

    /* Get the promotions for the user */
    fetchPromotions: builder.query<PromotionsProps | null, void>({
      query: () => ({
        url: "/api/v1/booking/get_promotions/",
        method: "GET",
      }),
      transformResponse: (response: PromotionsProps | null) => response,
    }),
  }),
});
export const {
  useFetchServiceTypeQuery,
  useFetchValetTypeQuery,
  useBookAppointmentMutation,
  useCancelBookingMutation,
  useRescheduleBookingMutation,
  useFetchAddOnsQuery,
  useFetchPaymentSheetDetailsMutation,
  useFetchPromotionsQuery,
} = createBookingApi;
export default createBookingApi;
