import type { QueryClient } from "@tanstack/react-query";
import { useAdminStore } from "@/stores/admin-store";
import { useAvoidStore } from "@/stores/avoid-store";
import { useCompareStore } from "@/stores/compare-store";
import { useFavoritesStore } from "@/stores/favorites-store";

// A browser-local callback epoch, never an authorization decision or persisted ID.
let privateAccountEpoch = 0;
export const capturePrivateAccountEpoch = () => privateAccountEpoch;
export const isCurrentPrivateAccountEpoch = (epoch: number | undefined) => epoch === privateAccountEpoch;
export function advancePrivateAccountEpoch() { privateAccountEpoch += 1; }

export function clearPrivateClientState(queryClient: QueryClient) {
  advancePrivateAccountEpoch();
  // Cancellation/detachment happens synchronously; never await inside an auth callback.
  void queryClient.cancelQueries().catch(() => undefined);
  queryClient.clear();
  useCompareStore.getState().clear();
  useAvoidStore.getState().reset();
  useFavoritesStore.getState().reset();
  useAdminStore.getState().setIsAdmin(false);
  // Language, theme and device preferences deliberately remain outside this boundary.
}
