import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../baseQuery";
import {
  MyVehicleStatsProps,
  MyVehiclesProps,
} from "@/app/interfaces/GarageInterface";

const garageApi = createApi({
  reducerPath: "garageApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /**
     * Add a new vehicle to the server passing the vehicle object to the server
     * @param vehicle - The vehicle object to add to the server
     * @returns The vehicle object that was added to the server
     */
    addNewVehicle: builder.mutation<{ message: string }, FormData>({
      query: (formData) => ({
        url: "/api/v1/garage/add_vehicle/",
        method: "POST",
        data: formData,
      }),
    }),

    /**
     * Get all the vehicles from the server
     * @returns The vehicles that were fetched from the server
     */
    getMyVehicles: builder.query<MyVehiclesProps[], void>({
      query: () => ({
        url: "/api/v1/garage/get_vehicles/",
        method: "GET",
      }),
      transformResponse: (response: { vehicles: MyVehiclesProps[] }) =>
        response.vehicles,
    }),

    /**
     * Get the stats of a specific vehicle
     * @param vehicleId - The id of the vehicle to get the stats for
     * @returns The stats of the vehicle
     */
    getVehicleStats: builder.query<MyVehicleStatsProps, string>({
      query: (vehicleId) => ({
        url: `/api/v1/garage/get_vehicle_stats/${vehicleId}/`,
        method: "GET",
      }),
      transformResponse: (response: MyVehicleStatsProps) => response,
    }),

    /**
     * Update a specific vehicle in the server
     * @param vehicle - The vehicle object to update in the server
     * @returns The vehicle object that was updated in the server
     */
    updateVehicle: builder.mutation<MyVehiclesProps, MyVehiclesProps>({
      query: (vehicle) => ({
        url: `/api/v1/garage/update_vehicle/${vehicle.id}/`,
        method: "PATCH",
        data: vehicle,
      }),
    }),

    /**
     * Delete a specific vehicle in the server
     * @param vehicleId - The id of the vehicle to delete in the server
     * @returns The id of the vehicle that was deleted in the server
     */
    deleteVehicle: builder.mutation<{ message: string }, string>({
      query: (vehicleId) => ({
        url: `/api/v1/garage/delete_vehicle/${vehicleId}/`,
        method: "DELETE",
      }),
    }),
  }),
});
export const {
  useAddNewVehicleMutation,
  useUpdateVehicleMutation,
  useDeleteVehicleMutation,
  useGetMyVehiclesQuery,
  useGetVehicleStatsQuery,
} = garageApi;
export default garageApi;
