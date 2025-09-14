import React, { useCallback, useState, useEffect } from "react";
import {
  MyAddressProps,
  MyServiceHistoryProps,
  UserProfileProps,
} from "../interfaces/ProfileInterfaces";
import {
  useFetchAllUserAddressesQuery,
  useFetchAllUserServiceHistoryQuery,
  useAddNewAddressMutation,
  useUpdateExistingAddressMutation,
  useDeleteExistingAddressMutation,
} from "../store/api/profileApi";
import {
  setNewAddress,
  clearNewAddress,
} from "@/app/store/slices/profileSlice";
import { RootState, useAppDispatch, useAppSelector } from "../store/main_store";
import { useAlertContext } from "../contexts/AlertContext";
import { getUserFromStorage } from "@/app/utils/helpers/storage";
import * as SecureStore from "expo-secure-store";
const image = require("@/assets/images/user_image.jpg");

const useProfile = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state: RootState) => state.auth.user);
  const [userFromStorage, setUserFromStorage] =
    useState<UserProfileProps | null>(null);

  /* Get the new address state from the store */
  const newAddress = useAppSelector(
    (state: RootState) => state.profile.new_address
  );

  /* These are the destructured mutations for the profile screen
   * This is for the add new address, edit address, delete address.
   */
  const [
    addNewAddress,
    { isLoading: isLoadingAddAddress, error: errorAddAddress },
  ] = useAddNewAddressMutation();
  const [
    deleteExistingAddress,
    { isLoading: isLoadingDeleteAddress, error: errorDeleteAddress },
  ] = useDeleteExistingAddressMutation();
  const [
    updateExistingAddress,
    { isLoading: isLoadingUpdateAddress, error: errorUpdateAddress },
  ] = useUpdateExistingAddressMutation();

  /* import and use the alert context to display an alert to the user when a neccessary action is performed */
  const { setIsVisible, setAlertConfig } = useAlertContext();

  /**
   * Use RTK Query hooks to fetch data directly
   * The data is automatically cached and available across all components
   */
  const {
    data: addresses = [],
    isLoading: isLoadingAddresses,
    error: errorAddresses,
    refetch: refetchAddresses,
  } = useFetchAllUserAddressesQuery();

  const {
    data: serviceHistory = [],
    isLoading: isLoadingServiceHistory,
    error: errorServiceHistory,
    refetch: refetchServiceHistory,
  } = useFetchAllUserServiceHistoryQuery();

  // Load user data from storage if not available in state
  useEffect(() => {
    const loadUserFromStorage = async () => {
      if (!user && !userFromStorage) {
        try {
          const storedUser = await getUserFromStorage();
          if (storedUser) {
            setUserFromStorage(storedUser);
          }
        } catch (error) {
          console.error("Error loading user from storage:", error);
        }
      }
    };

    loadUserFromStorage();
  }, [user, userFromStorage]);

  // Use user from state first, then fallback to storage
  const currentUser = user || userFromStorage;

  const userProfile: UserProfileProps = {
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
    address: {
      address: currentUser?.address?.address || "",
      post_code: currentUser?.address?.post_code || "",
      city: currentUser?.address?.city || "",
      country: currentUser?.address?.country || "",
    },
  };

  /**
   * Collect a new user address field and store it in the newAddress state, for use.
   *
   * @param field is of interface MyAddressProps which contains the fields to be collected
   * @param value is the value of the field to be collected
   */
  const collectNewAddress = (field: keyof MyAddressProps, value: string) => {
    const currentAddress = newAddress || {
      address: "",
      post_code: "",
      city: "",
      country: "",
    };
    dispatch(setNewAddress({ ...currentAddress, [field]: value }));
  };

  /**
   * Save a new address to the user's profile on the server.
   * Validates the address data, sends it to the server, and updates the local state.
   *
   * Before sending the address to the server, check if the address is already in the
   * user's profile.
   * @returns Promise<boolean> - Returns true if address was saved successfully, false otherwise
   */
  const saveNewAddress = useCallback(async () => {
    // Validate that newAddress exists and has required fields
    if (!newAddress || !validateForm()) {
      setAlertConfig({
        title: "Error",
        message: "No address data to save",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return;
    }
    /* Ensure that the address is not already in the database.
     * Show an alert to warn the user and terminate the process.
     */
    const isDuplicate = addresses.some(
      (address) =>
        address.address.toLowerCase() === newAddress.address.toLowerCase() &&
        address.post_code.toLowerCase() ===
          newAddress.post_code.toLowerCase() &&
        address.city.toLowerCase() === newAddress.city.toLowerCase() &&
        address.country.toLowerCase() === newAddress.country.toLowerCase()
    );
    if (isDuplicate) {
      setAlertConfig({
        title: "Error",
        message: "This address already exists",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return;
    }

    try {
      /* Send the address data to the server
       */
      console.log(newAddress);
      const response = await addNewAddress(newAddress).unwrap();

      if (response && response.id && response.address) {
        // Show success message
        setAlertConfig({
          title: "Address Added",
          message: "You have successfully added a new address",
          type: "success",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
            // RTK Query will automatically update the cache
            refetchAddresses();
            dispatch(clearNewAddress());
          },
        });
      }
    } catch (error: any) {
      // Handle different types of errors
      let errorMessage = "Failed to save address. Please try again.";

      if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.status === 400) {
        errorMessage = "Invalid address data. Please check your input.";
      } else if (error?.status === 401) {
        errorMessage = "You must be logged in to save an address.";
      } else if (error?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      }

      setAlertConfig({
        title: "Error",
        message: errorMessage,
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return;
    }
  }, [
    addNewAddress,
    addresses,
    dispatch,
    newAddress,
    setAlertConfig,
    setIsVisible,
    refetchAddresses,
  ]);

  /**
   * Delete an existing address from the user's profile on the server.
   * Validates the address data, sends it to the server, and updates the local state.
   *
   * @param id is the id of the address to delete
   * @returns none
   * Display an alert to the user when the address is deleted successfully or when an error occurs.
   */
  const deleteAddress = async (id: string) => {
    try {
      const response = await deleteExistingAddress(id).unwrap();
      if (response.id && response.message) {
        setAlertConfig({
          title: "Address Deleted",
          message: response.message,
          type: "success",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
            // RTK Query will automatically update the cache
            refetchAddresses();
          },
        });
      }
    } catch (error: any) {
      let errorMessage = "Failed to delete address. Please try again.";
      if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.status === 400) {
        errorMessage = "Invalid address data. Please check your input.";
      } else if (error?.status === 401) {
        errorMessage = "You must be logged in to delete an address.";
      } else if (error?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      }
      setAlertConfig({
        title: "Error",
        message: errorMessage,
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
    }
  };

  /**
   * Validates the form before saving sending it to the server
   * If any part of the form is empty, return false
   * If all parts of the form are filled, return true
   * @returns boolean
   */
  const validateForm = (): boolean => {
    if (!newAddress?.address?.trim()) {
      return false;
    }
    if (!newAddress?.post_code?.trim()) {
      return false;
    }
    if (!newAddress.city?.trim()) {
      return false;
    }
    if (!newAddress.country?.trim()) {
      return false;
    }
    return true;
  };

  /**
   * Edit an existing address in the user's profile on the server.
   * Validates the address data, sends it to the server, and updates the local state.
   *
   * @param id is the id of the address to edit
   * @param address is the address data to edit
   * @returns none
   * Display an alert to the user when the address is edited successfully or when an error occurs.
   */
  const editAddress = async (id: string, address: MyAddressProps) => {
    try {
      const response = await updateExistingAddress({ id, address }).unwrap();
      if (response.address) {
        setAlertConfig({
          title: "Address Edited",
          message: "You have successfully edited the address",
          type: "success",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
            // RTK Query will automatically update the cache
            refetchAddresses();
          },
        });
      }
    } catch (error: any) {
      let errorMessage = "Failed to edit address. Please try again.";
      if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.status === 400) {
        errorMessage = "Invalid address data. Please check your input.";
      } else if (error?.status === 401) {
        errorMessage = "You must be logged in to edit an address.";
      } else if (error?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      }
      setAlertConfig({
        title: "Error",
        message: errorMessage,
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
    }
  };

  return {
    serviceHistory,
    userProfile,
    addresses,
    collectNewAddress,
    newAddress,
    saveNewAddress,
    deleteAddress,
    editAddress,
    isLoadingAddAddress,
    isLoadingDeleteAddress,
    isLoadingUpdateAddress,
    isLoadingAddresses,
    isLoadingServiceHistory,
    errorAddAddress,
    errorDeleteAddress,
    errorUpdateAddress,
    errorAddresses,
    errorServiceHistory,
    refetchAddresses,
    refetchServiceHistory,
  };
};

export default useProfile;
