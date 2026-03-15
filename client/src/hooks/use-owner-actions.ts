import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useVerifyProof(propertyId?: number) {
  return useMutation({
    mutationFn: async ({ paymentId, action, rejectionReason }: { paymentId: number; action: "approve" | "reject"; rejectionReason?: string }) => {
      const res = await apiRequest("POST", "/api/owner/verify-proof", { paymentId, action, rejectionReason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId] });
      }
    },
  });
}

export function useRecordCashPayment(propertyId?: number) {
  return useMutation({
    mutationFn: async (paymentId: number) => {
      const res = await apiRequest("POST", "/api/owner/cash-payment", { paymentId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId] });
      }
    },
  });
}
