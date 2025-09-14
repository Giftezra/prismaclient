import { useGetMyVehiclesQuery } from "../store/api/garageApi";

const useVehicles = () => {
  const {
    data: vehicles = [],
    isLoading,
    error,
    refetch,
  } = useGetMyVehiclesQuery();

  return {
    vehicles,
    isLoading,
    error, // Make sure to expose error
    refetch,
  };
};

export default useVehicles;
