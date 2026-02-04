import { createApi } from "@reduxjs/toolkit/query/react";
import axiosBaseQuery from "@/app/store/baseQuery";
import {
  MyAddressProps,
  UserProfileProps,
} from "@/app/interfaces/ProfileInterfaces";

const profileApi = createApi({
  reducerPath: "profileApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /**
     * Get the user addresses using a query that will query all the addresses for the user.
     * on the server side, we will simply return all the addresses for the user.
     */
    fetchAllUserAddresses: builder.query<MyAddressProps[], void>({
      query: () => ({
        url: "/api/v1/profile/get_addresses/",
        method: "GET",
      }),
      transformResponse: (response: { addresses: MyAddressProps[] }) =>
        response.addresses,
    }),
    /**
     * Add a new address to the user's profile.
     * on the server side, we will simply add the new address to the user's profile.
     */
    addNewAddress: builder.mutation<MyAddressProps, MyAddressProps>({
      query: (address) => ({
        url: "/api/v1/profile/add_new_address/",
        method: "POST",
        data: address,
      }),
    }),
    /**
     * Update an existing address in the user's profile.
     * on the server side, we will simply update the existing address in the user's profile.
     */
    updateExistingAddress: builder.mutation<
      MyAddressProps,
      {
        id: string;
        address: MyAddressProps;
      }
    >({
      query: (address) => ({
        url: `/api/v1/profile/update_address/`,
        method: "PATCH",
        data: address,
      }),
    }),
    /**
     * Delete an existing address in the user's profile.
     * on the server side, we will simply delete the existing address in the user's profile.
     */
    deleteExistingAddress: builder.mutation<
      { id: string; message: string },
      string
    >({
      query: (id) => ({
        url: `/api/v1/profile/delete_address/`,
        method: "DELETE",
        data: { id },
      }),
    }),

    /**
     * Update the push notification token of the user.
     * on the server side, we will simply update the push notification token of the user.
     */
    updatePushNotificationToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_push_notification_token/",
        method: "PATCH",
        data: { update },
      }),
    }),


    /**
     * Update the email notification token of the user.
     * on the server side, we will simply update the email notification token of the user.
     */
    updateEmailNotificationToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_email_notification_token/",
        method: "PATCH",
        data: { update },
      }),
    }),

    /**
     * Update the marketing email token of the user.
     * on the server side, we will simply update the marketing email token of the user.
     */
    updateMarketingEmailToken: builder.mutation({
      query: ({ update }) => ({
        url: "/api/v1/profile/update_marketing_email_token/",
        method: "PATCH",
        data: { update },
      }),
    }),


    /**
     * Get the user's profile.
     * on the server side, we will simply return the user's profile.
     */
    getUserProfile: builder.query<UserProfileProps, void>({
      query: () => ({
        url: "/api/v1/profile/get_profile/",
        method: "GET",
      }),
      transformResponse: (response: { profile: UserProfileProps }) =>
        response.profile,
    }),
    
  }),
});

export const {
  useFetchAllUserAddressesQuery,
  useAddNewAddressMutation,
  useUpdateExistingAddressMutation,
  useDeleteExistingAddressMutation,
  useUpdatePushNotificationTokenMutation,
  useUpdateEmailNotificationTokenMutation,
  useUpdateMarketingEmailTokenMutation,
  useGetUserProfileQuery,
} = profileApi;
export default profileApi;
