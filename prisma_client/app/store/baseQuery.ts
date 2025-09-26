import { fetchBaseQuery, BaseQueryFn } from "@reduxjs/toolkit/query/react";
import store from "@/app/store/main_store";
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from "axios";
import * as SecureStore from "expo-secure-store";
import { API_CONFIG } from "@/constants/Config";

import {
  setIsAuthenticated,
  setAccessToken,
  setRefreshToken,
} from "./slices/authSlice";

// Create axios instance for RTK Query
const baseURL = API_CONFIG.customerAppUrl;
console.log("baseURL", baseURL);
const axiosInstance = axios.create({
  baseURL,
  timeout: 30000, // Increase timeout for large file uploads
});

// Request interceptor
axiosInstance.interceptors.request.use(
  async (config) => {
    const state = store.getState();
    const access =
      state.auth.access || (await SecureStore.getItemAsync("access"));

    // List of endpoints that don't require authentication
    const publicEndpoints = [
      "/api/v1/authentication/login/",
      "/api/v1/authentication/refresh/",
      "/api/v1/onboard/create_new_account/",
    ];

    // Only add Authorization header if endpoint requires auth and we have access token
    if (
      access &&
      config.headers &&
      !publicEndpoints.includes(config.url || "")
    ) {
      config.headers.Authorization = `Bearer ${access}`;
    }

    // Set Content-Type header based on data type
    if (config.data instanceof FormData) {
      // Don't set Content-Type for FormData, let axios handle it
      delete config.headers?.["Content-Type"];
    } else if (
      config.data &&
      typeof config.data === "object" &&
      !config.headers?.["Content-Type"]
    ) {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Custom base query for RTK Query using axios with token refresh
export const axiosBaseQuery = (): BaseQueryFn => {
  return async ({ url, method, data, params, headers }, api, extraOptions) => {
    try {
      const config: AxiosRequestConfig = {
        url,
        method,
        data,
        params,
        headers,
      };

      const response: AxiosResponse = await axiosInstance(config);

      return {
        data: response.data,
        meta: {
          response: response,
        },
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      // Handle 401 errors with token refresh
      if (axiosError.response?.status === 401) {
        try {
          const state = store.getState();
          const refreshToken =
            state.auth.refresh || (await SecureStore.getItemAsync("refresh"));

          if (!refreshToken) {
            store.dispatch(setIsAuthenticated(false));
            return {
              error: {
                status: 401,
                data: "Authentication failed - no refresh token",
              },
            };
          }

          // Try to refresh the token
          const refreshResponse = await axiosInstance.post(
            "/api/v1/authentication/refresh/",
            {
              refresh: refreshToken,
            }
          );

          const { access, refresh } = refreshResponse.data;
          await SecureStore.setItemAsync("access", access);
          await SecureStore.setItemAsync("refresh", refresh);

          // Update the store with new tokens
          store.dispatch(setIsAuthenticated(true));
          store.dispatch(setAccessToken(access));
          store.dispatch(setRefreshToken(refresh));

          // Retry the original request with the new token
          const retryConfig: AxiosRequestConfig = {
            url,
            method,
            data,
            params,
            headers: {
              ...headers,
              Authorization: `Bearer ${access}`,
            },
          };

          const retryResponse: AxiosResponse = await axiosInstance(retryConfig);

          return {
            data: retryResponse.data,
            meta: {
              response: retryResponse,
            },
          };
        } catch (refreshError) {
          // If refresh fails, logout the user
          store.dispatch(setIsAuthenticated(false));
          return {
            error: {
              status: 401,
              data: "Authentication failed",
            },
          };
        }
      }

      // Return other errors as normal
      return {
        error: {
          status: axiosError.response?.status,
          data: axiosError.response?.data || axiosError.message,
        },
      };
    }
  };
};

export default axiosBaseQuery;
