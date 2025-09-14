import {
  ServiceTypeProps,
  ValetTypeProps,
  AddOnsProps,
  PaymentSheetResponse,
  CreateBookingProps,
} from "@/app/interfaces/BookingInterfaces";
import React, { useEffect, useCallback, useState } from "react";
import { MyVehiclesProps } from "@/app/interfaces/GarageInterface";
import {
  MyAddressProps,
  UserProfileProps,
} from "@/app/interfaces/ProfileInterfaces";
import { setServiceType, setValetType } from "@/app/store/slices/bookingSlice";
import { useAppSelector, useAppDispatch, RootState } from "../store/main_store";
import {
  useFetchServiceTypeQuery,
  useFetchValetTypeQuery,
  useFetchAddOnsQuery,
  useFetchPaymentSheetDetailsMutation,
  useBookAppointmentMutation,
  useCancelBookingMutation,
  useRescheduleBookingMutation,
} from "@/app/store/api/bookingApi";
import * as SecureStore from "expo-secure-store";
import { useAlertContext } from "@/app/contexts/AlertContext";
import dayjs from "dayjs";
import { TimeSlot, CalendarDay } from "@/app/interfaces/BookingInterfaces";
import { formatCurrency } from "@/app/utils/methods";
import { useStripe } from "@stripe/stripe-react-native";
import { loadStripe } from "@stripe/stripe-js";
import { Alert } from "react-native";
import { router } from "expo-router";
import { ReturnBookingProps } from "../interfaces/OtherInterfaces";
import useDashboard from "./useDashboard";
import { API_CONFIG } from "@/constants/Config";
/**
 * Custom hook for managing the booking process state and logic.
 *
 * This hook provides a comprehensive interface for handling the multi-step booking process,
 * including vehicle selection, service type selection, valet type selection, date/time selection,
 * address selection, and booking confirmation.
 *
 * Features:
 * - Multi-step navigation with validation
 * - Date and time selection with proper validation
 * - Price calculation with SUV surcharge
 * - Mock data management for development
 * - Booking creation and reset functionality
 *
 * @returns Object containing all booking state, handlers, and utility methods
 */
