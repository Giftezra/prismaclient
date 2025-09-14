import { UserProfileProps } from "@/app/interfaces/ProfileInterfaces";
import * as SecureStore from "expo-secure-store";

/**
 * Save the user data to the async storage after login.
 * This is used when the user tries to relogin,
 * @param user The returned user data which is of interface {User | Seller}
 * @param access The access token returned from the server
 * @param refresh The refresh token returned from the server
 */
export const saveDataToStorage = async (
  user: UserProfileProps | null,
  access: string,
  refresh: string
) => {
  try {
    await SecureStore.setItemAsync("user", JSON.stringify(user));
    await SecureStore.setItemAsync("access", access);
    await SecureStore.setItemAsync("refresh", refresh);
    console.log("Data saved to storage");
  } catch (error) {
    console.error("Error saving data to storage:", error);
  }
};

/**
 * Retrieve user data from storage
 * @returns Promise<UserProfileProps | null> - Returns user data if found, null otherwise
 */
export const getUserFromStorage =
  async (): Promise<UserProfileProps | null> => {
    try {
      const userData = await SecureStore.getItemAsync("user");
      if (userData) {
        return JSON.parse(userData);
      }
      return null;
    } catch (error) {
      console.error("Error retrieving user data from storage:", error);
      return null;
    }
  };
