import { createApi } from "@reduxjs/toolkit/query/react";
import { axiosBaseQuery } from "../baseQuery";

const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    /**
     * Login a user using the api to access the url on the server.
     * The credential passed in the body is the {UserProfileProps} which is the users main
     * data
     */
    login: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/authentication/login/",
        method: "POST",
        data: credentials,
      }),
    }),

    /**
     * Register a new user using the api to access the url on the server.
     * The credential passed in the body is the {UserProfileProps} which is the users main
     * data
     */
    register: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/onboard/create_new_account/",
        method: "POST",
        data: { credentials: credentials },
      }),
    }),

    /**
     * Refresh the access token using the api to access the url on the server.
     * The credential passed in the body is the {UserProfileProps} which is the users main
     * data
     */
    refreshToken: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/authentication/refresh/",
        method: "POST",
        data: credentials,
      }),
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
} = authApi;
export default authApi;