const useBooking = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.auth.user);
  const userAddress = user?.address;
  const { refetchAppointments } = useDashboard();

  /* Api hooks */

  const { data: addOns, isLoading: isLoadingAddOns } = useFetchAddOnsQuery();
  const { data: serviceTypes, isLoading: isLoadingServiceTypes } =
    useFetchServiceTypeQuery();
  const { data: valetTypes, isLoading: isLoadingValetTypes } =
    useFetchValetTypeQuery();
  const [bookAppointment, { isLoading: isLoadingBooking }] =
    useBookAppointmentMutation();

  const [cancelBooking, { isLoading: isLoadingCancelBooking }] =
    useCancelBookingMutation();
  const [rescheduleBooking, { isLoading: isLoadingRescheduleBooking }] =
    useRescheduleBookingMutation();

  const { setAlertConfig, setIsVisible } = useAlertContext();
  const [selectedVehicle, setSelectedVehicle] =
    useState<MyVehiclesProps | null>(null);
  const [selectedServiceType, setSelectedServiceType] =
    useState<ServiceTypeProps | null>(null);
  const [selectedValetType, setSelectedValetType] =
    useState<ValetTypeProps | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<MyAddressProps | null>(
    null
  );
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [specialInstructions, setSpecialInstructions] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSUV, setIsSUV] = useState<boolean>(false);

  // Addon management state
  const [selectedAddons, setSelectedAddons] = useState<AddOnsProps[]>([]);
  const [isAddonModalVisible, setIsAddonModalVisible] =
    useState<boolean>(false);

  // Time slot management state
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState<boolean>(false);
  const [currentMonth, setCurrentMonth] = useState<dayjs.Dayjs>(
    dayjs(selectedDate)
  );
  const [selectedDay, setSelectedDay] = useState<dayjs.Dayjs>(
    dayjs(selectedDate)
  );

  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [fetchPaymentSheetDetails] = useFetchPaymentSheetDetailsMutation();

  /**
   * Fetches payment sheet details from the server
   *
   * @param finalPrice - The total price in euros
   * @returns Promise that resolves to payment sheet details
   */
  const fetchPaymentSheetDetailsFromServer = useCallback(
    async (finalPrice: number): Promise<PaymentSheetResponse> => {
      try {
        const amountInCents = Math.round(finalPrice * 100);
        const response = await fetchPaymentSheetDetails(amountInCents).unwrap();
        return response;
      } catch (error) {
        console.error("Error fetching payment sheet details:", error);
        throw error;
      }
    },
    [fetchPaymentSheetDetails]
  );

  /**
   * The method is designed to initialize the payment sheet when the checkout page is opened.
   * Call the fetchPaymentSheetDetails method to fetch the payment sheet details from the server.
   * Then call the initPaymentSheet method to initialize the payment sheet.
   */
  const initializePaymentSheet = useCallback(
    async (finalPrice: number) => {
      /* Get the user and address from the state since this is stored in the state when the user is logged in.
       * Use the address to get the country code and currency code.
       * Set the country code to GBP if the user is in the United Kingdom.
       * Set the country code to EUR if the user is in not in the United Kingdom.
       */
      const address = userAddress;
      let countryCode = "GB";

      if (address?.country === "United Kingdom") {
        countryCode = "GB";
      } else {
        countryCode = "GB";
      }

      try {
        const { paymentIntent, ephemeralKey, customer } =
          await fetchPaymentSheetDetailsFromServer(finalPrice);

        const { error } = await initPaymentSheet({
          paymentIntentClientSecret: paymentIntent,
          merchantDisplayName: "Prisma Valet",
          customerEphemeralKeySecret: ephemeralKey,
          customerId: customer,
          applePay: {
            merchantCountryCode: countryCode,
          },
          googlePay: {
            merchantCountryCode: countryCode,
            testEnv: true,
            currencyCode: countryCode,
          },
        });

        if (error) {
          throw error;
        }
      } catch (error: any) {
        console.error("Error initializing payment sheet:", error);
        throw error;
      }
    },
    [fetchPaymentSheetDetailsFromServer, initPaymentSheet, userAddress]
  );

  /**
   * The method is designed to open the payment sheet when clicked on the checkout page.
   * Call the initializePaymentSheet method to initialize the payment sheet first on the server.
   * Then call the presentPaymentSheet method to present the payment sheet to the user.
   */
  const openPaymentSheet = useCallback(
    async (finalPrice: number) => {
      try {
        await initializePaymentSheet(finalPrice);
        const { error } = await presentPaymentSheet();

        if (error) {
          // Handle specific Stripe payment errors
          let errorMessage = "An error occurred during payment";
          let errorTitle = "Payment Error";

          // Handle specific Stripe payment errors based on error type
          if (error.code === "Canceled") {
            // User cancelled the payment
            errorMessage = "Payment was cancelled";
            errorTitle = "Payment Cancelled";
          } else if (error.code === "Failed") {
            // Payment failed (insufficient funds, card declined, etc.)
            errorMessage =
              "Payment failed. Please check your payment method and try again.";
            errorTitle = "Payment Failed";
          } else {
            // Use the error message from Stripe if available
            errorMessage = error.message || errorMessage;
          }

          setAlertConfig({
            title: errorTitle,
            message: errorMessage,
            type: "error",
            isVisible: true,
            onConfirm() {
              setIsVisible(false);
            },
          });

          // Don't throw the error for user cancellations, just return false
          if (error.code === "Canceled") {
            return false;
          }

          throw error;
        }

        return true;
      } catch (error: any) {
        console.error("Error in payment process:", error);

        // Handle network or initialization errors
        let errorMessage = "An error occurred during payment";
        let errorTitle = "Payment Error";

        if (error.message?.includes("network")) {
          errorMessage =
            "Network error. Please check your connection and try again.";
          errorTitle = "Connection Error";
        } else if (error.message?.includes("timeout")) {
          errorMessage = "Request timed out. Please try again.";
          errorTitle = "Timeout Error";
        }

        setAlertConfig({
          title: errorTitle,
          message: errorMessage,
          type: "error",
          isVisible: true,
          onConfirm() {
            setIsVisible(false);
          },
        });
        throw error;
      }
    },
    [initializePaymentSheet, presentPaymentSheet, setAlertConfig]
  );

  /**
   * Helper function to calculate total service duration including addons
   *
   * @param customAddons - Optional custom addon selection to use instead of current state
   * @returns Total service duration in minutes
   */
  const calculateTotalServiceDuration = useCallback(
    (customAddons?: AddOnsProps[]) => {
      const baseServiceDuration = selectedServiceType?.duration || 60;
      const addonsToUse = customAddons || selectedAddons;
      const addonExtraDuration = addonsToUse.reduce(
        (total, addon) => total + addon.extra_duration,
        0
      );
      const totalServiceDuration = baseServiceDuration + addonExtraDuration;

      console.log("Calculated total service duration:", totalServiceDuration);
      console.log("Base service duration:", baseServiceDuration);
      console.log("Addon extra duration:", addonExtraDuration);

      return totalServiceDuration;
    },
    [selectedServiceType, selectedAddons]
  );

  /**
   * Fetches available time slots from the server for a specific date
   *
   * This method makes an API call to retrieve available booking time slots
   * for a given date, service duration, and location. It validates that
   * required address information is available before making the request.
   *
   * The API call includes:
   * - Date in YYYY-MM-DD format
   * - Service duration in minutes
   * - Country and city for location-based availability
   *
   * Expected response format from detailer server:
   * {
   *   slots: [
   *     {
   *       start_time: "13:00",
   *       end_time: "14:30",
   *       is_available: true
   *     },
   *     ...
   *   ]
   * }
   *
   * @param date - The date to check for available slots
   * @param customDuration - Optional custom duration to use instead of calculating from state
   * @type {dayjs.Dayjs}
   * @returns Promise that resolves to the API response data
   * @type {Promise<any>}
   *
   * @throws {Error} If address information is missing or API call fails
   *
   * @example
   * try {
   *   const slots = await fetchAvailableTimeSlots(dayjs('2024-01-15'));
   *   console.log('Available slots:', slots);
   * } catch (error) {
   *   console.error('Failed to fetch slots:', error);
   * }
   */
  const fetchAvailableTimeSlots = useCallback(
    async (date: dayjs.Dayjs): Promise<any> => {
      // Check if we have the required address information
      if (!selectedAddress?.country || !selectedAddress?.city) {
        const errorMessage =
          "Address information (country/city) is required to fetch timeslots";
        setAlertConfig({
          title: "Error",
          message: errorMessage,
          type: "error",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
          },
        });
        throw new Error(errorMessage);
      }

      setIsLoadingSlots(true);

      try {
        // Create URL with query parameters for GET request
        const url = new URL(
          `${API_CONFIG.detailerAppUrl}/api/v1/availability/get_timeslots/`
        );
        url.searchParams.append("date", date.format("YYYY-MM-DD"));
        // Calculate total service duration including addon extra time
        const totalServiceDuration = calculateTotalServiceDuration();

        url.searchParams.append(
          "service_duration",
          totalServiceDuration.toString()
        );
        url.searchParams.append("country", selectedAddress?.country || "");
        url.searchParams.append("city", selectedAddress?.city || "");

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Transform the detailer server response format to our TimeSlot interface
        const transformedSlots: TimeSlot[] = [];

        // Check for the correct response format (slots array)
        if (data.slots && Array.isArray(data.slots)) {
          data.slots.forEach((slot: any, index: number) => {
            if (slot.is_available && slot.start_time && slot.end_time) {
              transformedSlots.push({
                startTime: slot.start_time,
                endTime: slot.end_time,
                isAvailable: slot.is_available,
                isSelected: false, // Reset selection when fetching new slots
              });
            }
          });
        } else if (
          data.available_slots &&
          Array.isArray(data.available_slots)
        ) {
          data.available_slots.forEach((slot: any, index: number) => {
            if (slot.is_available && slot.start_time && slot.end_time) {
              transformedSlots.push({
                startTime: slot.start_time,
                endTime: slot.end_time,
                isAvailable: slot.is_available,
                isSelected: false, // Reset selection when fetching new slots
              });
            }
          });
        }

        // If no slots were transformed, show a message to the user
        if (transformedSlots.length === 0) {
          setAlertConfig({
            title: "No Available Times",
            message:
              "No available time slots found for the selected date. Please try a different date.",
            type: "success",
            isVisible: true,
            onConfirm: () => {
              setIsVisible(false);
            },
          });
        }

        // Update available time slots with the transformed response
        setAvailableTimeSlots(transformedSlots);

        return data;
      } catch (error) {
        console.error("Error fetching timeslots:", error);
        setAvailableTimeSlots([]);
        throw error;
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [
      calculateTotalServiceDuration,
      selectedAddress,
      setAlertConfig,
      setIsVisible,
    ]
  );

  /**
   * Checks if a time slot has been selected by the user
   *
   * This method determines if the user has selected a specific time slot
   * by checking if the selected date has a time that matches one of the
   * available time slots.
   *
   * @returns True if a time slot is selected, false otherwise
   * @type {boolean}
   *
   * @example
   * const hasSelectedTime = hasSelectedTimeSlot(); // Returns true if user selected a time
   */
  const hasSelectedTimeSlot = useCallback((): boolean => {
    if (availableTimeSlots.length === 0) return false;

    return availableTimeSlots.some((slot) => slot.isSelected);
  }, [availableTimeSlots]);

  /**
   * Handles time slot selection
   *
   * This method updates the selected date and time when a user chooses
   * a specific time slot. It creates a new Date object with the selected
   * time while preserving the current date.
   *
   * @param slot - The time slot object that was selected
   * @type {TimeSlot}
   *
   * @example
   * const slot = { startTime: "14:30", endTime: "15:30", isAvailable: true, isSelected: false };
   * handleTimeSlotSelect(slot);
   * // Updates selectedDate to 2:30 PM on the current date
   */
  const handleTimeSlotSelect = useCallback(
    (slot: TimeSlot) => {
      if (!slot.isAvailable) return;

      const [hours, minutes] = slot.startTime.split(":").map(Number);
      const newDate = new Date(selectedDate);
      newDate.setHours(hours, minutes, 0, 0);
      setSelectedDate(newDate);

      // Update the availableTimeSlots to mark the selected slot
      setAvailableTimeSlots((prevSlots) =>
        prevSlots.map((s) => ({
          ...s,
          isSelected:
            s.startTime === slot.startTime && s.endTime === slot.endTime,
        }))
      );
    },
    [selectedDate]
  );

  /**
   * Generates calendar days for the current month
   *
   * This method creates an array of calendar day objects for display
   * in the calendar component. It includes information about each day's
   * status (current month, selected, today, disabled).
   *
   * @param currentMonth - The month to generate days for
   * @type {dayjs.Dayjs}
   * @param selectedDay - The currently selected day
   * @type {dayjs.Dayjs}
   * @param minimumDate - The minimum allowed date
   * @type {Date}
   * @returns Array of calendar day objects
   * @type {CalendarDay[]}
   *
   * @example
   * const calendarDays = generateCalendarDays(dayjs(), dayjs('2024-01-15'), new Date());
   * // Returns array of calendar days with status information
   */
  const generateCalendarDays = useCallback(
    (
      currentMonth: dayjs.Dayjs,
      selectedDay: dayjs.Dayjs,
      minimumDate: Date
    ): CalendarDay[] => {
      const days: CalendarDay[] = [];
      const startOfMonth = currentMonth.startOf("month");
      const endOfMonth = currentMonth.endOf("month");
      const startOfWeek = startOfMonth.startOf("week");
      const endOfWeek = endOfMonth.endOf("week");

      let currentDay = startOfWeek;

      while (
        currentDay.isBefore(endOfWeek) ||
        currentDay.isSame(endOfWeek, "day")
      ) {
        const isCurrentMonth = currentDay.month() === currentMonth.month();
        const isSelected = currentDay.isSame(selectedDay, "day");
        const isToday = currentDay.isSame(dayjs(), "day");
        const isDisabled = currentDay.isBefore(dayjs(minimumDate), "day");

        days.push({
          date: currentDay,
          isCurrentMonth,
          isSelected,
          isToday,
          isDisabled,
        });

        currentDay = currentDay.add(1, "day");
      }

      return days;
    },
    []
  );

  /**
   * Handles month navigation in the calendar
   *
   * This method updates the current month state when users navigate
   * between months in the calendar view.
   *
   * @param direction - The direction to navigate ('prev' or 'next')
   * @type {'prev' | 'next'}
   *
   * @example
   * handleMonthNavigation('next'); // Moves to next month
   * handleMonthNavigation('prev'); // Moves to previous month
   */
  const handleMonthNavigation = useCallback(
    (direction: "prev" | "next") => {
      if (direction === "prev") {
        setCurrentMonth(currentMonth.subtract(1, "month"));
      } else {
        setCurrentMonth(currentMonth.add(1, "month"));
      }
    },
    [currentMonth]
  );

  /**
   * Handles day selection in the calendar
   *
   * This method updates the selected day and fetches available time slots
   * for the newly selected date. It validates that the selected date is
   * not before the minimum allowed date.
   *
   * @param dateString - The selected date as a string (YYYY-MM-DD format)
   * @type {string}
   *
   * @example
   * handleDaySelection('2024-01-15'); // Selects January 15, 2024 and fetches slots
   */
  const handleDaySelection = useCallback(
    async (dateString: string) => {
      const day = dayjs(dateString);
      const minimumDate = new Date();

      if (day.isBefore(dayjs(minimumDate), "day")) return;

      setSelectedDay(day);
      setCurrentMonth(day);

      // Update selected date while preserving the current time
      const newDate = new Date(selectedDate);
      newDate.setFullYear(day.year(), day.month(), day.date());
      setSelectedDate(newDate);

      // Fetch available time slots for the selected date
      try {
        await fetchAvailableTimeSlots(day);
      } catch (error) {
        console.error("Failed to fetch time slots:", error);
        // Clear available slots if API fails
        setAvailableTimeSlots([]);
      }
    },
    [selectedDate, fetchAvailableTimeSlots]
  );

  // ============================================================================
  // SELECTION HANDLERS
  // ============================================================================

  /**
   * Handles vehicle selection in the booking process
   *
   * This method updates the selected vehicle state when a user chooses a vehicle
   * from their garage. The selected vehicle will be used for the booking.
   *
   * @param vehicle - The vehicle object selected by the user
   * @type {MyVehiclesProps}
   *
   * @example
   * const vehicle = { id: "1", model: "Civic", make: "Honda", ... };
   * handleVehicleSelection(vehicle);
   * // Updates selectedVehicle state to the provided vehicle
   */
  const handleVehicleSelection = useCallback((vehicle: MyVehiclesProps) => {
    setSelectedVehicle(vehicle);
  }, []);

  /**
   * Handles SUV surcharge toggle
   *
   * This method updates the SUV surcharge state. When a vehicle is marked as an SUV,
   * an additional surcharge is applied to the booking price.
   *
   * @param suv - Boolean indicating if the vehicle is an SUV
   * @type {boolean}
   *
   * @example
   * handleSUVChange(true);  // Enables SUV surcharge
   * handleSUVChange(false); // Disables SUV surcharge
   */
  const handleSUVChange = useCallback((suv: boolean) => {
    setIsSUV(suv);
  }, []);

  /**
   * Handles service type selection in the booking process
   *
   * This method updates the selected service type state when a user chooses
   * a service from the available options. The service type determines the
   * base price and duration of the booking.
   *
   * @param serviceType - The service type object selected by the user
   * @type {ServiceTypeProps}
   *
   * @example
   * const serviceType = { id: "1", name: "Basic Wash", price: 25, duration: 30, ... };
   * handleServiceTypeSelection(serviceType);
   * // Updates selectedServiceType state to the provided service type
   */
  const handleServiceTypeSelection = useCallback(
    async (serviceType: ServiceTypeProps) => {
      setSelectedServiceType(serviceType);
      // Re-fetch time slots if we have a selected date and address
      if (selectedAddress?.country && selectedAddress?.city && selectedDay) {
        try {
          await fetchAvailableTimeSlots(selectedDay);
        } catch (error) {
          console.error(
            "Failed to re-fetch time slots after service type change:",
            error
          );
          setAvailableTimeSlots([]);
        }
      }
    },
    [selectedAddress, selectedDay, fetchAvailableTimeSlots]
  );

  /**
   * Handles valet type selection in the booking process
   *
   * This method updates the selected valet type state when a user chooses
   * a valet method from the available options. The valet type determines
   * the cleaning approach used. After selecting a valet type, the addon
   * selection modal is automatically shown.
   *
   * @param valetType - The valet type object selected by the user
   * @type {ValetTypeProps}
   *
   * @example
   * const valetType = { id: "1", name: "Traditional Wash", description: "Standard water-based cleaning" };
   * handleValetTypeSelection(valetType);
   * // Updates selectedValetType state and shows addon modal
   */
  const handleValetTypeSelection = useCallback(
    async (valetType: ValetTypeProps) => {
      setSelectedValetType(valetType);
      // Show addon selection modal after valet type selection
      setIsAddonModalVisible(true);
      // Re-fetch time slots if we have a selected date and address
      if (selectedAddress?.country && selectedAddress?.city && selectedDay) {
        try {
          await fetchAvailableTimeSlots(selectedDay);
        } catch (error) {
          console.error(
            "Failed to re-fetch time slots after valet type change:",
            error
          );
          setAvailableTimeSlots([]);
        }
      }
    },
    [selectedAddress, selectedDay, fetchAvailableTimeSlots]
  );

  /**
   * Handles address selection in the booking process
   *
   * This method updates the selected address state when a user chooses
   * a service location from their saved addresses.
   *
   * @param address - The address object selected by the user
   * @type {MyAddressProps}
   *
   * @example
   * const address = { address: "123 Main Street", post_code: "SW1A 1AA", ... };
   * handleAddressSelection(address);
   * // Updates selectedAddress state to the provided address
   */
  const handleAddressSelection = useCallback((address: MyAddressProps) => {
    setSelectedAddress(address);
  }, []);

  /**
   * Handles addon selection in the booking process
   *
   * This method toggles the selection state of an addon. If the addon is
   * already selected, it removes it from the selection. If it's not selected,
   * it adds it to the selection.
   *
   * @param addon - The addon object to toggle selection for
   * @type {AddOnsProps}
   *
   * @example
   * const addon = { id: "1", name: "Interior Protection", price: 15, extra_duration: 30 };
   * handleAddonSelection(addon);
   * // Toggles the addon selection state
   */
  const handleAddonSelection = useCallback((addon: AddOnsProps) => {
    setSelectedAddons((prevAddons) => {
      const isAlreadySelected = prevAddons.some(
        (selected) => selected.id === addon.id
      );

      if (isAlreadySelected) {
        // Remove addon if already selected
        return prevAddons.filter((selected) => selected.id !== addon.id);
      } else {
        // Add addon if not selected
        return [...prevAddons, addon];
      }
    });
  }, []);

  /**
   * Handles addon selection and re-fetches time slots with updated duration
   *
   * This method updates the selected addons and then re-fetches available time slots
   * for the currently selected date with the new total duration (including addon time).
   * This ensures that when users modify their addon selection, the available time slots
   * reflect the correct duration requirements.
   *
   * @param addon - The addon to toggle selection for
   * @type {AddOnsProps}
   *
   * @example
   * handleAddonSelectionWithRefresh(addon);
   * // Updates addon selection and re-fetches time slots
   */
  const handleAddonSelectionWithRefresh = useCallback(
    async (addon: AddOnsProps) => {
      // Calculate the new addon selection state
      const isAlreadySelected = selectedAddons.some(
        (selected) => selected.id === addon.id
      );

      let newSelectedAddons: AddOnsProps[];
      if (isAlreadySelected) {
        // Remove addon if already selected
        newSelectedAddons = selectedAddons.filter(
          (selected) => selected.id !== addon.id
        );
      } else {
        // Add addon if not selected
        newSelectedAddons = [...selectedAddons, addon];
      }

      // Update the state
      setSelectedAddons(newSelectedAddons);

      // Calculate the new total duration with the updated addons
      const totalServiceDuration =
        calculateTotalServiceDuration(newSelectedAddons);

      console.log(
        "Addon selection changed - New total duration:",
        totalServiceDuration
      );

      // Re-fetch time slots with the new duration
      if (selectedAddress?.country && selectedAddress?.city && selectedDay) {
        try {
          // Create URL with query parameters for GET request
          const url = new URL(
            `${API_CONFIG.detailerAppUrl}/api/v1/availability/get_timeslots/`
          );
          url.searchParams.append("date", selectedDay.format("YYYY-MM-DD"));
          url.searchParams.append(
            "service_duration",
            totalServiceDuration.toString()
          );
          url.searchParams.append("country", selectedAddress?.country || "");
          url.searchParams.append("city", selectedAddress?.city || "");

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          // Transform the detailer server response format to our TimeSlot interface
          const transformedSlots: TimeSlot[] = [];

          // Check for the correct response format (slots array)
          if (data.slots && Array.isArray(data.slots)) {
            data.slots.forEach((slot: any, index: number) => {
              if (slot.is_available && slot.start_time && slot.end_time) {
                transformedSlots.push({
                  startTime: slot.start_time,
                  endTime: slot.end_time,
                  isAvailable: slot.is_available,
                  isSelected: false, // Reset selection when fetching new slots
                });
              }
            });
          } else if (
            data.available_slots &&
            Array.isArray(data.available_slots)
          ) {
            data.available_slots.forEach((slot: any, index: number) => {
              if (slot.is_available && slot.start_time && slot.end_time) {
                transformedSlots.push({
                  startTime: slot.start_time,
                  endTime: slot.end_time,
                  isAvailable: slot.is_available,
                  isSelected: false, // Reset selection when fetching new slots
                });
              }
            });
          }

          // If no slots were transformed, show a message to the user
          if (transformedSlots.length === 0) {
            setAlertConfig({
              title: "No Available Times",
              message:
                "No available time slots found for the selected date. Please try a different date.",
              type: "success",
              isVisible: true,
              onConfirm: () => {
                setIsVisible(false);
              },
            });
          }

          // Update available time slots with the transformed response
          setAvailableTimeSlots(transformedSlots);
        } catch (error) {
          console.error(
            "Failed to re-fetch time slots after addon change:",
            error
          );
          setAvailableTimeSlots([]);
        }
      }
    },
    [
      selectedAddons,
      calculateTotalServiceDuration,
      selectedAddress,
      selectedDay,
      setAlertConfig,
      setIsVisible,
    ]
  );

  /**
   * Handles closing the addon selection modal
   *
   * This method closes the addon selection modal and allows the user
   * to continue with the booking process.
   *
   * @example
   * handleCloseAddonModal();
   * // Closes the addon selection modal
   */
  const handleCloseAddonModal = useCallback(() => {
    setIsAddonModalVisible(false);
  }, []);

  /**
   * Handles confirming addon selection
   *
   * This method closes the addon selection modal and allows the user
   * to proceed to the next step in the booking process.
   *
   * @example
   * handleConfirmAddons();
   * // Closes the modal and continues with booking
   */
  const handleConfirmAddons = useCallback(() => {
    setIsAddonModalVisible(false);
  }, []);

  /**
   * Handles date and time selection from the TimeSlotPicker component
   *
   * This method is called by the TimeSlotPicker when a user selects
   * a new date or time. The date parameter includes both date and time information.
   *
   * The method updates the selected date state and triggers time slot fetching
   * if the date has changed. It also validates that required address information
   * is available before making API calls.
   *
   * @param date - The selected date and time
   * @type {Date}
   *
   * @example
   * const selectedDateTime = new Date('2024-01-15T14:30:00');
   * handleDateChange(selectedDateTime);
   * // Updates selectedDate state and fetches available time slots
   */
  const handleDateChange = useCallback(
    async (date: Date) => {
      setSelectedDate(date);

      // Update selected day state
      const newSelectedDay = dayjs(date);
      setSelectedDay(newSelectedDay);

      // Only fetch time slots if we have address information
      if (selectedAddress?.country && selectedAddress?.city) {
        try {
          await fetchAvailableTimeSlots(newSelectedDay);
        } catch (error) {
          console.error("Failed to fetch time slots:", error);
          // Clear available slots if API fails
          setAvailableTimeSlots([]);
        }
      }
    },
    [selectedAddress, fetchAvailableTimeSlots]
  );

  /**
   * Handles special instructions text changes
   *
   * This method updates the special instructions state when a user enters
   * additional notes or requirements for their booking.
   *
   * @param instructions - The special instructions text entered by the user
   * @type {string}
   *
   * @example
   * handleSpecialInstructionsChange("Please pay extra attention to the interior");
   * // Updates specialInstructions state to the provided text
   */
  const handleSpecialInstructionsChange = useCallback(
    (instructions: string) => {
      setSpecialInstructions(instructions);
    },
    []
  );

  /**
   * Advances to the next step in the booking process
   *
   * This method moves the user to the next step in the multi-step booking flow.
   * It only advances if the current step is valid (all required fields are completed).
   *
   * The booking process has 5 steps:
   * 1. Vehicle Selection
   * 2. Service Type Selection
   * 3. Valet Type Selection
   * 4. Date, Time, and Location Selection
   * 5. Summary and Confirmation
   *
   * @example
   * handleNextStep();
   * // Advances from step 1 to step 2 if step 1 is valid
   */
  const handleNextStep = useCallback(() => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  /**
   * Returns to the previous step in the booking process
   *
   * This method moves the user back to the previous step in the booking flow.
   * Users can always go back to previous steps to modify their selections.
   *
   * @example
   * handlePreviousStep();
   * // Moves from step 3 back to step 2
   */
  const handlePreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  /**
   * Navigates to a specific step in the booking process
   *
   * This method allows direct navigation to any step in the booking flow.
   * Users can only navigate to steps that are valid (previous steps or current step).
   *
   * @param step - The step number to navigate to (1-5)
   * @type {number}
   *
   * @example
   * handleGoToStep(3); // Navigates directly to step 3 (Valet Type Selection)
   */
  const handleGoToStep = useCallback((step: number) => {
    if (step >= 1 && step <= 5) {
      setCurrentStep(step);
    }
  }, []);

  // ============================================================================
  // VALIDATION METHODS
  // ============================================================================

  /**
   * Validates if a specific step is complete and valid
   *
   * This method checks if all required fields for a specific step are completed.
   * It's used to determine if users can proceed to the next step or navigate to a step.
   *
   * Validation rules for each step:
   * - Step 1 (Vehicle): Must have a selected vehicle
   * - Step 2 (Service): Must have a selected service type
   * - Step 3 (Valet): Must have a selected valet type
   * - Step 4 (Details): Must have a selected address and valid date (future date)
   * - Step 5 (Summary): Always valid (read-only)
   *
   * @param step - The step number to validate (1-5)
   * @type {number}
   * @returns True if the step is valid, false otherwise
   * @type {boolean}
   *
   * @example
   * const isValid = isStepValid(2); // Returns true if a service type is selected
   */
  const isStepValid = useCallback(
    (step: number): boolean => {
      switch (step) {
        case 1: // Vehicle selection
          return selectedVehicle !== null;
        case 2: // Service type selection
          return selectedServiceType !== null;
        case 3: // Valet type selection
          return selectedValetType !== null;
        case 4: // Date, time, and location
          return (
            selectedAddress !== null &&
            selectedDate > new Date() &&
            hasSelectedTimeSlot()
          );
        case 5: // Summary and confirmation
          return true;
        default:
          return false;
      }
    },
    [
      selectedVehicle,
      selectedServiceType,
      selectedValetType,
      selectedAddress,
      selectedDate,
      hasSelectedTimeSlot,
    ]
  );

  /**
   * Checks if the user can proceed to the next step
   *
   * This method validates the current step to determine if the user can
   * advance to the next step in the booking process.
   *
   * @param step - The current step number
   * @type {number}
   * @returns True if the user can proceed, false otherwise
   * @type {boolean}
   *
   * @example
   * const canProceed = canProceedToNextStep(2); // Returns true if service type is selected
   */
  const canProceedToNextStep = useCallback(
    (step: number): boolean => {
      return isStepValid(step);
    },
    [isStepValid]
  );

  /**
   * Checks if all required fields are completed to proceed to summary
   *
   * This method validates that all required booking information is completed
   * before allowing the user to proceed to the summary and confirmation step.
   *
   * Required fields:
   * - Vehicle selection
   * - Service type selection
   * - Valet type selection
   * - Address selection
   * - Valid date (future date)
   *
   * @returns True if all required fields are completed, false otherwise
   * @type {boolean}
   *
   * @example
   * const canProceed = canProceedToSummary(); // Returns true if all fields are completed
   */
  const canProceedToSummary = useCallback((): boolean => {
    return (
      selectedVehicle !== null &&
      selectedServiceType !== null &&
      selectedValetType !== null &&
      selectedAddress !== null &&
      selectedDate > new Date() &&
      hasSelectedTimeSlot()
    );
  }, [
    selectedVehicle,
    selectedServiceType,
    selectedValetType,
    selectedAddress,
    selectedDate,
    hasSelectedTimeSlot,
  ]);

  /**
   * Calculates the total price including SUV surcharge and addon costs
   *
   * This method calculates the final price for the booking by adding
   * the base service price, addon costs, and any applicable surcharges (like SUV surcharge).
   *
   * Price calculation:
   * - Base price: From selected service type
   * - Addon costs: Sum of all selected addon prices
   * - SUV surcharge: 15% of total price (base + addons) if vehicle is marked as SUV
   * - Total = Base price + Addon costs + SUV surcharge
   *
   * @returns The total price in euros
   * @type {number}
   *
   * @example
   * const totalPrice = getTotalPrice(); // Returns 108.75 if base price is 75, addons cost 18.75, and SUV surcharge is 15% of 93.75
   */
  const getTotalPrice = useCallback((): number => {
    const basePrice = selectedServiceType?.price || 0;
    const addonCosts = selectedAddons.reduce(
      (total, addon) => total + addon.price,
      0
    );
    const totalBeforeSurcharge = basePrice + addonCosts;
    const suvSurcharge = isSUV ? totalBeforeSurcharge * 0.15 : 0;
    return totalBeforeSurcharge + suvSurcharge;
  }, [selectedServiceType, isSUV, selectedAddons]);

  /**
   * Gets the base price of the selected service
   *
   * This method returns the base price of the selected service type,
   * excluding any surcharges or additional fees.
   *
   * @returns The base service price in euros
   * @type {number}
   *
   * @example
   * const basePrice = getBasePrice(); // Returns 75 for Standard Detail service
   */
  const getBasePrice = useCallback((): number => {
    return selectedServiceType?.price || 0;
  }, [selectedServiceType]);

  /**
   * Gets the SUV surcharge amount
   *
   * This method returns the SUV surcharge amount if the vehicle is marked as an SUV.
   * The surcharge is a 10 percent increase on the total price (base price + addon costs).
   *
   * @returns The SUV surcharge amount (10% of total price if SUV, 0 otherwise)
   * @type {number}
   *
   * @example
   * const suvPrice = getSUVPrice(); // Returns 14.06 if total price is 93.75 and isSUV is true, 0 otherwise
   */
  const getSUVPrice = useCallback((): number => {
    const basePrice = selectedServiceType?.price || 0;
    const addonCosts = selectedAddons.reduce(
      (total, addon) => total + addon.price,
      0
    );
    const totalBeforeSurcharge = basePrice + addonCosts;
    return isSUV ? totalBeforeSurcharge * 0.1 : 0;
  }, [isSUV, selectedServiceType, selectedAddons]);

  /**
   * Gets the total cost of selected addons
   *
   * This method calculates the total cost of all selected addons by summing
   * their individual prices.
   *
   * @returns The total addon cost
   * @type {number}
   *
   * @example
   * const addonCost = getAddonPrice(); // Returns 25 if two addons cost 10 and 15
   */
  const getAddonPrice = useCallback((): number => {
    // if the user select three addons, remove the cheapest addon price
    if (selectedAddons.length >= 3) {
      const cheapestAddon = selectedAddons.reduce((min, addon) =>
        addon.price < min.price ? addon : min
      );
      return (
        selectedAddons.reduce((total, addon) => total + addon.price, 0) -
        cheapestAddon.price
      );
    }
    return selectedAddons.reduce((total, addon) => total + addon.price, 0);
  }, [selectedAddons]);

  /**
   * Gets the total extra duration from selected addons
   *
   * This method calculates the total extra time required for all selected addons
   * by summing their individual extra_duration values.
   *
   * @returns The total extra duration in minutes
   * @type {number}
   *
   * @example
   * const extraTime = getAddonDuration(); // Returns 45 if two addons add 20 and 25 minutes
   */
  const getAddonDuration = useCallback((): number => {
    return selectedAddons.reduce(
      (total, addon) => total + addon.extra_duration,
      0
    );
  }, [selectedAddons]);

  /**
   * Gets the estimated duration of the selected service including addons
   *
   * This method returns the estimated duration of the selected service type
   * plus any additional time required for selected addons.
   * The duration is used for calculating available time slots and scheduling.
   *
   * @returns The estimated duration in minutes (service + addons)
   * @type {number}
   *
   * @example
   * const duration = getEstimatedDuration(); // Returns 120 for 90min service + 30min addon
   */
  const getEstimatedDuration = useCallback((): number => {
    const serviceDuration = selectedServiceType?.duration || 0;
    const addonDuration = getAddonDuration();
    return serviceDuration + addonDuration;
  }, [selectedServiceType, getAddonDuration]);

  /**
   * Formats a price value to euro currency string
   *
   * This method formats a numeric price value into a properly formatted
   * euro currency string with two decimal places.
   *
   * @param price - The price value to format
   * @type {number}
   * @returns Formatted price string (e.g., "€25.00")
   * @type {string}
   *
   * @example
   * const formattedPrice = formatPrice(25); // Returns "€25.00"
   * const formattedPrice = formatPrice(75.5); // Returns "€75.50"
   */
  const formatPrice = useCallback(
    (price: number): string => {
      return formatCurrency(price);
    },
    [formatCurrency]
  );

  /**
   * Formats duration in minutes to a human-readable string
   *
   * This method converts a duration in minutes to a user-friendly format
   * that displays hours and minutes appropriately.
   *
   * @param minutes - The duration in minutes
   * @type {number}
   * @returns Formatted duration string (e.g., "1h 30m", "45m")
   * @type {string}
   *
   * @example
   * const duration = formatDuration(90); // Returns "1h 30m"
   * const duration = formatDuration(45); // Returns "45m"
   * const duration = formatDuration(120); // Returns "2h"
   */
  const formatDuration = useCallback((minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }, []);

  /**
   * Creates a new booking appointment
   *
   * This method creates a new booking appointment with all the selected
   * information. It validates all required fields before creating the booking
   * and simulates an API call to the backend.
   *
   * The booking includes:
   * - Appointment ID (auto-generated)
   * - Booking date (current date)
   * - Service date and time
   * - Vehicle information
   * - Service and valet type details
   * - Detailer assignment
   * - Address information
   * - Total amount
   * - Status (scheduled)
   *
   * @returns Promise that resolves to the created booking or null if failed
   * @type {Promise<BookedAppointmentProps | null>}
   *
   * @throws {Error} If required fields are not completed
   *
   * @example
   * try {
   *   const booking = await createBooking();
   *   if (booking) {
   *     console.log('Booking created:', booking.appointment_id);
   *   }
   * } catch (error) {
   *   console.error('Booking failed:', error.message);
   * }
   */
  const createBooking = async () => {
    if (!canProceedToSummary()) {
      setAlertConfig({
        title: "Error",
        message: "Please complete all required fields before booking",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return null;
    }

    try {
      // Calculate end time by adding total service duration to start time
      const startTime = selectedDate;
      const totalDurationMinutes = calculateTotalServiceDuration();
      const endTime = new Date(
        startTime.getTime() + totalDurationMinutes * 60 * 1000
      );
      /* Arrange the data to be sent to the detailer app stack */
      const bookingData: CreateBookingProps = {
        client_name: user?.name || "",
        client_phone: user?.phone || "",
        vehicle_registration: selectedVehicle?.licence || "",
        vehicle_make: selectedVehicle?.make || "",
        vehicle_model: selectedVehicle?.model || "",
        vehicle_year: selectedVehicle?.year.toString() || "",
        vehicle_color: selectedVehicle?.color || "",
        address: selectedAddress?.address || "",
        city: selectedAddress?.city || "",
        postcode: selectedAddress?.post_code || "",
        country: selectedAddress?.country || "",
        latitude: user?.latitude || 0,
        longitude: user?.longitude || 0,
        valet_type: selectedValetType?.name || "",
        addons: selectedAddons.map((addon) => addon.name || ""),
        special_instructions: specialInstructions || "",
        total_amount: getTotalPrice(),
        status: "pending",
        booking_reference: `APT${Date.now()}-${user?.id}`,
        service_type: selectedServiceType?.name || "",
        booking_date: selectedDate?.toISOString().split("T")[0] || "",
        start_time: startTime.toISOString().split("T")[1].replace("Z", ""),
        end_time: endTime.toISOString().split("T")[1].replace("Z", ""),
      };
      /* Send the data to the detailer app stack and append the booking data to the url as params
       * The stack returns the DetailerProfileProps
       */
      const url = new URL(
        `${API_CONFIG.detailerAppUrl}/api/v1/booking/create_booking/`
      );
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bookingData),
      });
      const data = await response.json();
      return data;
    } catch (error: any) {
      let message = "";
      if (error?.data?.error) {
        message = error.data.error;
      } else if (error?.status === 400) {
        message = "Not created booking. Please try again.";
      } else if (error?.status === 401) {
        message = "You must be logged in to create a booking.";
      } else if (error?.status === 500) {
        message = "Server error. Please try again later.";
      }
      setAlertConfig({
        title: "Error",
        message: message,
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return null;
    }
  };

  /**
   * Resets all booking state to initial values
   *
   * This method clears all booking selections and returns the booking
   * process to its initial state. It's typically called after a successful
   * booking or when the user wants to start over.
   *
   * Resets the following state:
   * - selectedVehicle: null
   * - selectedServiceType: null
   * - selectedValetType: null
   * - selectedAddress: null
   * - selectedDate: current date
   * - specialInstructions: empty string
   * - currentStep: 1
   * - isSUV: false
   * - selectedAddons: empty array
   * - isAddonModalVisible: false
   *
   * @example
   * resetBooking();
   * // All booking state is reset to initial values
   */
  const resetBooking = useCallback(() => {
    setSelectedVehicle(null);
    setSelectedServiceType(null);
    setSelectedValetType(null);
    setSelectedAddress(null);
    setSelectedDate(new Date());
    setSpecialInstructions("");
    setCurrentStep(1);
    setIsSUV(false);
    setSelectedAddons([]);
    setIsAddonModalVisible(false);
  }, []);

  /**
   * Handles the complete booking confirmation flow including payment and booking creation
   *
   * This method orchestrates the entire booking confirmation process:
   * 1. Processes payment through Stripe
   * 2. Creates the booking if payment is successful
   * 3. Shows success/error messages to the user
   * 4. Handles navigation after successful booking
   *
   * @example
   * handleBookingConfirmation();
   * // Processes payment and creates booking
   */
  const handleBookingConfirmation = useCallback(async () => {
    try {
      setIsLoading(true);

      // First, handle payment
      const totalPrice = getTotalPrice();
      const paymentResult = await openPaymentSheet(totalPrice);

      // If payment was cancelled, don't proceed with booking
      if (paymentResult === false) {
        return;
      }
      /* if payment is successful, create the booking */
      const booking: ReturnBookingProps = await createBooking();
      /* When the data is returned trigger the create appointment api call */
      if (booking.detailer && booking.job) {
        const response = await bookAppointment({
          date: selectedDate?.toISOString().split("T")[0] || "",
          vehicle: selectedVehicle!,
          valet_type: selectedValetType!,
          service_type: selectedServiceType!,
          detailer: booking.detailer,
          address: selectedAddress!,
          status: "pending",
          total_amount: getTotalPrice(),
          addons: selectedAddons,
          start_time: selectedDate
            ?.toISOString()
            .split("T")[1]
            .replace("Z", ""),
          duration: getEstimatedDuration(),
          special_instructions: specialInstructions,
          booking_reference: booking.job.booking_reference,
        }).unwrap();

        /* If the appointment is created successfully, show the success message */
        if (response) {
          let message = `Your booking has been assigned to one of our detailers.\n\nYour booking reference is ${booking.job.booking_reference}.\n\nKeep an eye on your email for the booking confirmation.\n\nThank you for choosing PrismaValet!`;
          setAlertConfig({
            title: "Booking Confirmed!",
            message: message,
            type: "success",
            isVisible: true,
            onConfirm: () => {
              setIsVisible(false);
              resetBooking();
              refetchAppointments();
              router.push("/main/(tabs)/dashboard/DashboardScreen");
            },
          });
        }
      }
    } catch (error) {
      console.error("Booking confirmation failed:", error);
      setAlertConfig({
        title: "Booking Failed",
        message: "Please try again or contact support.",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    openPaymentSheet,
    getTotalPrice,
    createBooking,
    resetBooking,
    refetchAppointments,
  ]);

  const handleCancelBooking = useCallback(
    async (bookingReference: string) => {
      /* Confirm the cancellation */
      try {
        setAlertConfig({
          title: "Booking Cancellation",
          message:
            "You are about to cancel your booking. Is there there something you would like to change?",
          type: "warning",
          isVisible: true,
          onConfirm: async () => {
            const response = await cancelBooking(bookingReference).unwrap();
            if (response) {
              setAlertConfig({
                title: "Booking Cancelled",
                message: response,
                type: "success",
                isVisible: true,
                onConfirm: () => {
                  setIsVisible(false);
                  refetchAppointments();
                },
              });
            } else {
              setAlertConfig({
                title: "Booking Cancellation Failed",
                message: "Failed to cancel booking",
                type: "error",
                isVisible: true,
                onConfirm: () => {
                  setIsVisible(false);
                },
              });
            }
          },
          onClose: () => {
            setIsVisible(false);
          },
        });
      } catch (error: any) {
        let message = "Failed to cancel booking";
        if (error?.data?.error) {
          message = error.data.error;
        }
        setAlertConfig({
          title: "Error",
          message: message,
          type: "error",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
          },
        });
      }
    },
    [cancelBooking, setAlertConfig, setIsVisible]
  );

  const handleRescheduleBooking = useCallback(
    async (
      bookingId: string,
      newDate: string,
      newTime: string,
      totalCost?: number
    ) => {
      try {
        const response = await rescheduleBooking({
          booking_id: bookingId,
          new_date: newDate,
          new_time: newTime,
        }).unwrap();
        if (response) {
          setAlertConfig({
            title: "Booking Rescheduled",
            message: response,
            type: "success",
            isVisible: true,
            onConfirm: () => {
              setIsVisible(false);
            },
          });
        }
      } catch (error: any) {
        let message = "Failed to reschedule booking";
        if (error?.data?.error) {
          message = error.data.error;
        }
        setAlertConfig({
          title: "Error",
          message: message,
          type: "error",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
          },
        });
      }
    },
    [rescheduleBooking, setAlertConfig, setIsVisible]
  );

  return {
    // State
    selectedVehicle,
    selectedServiceType,
    selectedValetType,
    selectedAddress,
    selectedDate,
    specialInstructions,
    currentStep,
    isLoading,
    isSUV,
    selectedAddons,
    isAddonModalVisible,
    availableTimeSlots,
    isLoadingSlots,
    currentMonth,
    selectedDay,
    addOns,
    serviceTypes,
    valetTypes,
    isLoadingAddOns,
    isLoadingServiceTypes,
    isLoadingValetTypes,
    handleVehicleSelection,
    handleSUVChange,
    handleServiceTypeSelection,
    handleValetTypeSelection,
    handleAddressSelection,
    handleDateChange,
    handleSpecialInstructionsChange,
    handleNextStep,
    handlePreviousStep,
    handleGoToStep,

    // Addon management handlers
    handleAddonSelection,
    handleAddonSelectionWithRefresh,
    handleCloseAddonModal,
    handleConfirmAddons,

    // Time slot management handlers
    fetchAvailableTimeSlots,
    handleTimeSlotSelect,
    handleDaySelection,
    handleMonthNavigation,
    generateCalendarDays,
    hasSelectedTimeSlot,

    // Validation
    isStepValid,
    canProceedToNextStep,
    canProceedToSummary,

    // Booking
    createBooking,
    resetBooking,

    // Utilities
    getTotalPrice,
    getBasePrice,
    getSUVPrice,
    getAddonPrice,
    getAddonDuration,
    getEstimatedDuration,
    formatPrice,
    formatDuration,
    formatCurrency,
    handleBookingConfirmation,
    isLoadingBooking,
    handleRescheduleBooking,
    isLoadingRescheduleBooking,

    // Booking cancellation
    handleCancelBooking,
    isLoadingCancelBooking,
  };
};

export default useBooking;
