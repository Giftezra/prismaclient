import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "../baseQuery";
import {
  BranchProps,
  FleetDashboardStats,
  BranchAdminCreateProps,
  BranchVehiclesResponse,
  BranchSpendResponse,
  VehicleBookingsResponse,
  BranchAdminsResponse,
} from "@/app/interfaces/FleetInterfaces";

const fleetApi = createApi({
  reducerPath: "fleetApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /**
     * Create a new branch for the fleet
     * ARGS: { name: string, address?: string, postcode?: string, city?: string, country?: string }
     * RESPONSE: { message: string, branch: BranchProps }
     */
    createBranch: builder.mutation<
      { message: string; branch: BranchProps },
      { name: string; address?: string; postcode?: string; city?: string; country?: string }
    >({
      query: (data) => ({
        url: "/api/v1/fleet/create_branch/",
        method: "POST",
        data,
      }),
    }),

    /**
     * Get all branches for the fleet
     * ARGS: void
     * RESPONSE: { branches: BranchProps[] }
     */
    getBranches: builder.query<{ branches: BranchProps[] }, void>({
      query: () => ({
        url: "/api/v1/fleet/get_branches/",
        method: "GET",
      }),
    }),

    /**
     * Create a branch admin account
     * ARGS: BranchAdminCreateProps
     * RESPONSE: { message: string, admin: { id, name, email, phone, branch_id, branch_name } }
     */
    createBranchAdmin: builder.mutation<
      {
        message: string;
        admin: {
          id: number;
          name: string;
          email: string;
          phone: string;
          branch_id: string;
          branch_name: string;
        };
      },
      BranchAdminCreateProps
    >({
      query: (data) => ({
        url: "/api/v1/fleet/create_branch_admin/",
        method: "POST",
        data,
      }),
    }),

    /**
     * Get fleet dashboard data
     * ARGS: { start_date?: string, end_date?: string } | void
     * RESPONSE: FleetDashboardStats
     */
    getFleetDashboard: builder.query<
      FleetDashboardStats,
      { start_date?: string; end_date?: string } | void
    >({
      query: (params) => {
        const queryParams: Record<string, string> = {};
        if (params && typeof params === "object") {
          if (params.start_date) {
            queryParams.start_date = params.start_date;
          }
          if (params.end_date) {
            queryParams.end_date = params.end_date;
          }
        }
        return {
          url: "/api/v1/fleet/get_fleet_dashboard/",
          method: "GET",
          params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        };
      },
      transformResponse: (response: FleetDashboardStats) => response,
    }),

    /**
     * Get vehicles for a specific branch
     * ARGS: { branch_id: string }
     * RESPONSE: BranchVehiclesResponse
     */
    getBranchVehicles: builder.query<
      BranchVehiclesResponse,
      { branch_id: string }
    >({
      query: ({ branch_id }) => ({
        url: `/api/v1/fleet/get_branch_vehicles/${branch_id}/`,
        method: "GET",
      }),
    }),

    /**
     * Update a branch
     * ARGS: { branch_id: string, name?: string, address?: string, postcode?: string, city?: string, country?: string, spend_limit?: number, spend_limit_period?: 'weekly'|'monthly' }
     * RESPONSE: { message: string, branch: BranchProps }
     */
    updateBranch: builder.mutation<
      { message: string; branch: BranchProps },
      {
        branch_id: string;
        name?: string;
        address?: string;
        postcode?: string;
        city?: string;
        country?: string;
        spend_limit?: number;
        spend_limit_period?: "weekly" | "monthly";
      }
    >({
      query: (data) => ({
        url: `/api/v1/fleet/update_branch/${data.branch_id}/`,
        method: "PATCH",
        data,
      }),
    }),

    /**
     * Get branch spend (limit, spent, remaining). Fleet owner: pass branch_id. Branch admin: no args.
     * RESPONSE: BranchSpendResponse
     */
    getBranchSpend: builder.query<
      BranchSpendResponse,
      { branch_id?: string } | void
    >({
      query: (arg) => ({
        url: "/api/v1/fleet/get_branch_spend/",
        method: "GET",
        params: arg && typeof arg === "object" && arg.branch_id
          ? { branch_id: arg.branch_id }
          : undefined,
      }),
    }),

    /**
     * Delete a branch
     * ARGS: { branch_id: string }
     * RESPONSE: { message: string }
     */
    deleteBranch: builder.mutation<
      { message: string },
      { branch_id: string }
    >({
      query: ({ branch_id }) => ({
        url: `/api/v1/fleet/delete_branch/${branch_id}/`,
        method: "DELETE",
      }),
    }),

    /**
     * Get bookings for a specific vehicle (last 90 days)
     * ARGS: { vehicle_id: string }
     * RESPONSE: VehicleBookingsResponse
     */
    getVehicleBookings: builder.query<
      VehicleBookingsResponse,
      { vehicle_id: string }
    >({
      query: ({ vehicle_id }) => ({
        url: `/api/v1/fleet/get_vehicle_bookings/${vehicle_id}/`,
        method: "GET",
      }),
    }),

    /**
     * Get branch admins for a specific branch
     * ARGS: { branch_id: string }
     * RESPONSE: BranchAdminsResponse
     */
    getBranchAdmins: builder.query<
      BranchAdminsResponse,
      { branch_id: string }
    >({
      query: ({ branch_id }) => ({
        url: `/api/v1/fleet/get_branch_admins/${branch_id}/`,
        method: "GET",
      }),
    }),
  }),
});

export const {
  useCreateBranchMutation,
  useGetBranchesQuery,
  useCreateBranchAdminMutation,
  useGetFleetDashboardQuery,
  useGetBranchVehiclesQuery,
  useGetBranchSpendQuery,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  useGetVehicleBookingsQuery,
  useGetBranchAdminsQuery,
} = fleetApi;

export default fleetApi;
