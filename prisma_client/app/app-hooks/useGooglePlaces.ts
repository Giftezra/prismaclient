// @expo-router-ignore - This is a utility file, not a route
import { useState, useCallback } from "react";
import { KEY_CONFIGS } from "../../constants/Config";

export interface PlacePrediction {
  description: string;
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types?: string[];
}

export interface PlaceDetails {
  place_id: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name?: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}

export interface PlacesApiResponse {
  predictions: PlacePrediction[];
  status: string;
}

export interface PlaceDetailsApiResponse {
  result: PlaceDetails;
  status: string;
}

/**
 * Get place predictions (autocomplete) as user types
 * @param input - User input text
 * @param location - Optional bias location (lat, lng) to prioritize results near user
 * @param radius - Optional radius in meters for location bias (default: 50000 = 50km)
 * @returns Array of place predictions
 */
export async function getPlacePredictions(
  input: string,
  location?: { latitude: number; longitude: number },
  radius: number = 50000
): Promise<PlacePrediction[]> {
  if (!KEY_CONFIGS.googleApiKeys) {
    console.error("Google Maps API key not configured");
    return [];
  }

  if (!input || input.length < 2) {
    return [];
  }

  try {
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
      input
    )}&key=${KEY_CONFIGS.googleApiKeys}`;

    // Add location bias if provided (helps prioritize results near user)
    if (location) {
      url += `&location=${location.latitude},${location.longitude}&radius=${radius}`;
    }

    const response = await fetch(url);
    const data: PlacesApiResponse = await response.json();

    console.log("data address predictions", data);

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Places API error:", data.status);
      return [];
    }

    return data.predictions || [];
  } catch (error) {
    console.error("Error fetching place predictions:", error);
    return [];
  }
}

/**
 * Get place details by place_id
 * @param placeId - Place ID from prediction
 * @returns Place details including coordinates and formatted address
 */
export async function getPlaceDetails(
  placeId: string
): Promise<PlaceDetails | null> {
  if (!KEY_CONFIGS.googleApiKeys) {
    console.error("Google Maps API key not configured");
    return null;
  }

  try {
    const fields = [
      "place_id",
      "formatted_address",
      "geometry",
      "name",
      "address_components",
    ].join(",");

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${KEY_CONFIGS.googleApiKeys}`;

    const response = await fetch(url);
    const data: PlaceDetailsApiResponse = await response.json();
    console.log("data address details", data);

    if (data.status !== "OK") {
      console.error("Place details API error:", data.status);
      return null;
    }

    return data.result;
  } catch (error) {
    console.error("Error fetching place details:", error);
    return null;
  }
}

/**
 * Convert place details to RoutePoint format
 * @param placeDetails - Place details from getPlaceDetails
 * @returns RoutePoint with latitude, longitude, and address
 */
export function placeDetailsToRoutePoint(placeDetails: PlaceDetails): {
  latitude: number;
  longitude: number;
  address: string;
} {
  return {
    latitude: placeDetails.geometry.location.lat,
    longitude: placeDetails.geometry.location.lng,
    address: placeDetails.formatted_address,
  };
}

/**
 * Parse address components from PlaceDetails to extract structured address fields
 * @param placeDetails - Place details from getPlaceDetails
 * @returns Object with address, post_code, city, and country
 */
export function parseAddressComponents(placeDetails: PlaceDetails): {
  address: string;
  post_code: string;
  city: string;
  country: string;
} {
  const components = placeDetails.address_components || [];

  // Helper function to find component by type
  const findComponent = (type: string) => {
    return components.find((component) => component.types.includes(type));
  };

  // Extract street number and route for address
  const streetNumber = findComponent("street_number");
  const route = findComponent("route");
  const subpremise = findComponent("subpremise"); // For apartment numbers, etc.
  const premise = findComponent("premise"); // For building names

  const addressParts = [];
  if (streetNumber) addressParts.push(streetNumber.long_name);
  if (route) addressParts.push(route.long_name);
  if (subpremise) addressParts.push(subpremise.long_name);
  if (premise) addressParts.push(premise.long_name);

  // If we have address parts, use them; otherwise use the first part of formatted_address
  const address =
    addressParts.length > 0
      ? addressParts.join(" ")
      : placeDetails.formatted_address.split(",")[0]?.trim() || "";

  // Extract postal code
  const postalCodeComponent = findComponent("postal_code");
  const postcodeComponent = findComponent("postal_code_prefix"); // Some countries use this
  const post_code =
    postalCodeComponent?.long_name || postcodeComponent?.long_name || "";

  // Extract city (prefer locality, fallback to administrative_area_level_1, then sublocality)
  const localityComponent = findComponent("locality");
  const sublocalityComponent = findComponent("sublocality");
  const cityComponent =
    localityComponent ||
    sublocalityComponent ||
    findComponent("administrative_area_level_1") ||
    findComponent("administrative_area_level_2");
  const city = cityComponent?.long_name || "";

  // Extract country
  const countryComponent = findComponent("country");
  const country = countryComponent?.long_name || "";

  return {
    address,
    post_code,
    city,
    country,
  };
}

/**
 * React hook for managing Google Places autocomplete suggestions
 * @returns Object with suggestions, loading state, error, and functions to search and get details
 */
export function useGooglePlaces() {
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Search for address suggestions based on user input
   * @param input - User input text
   * @param location - Optional location bias (lat, lng)
   */
  const searchAddresses = useCallback(
    async (
      input: string,
      location?: { latitude: number; longitude: number }
    ) => {
      if (!input || input.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const predictions = await getPlacePredictions(input, location);
        setSuggestions(predictions);
      } catch (err) {
        console.error("Error searching addresses:", err);
        setError("Failed to search addresses");
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Get place details by place_id and parse address components
   * @param placeId - Place ID from prediction
   * @returns Parsed address components or null if error
   */
  const getPlaceDetailsParsed = useCallback(async (placeId: string) => {
    try {
      const placeDetails = await getPlaceDetails(placeId);
      if (!placeDetails) {
        console.log("No place details returned");
        return null;
      }

      console.log("Place details:", placeDetails);
      console.log("Address components:", placeDetails.address_components);

      const parsed = parseAddressComponents(placeDetails);
      console.log("Parsed address components:", parsed);

      return parsed;
    } catch (err) {
      console.error("Error getting place details:", err);
      return null;
    }
  }, []);

  /**
   * Clear suggestions
   */
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    searchAddresses,
    getPlaceDetails: getPlaceDetailsParsed,
    clearSuggestions,
  };
}
