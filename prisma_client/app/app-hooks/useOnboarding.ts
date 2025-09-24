import { SignUpScreenProps } from "../interfaces/AuthInterface";
import { RootState, useAppDispatch, useAppSelector } from "../store/main_store";
import {
  setSignUpData,
  setIsLoading,
  clearSignUpData,
  setUser,
  setAccessToken,
  setRefreshToken,
  setIsAuthenticated,
} from "../store/slices/authSlice";
import { useRegisterMutation } from "../store/api/authApi";
import { useAlertContext } from "../contexts/AlertContext";
import { router } from "expo-router";
import { saveDataToStorage } from "@/app/utils/helpers/storage";
import { useState } from "react";

const useOnboarding = () => {
  const dispatch = useAppDispatch();
  const { signUpData } = useAppSelector((state: RootState) => state.auth);
  const [
    registerMutation,
    { isLoading: isRegisterLoading, status: registerStatus },
  ] = useRegisterMutation();

  /* Import the alert contexts here to use the alert modal */
  const { setAlertConfig, setIsVisible } = useAlertContext();

  // Terms and conditions state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  /* Handle the collection of the users data to create an account */
  const collectSignupData = (field: string, value: string) => {
    dispatch(setSignUpData({ field, value }));
  };

  /**
   * Register the new user with their data of type {UserProfileProps}.
   * if successful, show an alert to the user and save the user data to storage
   */
  const registerUser = async () => {
    if (!signUpData) return;
    if (!signUpData.name || !signUpData.email || !signUpData.phone || !signUpData.password) {
      setAlertConfig({
        title: "Missing Fields",
        message: "Please fill in all required fields",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
      return;
    }
    if (!termsAccepted) {
      setAlertConfig({
        title: "Terms Required",
        message: "You must accept the terms and conditions to create an account",
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
          setShowTermsModal(true);
        },
      });
      return;
    }
    try {
      dispatch(setIsLoading(true));
      const response = await registerMutation(signUpData).unwrap();
      if (response) {
        /* Save the return data in the state and also the storage */
        saveDataToStorage(response.user, response.access, response.refresh);
        dispatch(setUser(response.user));
        dispatch(setAccessToken(response.access));
        dispatch(setRefreshToken(response.refresh));
        dispatch(setIsAuthenticated(true));
        
        setAlertConfig({
          title: "Registration Successful",
          message: response.message,
          type: "success",
          isVisible: true,
          onConfirm: () => {
            setIsVisible(false);
            dispatch(clearSignUpData());
            router.navigate("/main/(tabs)/dashboard/DashboardScreen");
          },
        });
      }
    } catch (error) {
      const errorMessage =
        (error as { data: { error: string } })?.data?.error ||
        "Please try again";
      setAlertConfig({
        title: "Registration Failed",
        message: errorMessage,
        type: "error",
        isVisible: true,
        onConfirm: () => {
          setIsVisible(false);
        },
      });
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  const handleAcceptTerms = () => {
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  const handleShowTerms = () => {
    setShowTermsModal(true);
  };

  return {
    signUpData,
    isRegisterLoading,
    collectSignupData,
    registerUser,
    termsAccepted,
    showTermsModal,
    handleAcceptTerms,
    handleShowTerms,
    setShowTermsModal,
  };
};

export default useOnboarding;
