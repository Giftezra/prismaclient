import React, { createContext, useContext, useState } from "react";
import AlertModal from "../components/helpers/AlertModal";

interface AlertState {
  isVisible: boolean;
  title: string;
  message: string;
  type: "success" | "error" | "warning";
  onConfirm?: () => void;
  onClose?: () => void;
}

interface AlertContextType {
  alertConfig: AlertState | undefined;
  setAlertConfig: (config: AlertState) => void;
  setIsVisible: (isVisible: boolean) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const AlertProvider = ({ children }: { children: React.ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertState | undefined>(
    undefined
  );

  // Custom setAlertConfig that also sets isVisible
  const handleSetAlertConfig = (config: AlertState) => {
    setAlertConfig(config);
    setIsVisible(config.isVisible);
  };

  const value: AlertContextType = {
    alertConfig,
    setAlertConfig: handleSetAlertConfig,
    setIsVisible,
  };

  return (
    <AlertContext.Provider value={value}>
      {children}

      <AlertModal
        isVisible={isVisible}
        title={alertConfig?.title || ""}
        message={alertConfig?.message || ""}
        type={alertConfig?.type || "error"}
        {...(alertConfig?.onClose && {
          onClose: () => alertConfig.onClose?.(),
        })}
        {...(alertConfig?.onConfirm && {
          onConfirm: () => alertConfig.onConfirm?.(),
        })}
      />
    </AlertContext.Provider>
  );
};

export const useAlertContext = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlertContext must be used within an AlertProvider");
  }
  return context;
};

export default AlertContext;
