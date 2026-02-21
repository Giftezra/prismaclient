import { useCallback, useState } from "react";
import { useAppSelector, RootState } from "@/app/store/main_store";
import {
  useGetPartnerDashboardQuery,
  useGetPartnerPayoutDetailsQuery,
  useGetPartnerPayoutHistoryQuery,
  useUpdatePartnerPayoutDetailsMutation,
  useCreatePayoutRequestMutation,
} from "@/app/store/api/partnerApi";
import { useSnackbar } from "@/app/contexts/SnackbarContext";

export const usePartner = (options?: { skipPayout?: boolean }) => {
  const { showSnackbarWithConfig } = useSnackbar();
  const user = useAppSelector((state: RootState) => state.auth.user);
  const isPartner = Boolean(user?.is_dealership || user?.partner_referral_code);

  const [editingStripe, setEditingStripe] = useState(false);
  const [editingBank, setEditingBank] = useState(false);
  const [stripeValue, setStripeValue] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [iban, setIban] = useState("");

  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
    isFetching: dashboardFetching,
  } = useGetPartnerDashboardQuery(undefined, { skip: !isPartner });

  const {
    data: payoutData,
    isLoading: payoutLoading,
    error: payoutError,
    refetch: refetchPayout,
  } = useGetPartnerPayoutDetailsQuery(undefined, {
    skip: !isPartner || options?.skipPayout === true,
  });

  const {
    data: payoutHistoryData,
    isLoading: payoutHistoryLoading,
    error: payoutHistoryError,
    refetch: refetchPayoutHistory,
  } = useGetPartnerPayoutHistoryQuery(undefined, {
    skip: !isPartner || options?.skipPayout === true,
  });

  const [updatePayout, { isLoading: isUpdating }] = useUpdatePartnerPayoutDetailsMutation();
  const [createPayoutRequest, { isLoading: isRequesting }] = useCreatePayoutRequestMutation();

  const pendingCommission = payoutData?.pending_commission ?? 0;
  const hasStripe = Boolean(payoutData?.stripe_connect_account_id);
  const hasBank = payoutData?.bank_account?.has_bank_account ?? false;
  const userCountry = user?.address?.country;

  const saveStripe = useCallback(async () => {
    const value = (stripeValue || "").trim();
    if (!value) {
      showSnackbarWithConfig({
        message: "Enter a Stripe Connect Account ID",
        type: "error",
        duration: 3000,
      });
      return;
    }
    try {
      await updatePayout({ stripe_connect_account_id: value }).unwrap();
      setEditingStripe(false);
      setStripeValue("");
      showSnackbarWithConfig({
        message: "Stripe Connect ID saved",
        type: "success",
        duration: 3000,
      });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      showSnackbarWithConfig({
        message: e?.data?.error || "Failed to save Stripe ID",
        type: "error",
        duration: 4000,
      });
    }
  }, [stripeValue, updatePayout, showSnackbarWithConfig]);

  const saveBank = useCallback(async () => {
    const holder = (accountHolder || "").trim();
    const sort = (sortCode || "").trim().replace(/\s/g, "").replace(/-/g, "");
    const acct = (accountNumber || "").trim().replace(/\s/g, "");
    const ibanVal = (iban || "").trim().replace(/\s/g, "");
    if (!holder || !sort || !acct) {
      showSnackbarWithConfig({
        message: "Fill in account holder, sort code and account number",
        type: "error",
        duration: 3000,
      });
      return;
    }
    try {
      await updatePayout({
        account_holder_name: holder,
        sort_code: sort,
        account_number: acct,
        ...(ibanVal ? { iban: ibanVal } : {}),
      }).unwrap();
      setEditingBank(false);
      setAccountHolder("");
      setSortCode("");
      setAccountNumber("");
      setIban("");
      showSnackbarWithConfig({
        message: "Bank account saved",
        type: "success",
        duration: 3000,
      });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      showSnackbarWithConfig({
        message: e?.data?.error || "Failed to save bank details",
        type: "error",
        duration: 4000,
      });
    }
  }, [accountHolder, sortCode, accountNumber, iban, updatePayout, showSnackbarWithConfig]);

  const requestPayment = useCallback(async () => {
    try {
      const res = await createPayoutRequest().unwrap();
      showSnackbarWithConfig({
        message: res.message,
        type: "success",
        duration: 5000,
      });
    } catch (err: unknown) {
      const e = err as { data?: { error?: string } };
      showSnackbarWithConfig({
        message: e?.data?.error || "Failed to submit payment request",
        type: "error",
        duration: 4000,
      });
    }
  }, [createPayoutRequest, showSnackbarWithConfig]);

  const clearStripeForm = useCallback(() => {
    setEditingStripe(false);
    setStripeValue("");
  }, []);

  const clearBankForm = useCallback(() => {
    setEditingBank(false);
    setAccountHolder("");
    setSortCode("");
    setAccountNumber("");
    setIban("");
  }, []);

  return {
    user,
    isPartner,
    userCountry,

    dashboard: {
      data: dashboardData,
      isLoading: dashboardLoading,
      error: dashboardError,
      refetch: refetchDashboard,
      isFetching: dashboardFetching,
    },

    payout: {
      data: payoutData,
      isLoading: payoutLoading,
      error: payoutError,
      refetch: refetchPayout,
      pendingCommission,
      hasStripe,
      hasBank,
    },

    payoutHistory: {
      data: payoutHistoryData?.payout_requests ?? [],
      isLoading: payoutHistoryLoading,
      error: payoutHistoryError,
      refetch: refetchPayoutHistory,
    },

    payoutForm: {
      editingStripe,
      setEditingStripe,
      editingBank,
      setEditingBank,
      stripeValue,
      setStripeValue,
      accountHolder,
      setAccountHolder,
      sortCode,
      setSortCode,
      accountNumber,
      setAccountNumber,
      iban,
      setIban,
      clearStripeForm,
      clearBankForm,
    },

    saveStripe,
    saveBank,
    requestPayment,
    isUpdating,
    isRequesting,
  };
};

export type UsePartnerReturn = ReturnType<typeof usePartner>;
export default usePartner;
