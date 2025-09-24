import { Stack } from "expo-router";
import { Provider } from "react-redux";
import store from "./store/main_store";
import ThemeProvider from "./contexts/ThemeProvider";
import AuthContextProvider from "./contexts/AuthContextProvider";
import { AlertProvider } from "./contexts/AlertContext";
import { SnackbarProvider } from "./contexts/SnackbarContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import NotificationInitializer from "./components/notification/NotificationInitializer";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ThemeProvider>
          <AlertProvider>
            <SnackbarProvider>
              <AuthContextProvider>
                <NotificationInitializer>
                  <GestureHandlerRootView>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="onboarding" />
                      <Stack.Screen name="main" />
                    </Stack>
                  </GestureHandlerRootView>
                </NotificationInitializer>
              </AuthContextProvider>
            </SnackbarProvider>
          </AlertProvider>
        </ThemeProvider>
      </Provider>
    </SafeAreaProvider>
  );
}
