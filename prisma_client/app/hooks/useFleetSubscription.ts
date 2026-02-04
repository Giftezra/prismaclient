import { useMemo } from "react";
import { useGetCurrentSubscriptionQuery } from "@/app/store/api/subscriptionApi";
import { useAppSelector, RootState } from "@/app/store/main_store";

/**
 * Hook to check fleet subscription status for feature access
 * Returns subscription status and download permissions
 */
export const useFleetSubscription = () => {
  const user = useAppSelector((state: RootState) => state.auth.user);
  const { data: subscription } = useGetCurrentSubscriptionQuery(undefined, {
    skip: !user?.is_fleet_owner, // Only fetch if user is fleet owner
  });

  const isFleetUser = useMemo(
    () => user?.is_fleet_owner || user?.is_branch_admin || false,
    [user]
  );

  const hasActiveSubscription = useMemo(() => {
    if (!isFleetUser) {
      // Regular users don't need subscription
      return true;
    }
    return subscription?.status === "active";
  }, [isFleetUser, subscription]);

  const canDownloadImages = useMemo(() => {
    // Regular users can always download
    if (!isFleetUser) {
      return true;
    }
    // Fleet users need active subscription
    return hasActiveSubscription;
  }, [isFleetUser, hasActiveSubscription]);

  return {
    isFleetUser,
    hasActiveSubscription,
    canDownloadImages,
    subscription,
  };
};
