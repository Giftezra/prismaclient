import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/app/store/baseQuery";
import UpcomingAppointmentProps, {
  RecentServicesProps,
  UserStatsResponse,
} from "@/app/interfaces/DashboardInterfaces";

export const dashboardApi = createApi({
  reducerPath: "dashboardApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /**
     * Fetch the user's stats
     * @returns {UserStatsResponse}
     */
    fetchUserStats: builder.query<UserStatsResponse, void>({
      query: () => ({
        url: "/api/v1/dashboard/get_user_stats/",
        method: "GET",
      }),
    }),
    /**
     * The query will simply fetch all the appointments a user has scheduled but not cancelled.
     */
    fetchOngoingAppointments: builder.query<UpcomingAppointmentProps[], void>({
      query: () => ({
        url: "/api/v1/dashboard/get_upcoming_appointments/",
        method: "GET",
      }),
      transformResponse: (response: UpcomingAppointmentProps[]) => response,
    }),

    /**
     * Cancel the appointment
     * @param {appointmentId} - The id of the appointment to cancel
     * @returns {message:string}
     */
    cancelAppointment: builder.mutation<
      { message: string },
      { appointmentId: string }
    >({
      query: ({ appointmentId }) => ({
        url: `/api/v1/dashboard/cancel_appointment/`,
        method: "PATCH",
        data: { appointment_id: appointmentId },
      }),
    }),

    /**
     * Fetch the recent services
     * @returns {RecentServicesProps[]}
     */
    fetchRecentServices: builder.query<RecentServicesProps, void>({
      query: () => ({
        url: "/api/v1/dashboard/get_recent_services/",
        method: "GET",
      }),
      transformResponse: (response: RecentServicesProps) => response,
    }),

    submitReview: builder.mutation<
      any,
      {
        booking_reference: string;
        rating: number;
      }
    >({
      query: (data) => ({
        url: "/api/v1/dashboard/submit_review/",
        method: "PATCH",
        data: data,
      }),
    }),

    /**
     * Fetch detailer's current location for an appointment (for map view when within ~30 min).
     * Returns nulls when detailer has not reported location or Redis unavailable.
     */
    fetchDetailerLocation: builder.query<
      { latitude: number | null; longitude: number | null },
      string
    >({
      query: (bookingReference) => ({
        url: "/api/v1/dashboard/get_detailer_location/",
        method: "GET",
        params: { booking_reference: bookingReference },
      }),
    }),
  }),
});

export const {
  useFetchOngoingAppointmentsQuery,
  useCancelAppointmentMutation,
  useFetchRecentServicesQuery,
  useFetchUserStatsQuery,
  useSubmitReviewMutation,
  useFetchDetailerLocationQuery,
  useLazyFetchDetailerLocationQuery,
} = dashboardApi;
export default dashboardApi;
