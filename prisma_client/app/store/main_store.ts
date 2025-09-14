import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer from "./slices/authSlice";
import garageReducer from "./slices/garageSlice";
import dashboardReducer from "./slices/dashboardSlice";
import profileReducer from "./slices/profileSlice";
import authApi from "./api/authApi";
import garageApi from "./api/garageApi";
import dashboardApi from "./api/dashboardApi";
import profileApi from "./api/profileApi";
import bookingReducer from "./slices/bookingSlice";
import bookingApi from "./api/bookingApi";
import notificationApi from "./api/notificationApi";

const store = configureStore({
  reducer: {
    auth: authReducer,
    garage: garageReducer,
    dashboard: dashboardReducer,
    profile: profileReducer,
    booking: bookingReducer,
    [authApi.reducerPath]: authApi.reducer,
    [garageApi.reducerPath]: garageApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [profileApi.reducerPath]: profileApi.reducer,
    [bookingApi.reducerPath]: bookingApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      garageApi.middleware,
      dashboardApi.middleware,
      profileApi.middleware,
      bookingApi.middleware,
      notificationApi.middleware,
    ),
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = useSelector;
