import { useCallback, useState, useEffect } from "react";
import { Alert } from "react-native";
import {
  MyVehiclesProps,
  MyVehicleStatsProps,
  PromotionsProps,
} from "../interfaces/GarageInterface";
import { createNewVehicle, resetNewVehicle } from "../store/slices/garageSlice";
import { RootState, useAppDispatch, useAppSelector } from "../store/main_store";
import { useAlertContext } from "../contexts/AlertContext";
import {
  useAddNewVehicleMutation,
  useDeleteVehicleMutation,
  useGetMyVehiclesQuery,
  useGetVehicleStatsQuery,
} from "../store/api/garageApi";
import { router } from "expo-router";
import { formatCurrency, formatDate } from "@/app/utils/methods";
import { useSnackbar } from "../contexts/SnackbarContext";
/**
 * Custom hook for managing garage-related functionality including vehicle management.
 *
 * This hook provides comprehensive functionality for:
 * - Managing vehicle data and state
 * - Form validation and submission
 * - Integration with Redux store for state management
 *
 * @returns {Object} An object containing:
 *   - State values: vehicles, vehicleStats, isModalVisible, newVehicle
 *   - State setters: setIsModalVisible
 *   - Vehicle methods: handleAddNewVehicle, handleSubmit
 */
const useGarage = () => {
  const dispatch = useAppDispatch();
  const garage = useAppSelector((state: RootState) => state.garage);
  const { showSnackbarWithConfig } = useSnackbar();

  const [vehicleId, setVehicleId] = useState<string>("");

  /* Destructure the mutations here  */
  const [
    addNewVehicle,
    { isLoading: isAddingNewVehicle, error: addNewVehicleError },
  ] = useAddNewVehicleMutation();
  const [
    deleteVehicle,
    { isLoading: isDeletingVehicle, error: deleteVehicleError },
  ] = useDeleteVehicleMutation();
  const {
    data: vehicles = [],
    isLoading: isLoadingVehicles,
    refetch: refetchVehicles,
  } = useGetMyVehiclesQuery();

  // Get vehicle stats for the first vehicle (if available)
  const {
    data: vehicleStatsData,
    isLoading: isLoadingVehicleStats,
    refetch: refetchVehicleStats,
  } = useGetVehicleStatsQuery(vehicleId, {
    skip: !vehicleId,
  });

  const [vehicleStats, setVehicleStats] = useState<MyVehicleStatsProps>({
    vehicle: null,
    total_bookings: 0,
    total_amount: 0,
    last_cleaned: "",
    next_recommended_service: "",
  });

  // Update vehicleStats when vehicles or vehicleStatsData are loaded
  useEffect(() => {
    if (vehicles.length > 0 && vehicleStatsData) {
      setVehicleStats(vehicleStatsData);
    } else if (vehicles.length > 0) {
      // Set default stats with vehicle info if no stats data available
      setVehicleStats((prev) => ({
        ...prev,
        vehicle: vehicles[0],
      }));
    }
  }, [vehicles, vehicleStatsData]);

  /* Get the state values here */
  const garageState = useAppSelector((state: RootState) => state.garage);
  const newVehicle = garageState?.newVehicle || null;

  /* import the alert context which will be used to render an alert */
  const { setAlertConfig, setIsVisible } = useAlertContext();
  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleVehicleStatsSelection = useCallback(
    (vehicleId: string) => {
      setVehicleId(vehicleId);
    },
    [setVehicleId]
  );

  /**
   * Updates a specific field in the newVehicle state object.
   * This method is used to handle form input changes for vehicle information.
   * Creates a new vehicle object with the updated field value while preserving existing data.
   *
   * @param {string} field - The field name to update (e.g., 'make', 'model', 'year', 'color', 'licence', 'image')
   * @param {string | any} value - The new value to set for the specified field
   *
   * @example
   * handleAddNewVehicle('make', 'Toyota');
   * handleAddNewVehicle('year', '2020');
   * handleAddNewVehicle('image', imageAsset);
   */
  const collectNewVehicleData = (field: string, value: string | any) => {
    const updatedVehicle = {
      ...(newVehicle || {}),
      [field]: value,
    } as MyVehiclesProps;
    dispatch(createNewVehicle(updatedVehicle));
  };

  /**
   * Prepares FormData object for vehicle upload to the API.
   * Converts all vehicle fields to the format expected by the server.
   *
   * Handles:
   * - Basic vehicle fields (make, model, year, color, licence)
   * - Proper FormData structure for multipart/form-data requests
   *
   * @returns {Promise<FormData | null>} A Promise that resolves to FormData object or null if no vehicle data
   */
  const prepareVehicleFormData = async (): Promise<FormData | null> => {
    if (!newVehicle) return null;
    const formData = new FormData();
    if (newVehicle.make) formData.append("make", newVehicle.make);
    if (newVehicle.model) formData.append("model", newVehicle.model);
    if (newVehicle.year) formData.append("year", newVehicle.year.toString());
    if (newVehicle.color) formData.append("color", newVehicle.color);
    if (newVehicle.licence) formData.append("licence", newVehicle.licence);

    return formData;
  };

  /**
   * Handles the form submission for adding a new vehicle.
   * Validates that all required fields are filled before submission.
   * Prepares FormData for server upload and dispatches loading state.
   * Creates the new vehicle in the Redux store and shows success/error alerts.
   *
   * @throws {Error} If validation fails or vehicle creation encounters an error
   */
  const handleSubmit = useCallback(async () => {
    // Validate required fields
    if (
      !newVehicle?.make ||
      !newVehicle?.model ||
      !newVehicle?.year ||
      !newVehicle?.licence ||
      !newVehicle?.color
    ) {
      setAlertConfig({
        title: "Missing Information",
        message: "Please fill in all required fields.",
        type: "error",
        isVisible: true,
        onConfirm() {
          setIsVisible(false);
        },
      });
      return;
    }

    // Validate the year is a number and is between 1900 and the current year
    if (
      isNaN(Number(newVehicle.year)) ||
      Number(newVehicle.year) < 1900 ||
      Number(newVehicle.year) > new Date().getFullYear()
    ) {
      setAlertConfig({
        title: "Invalid Year",
        message: "Please enter a valid year.",
        type: "error",
        isVisible: true,
        onConfirm() {
          setIsVisible(false);
        },
      });
      return;
    }

    try {
      /* Prepare the formData for the server submission
       * If the formData is not prepared, throw an error
       * if the formData is valid, call the addNewVehicle mutation
       */
      const formData = await prepareVehicleFormData();

      if (formData) {
        const response = await addNewVehicle(formData).unwrap();
        console.log("Vehicle submission response:", response);
        if (response && response.message) {
          setAlertConfig({
            title: "Success",
            message: response.message,
            type: "success",
            isVisible: true,
            onConfirm() {
              setIsVisible(false);
              dispatch(resetNewVehicle());
            },
          });
        }
      } else {
        throw new Error("Failed to prepare vehicle data for submission");
      }
    } catch (error: any) {
      console.log("Vehicle submission error:", error);

      /* If the error is thrown, call the alert and the dispatch {setIsLoading} */
      let errorMessage = "Failed to add vehicle. Please try again.";
      if (error?.data?.error) {
        errorMessage = error.data.error;
      } else if (error?.status === 400) {
        errorMessage = "Invalid vehicle data. Please check your input.";
      } else if (error?.status === 401) {
        errorMessage = "You must be logged in to add a vehicle.";
      } else if (error?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setAlertConfig({
        title: "Error",
        message: errorMessage,
        type: "error",
        isVisible: true,
        onConfirm() {
          setIsVisible(false);
        },
      });
    }
  }, [
    newVehicle,
    dispatch,
    setAlertConfig,
    setIsVisible,
    addNewVehicle,
    refetchVehicles,
  ]);

  /**
   * Delete a specific vehicle using the deleteVehicle mutation
   * @param vehicleId - The id of the vehicle to delete
   * @returns {string} message - Message from the server telling the user that the vehicle has been deleted
   *
   *
   */
  const handleDeleteVehicle = useCallback(
    async (vehicleId: string) => {
      console.log("vehicleId", vehicleId);
      try {
        setAlertConfig({
          title: "Deleting Vehicle",
          message: "Please wait while we delete the vehicle",
          type: "warning",
          isVisible: true,
          onConfirm: async () => {
            const response = await deleteVehicle(vehicleId).unwrap();
            if (response.message && response) {
              // show snackbar
              showSnackbarWithConfig({
                message: response.message,
                type: "success",
                duration: 3000,
              });
              refetchVehicles();
            }
          },
          onClose: () => {
            setIsVisible(false);
          },
        });
      } catch (error: any) {
        let errorMessage = "Failed to delete vehicle. Please try again.";
        if (error?.data?.error) {
          errorMessage = error.data.error;
        }
        showSnackbarWithConfig({
          message: errorMessage,
          type: "error",
          duration: 3000,
        });
      }
    },
    [deleteVehicle, setAlertConfig, setIsVisible, refetchVehicles]
  );

  /**
   * Handle viewing vehicle details by fetching vehicle stats and details
   * @param vehicleId - The id of the vehicle to view details for
   */
  const handleViewDetailsPress = useCallback(
    async (vehicleId: string) => {
      try {
        // Set the vehicle ID to trigger the stats query
        setVehicleId(vehicleId);

        // Refetch vehicle stats to get the latest data
        const result = await refetchVehicleStats();

        // Check if we got valid data
        if (result.data) {
          // Data is loaded successfully, the modal will be shown by the parent component
          return true;
        } else {
          throw new Error("No data received from server");
        }
      } catch (error: any) {
        let errorMessage = "Failed to fetch vehicle details. Please try again.";
        if (error?.data?.error) {
          errorMessage = error.data.error;
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
        return false;
      }
    },
    [setVehicleId, refetchVehicleStats, setAlertConfig, setIsVisible]
  );

  return {
    vehicles,
    vehicleStats,
    isModalVisible,
    newVehicle,
    isLoadingVehicles,
    isLoadingVehicleStats,
    isAddingNewVehicle,
    setIsModalVisible,
    handleVehicleStatsSelection,
    collectNewVehicleData,
    handleSubmit,
    prepareVehicleFormData,
    handleDeleteVehicle,
    handleViewDetailsPress,
    refetchVehicleStats,
    refetchVehicles,
  };
};

export default useGarage;
