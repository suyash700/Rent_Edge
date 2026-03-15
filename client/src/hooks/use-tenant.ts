import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { PropertyWithPayments, RentPayment, User } from "@shared/schema";

export interface TenantDashboard {
  property: PropertyWithPayments & { owner?: User };
  currentPayment: RentPayment | null;
  fineBreakdown: {
    daysLate: number;
    dailyFine: number;
    totalFine: number;
  } | null;
}

export function useTenantDashboard() {
  const { data, isLoading, error } = useQuery<TenantDashboard>({
    queryKey: ["/api/tenant/dashboard"],
    retry: false,
  });

  return { data, isLoading, error };
}

export function useJoinProperty() {
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/tenant/join", { code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/dashboard"] });
    },
  });
}

export function useSubmitProof() {
  return useMutation({
    mutationFn: async ({ paymentId, file, transactionId }: { paymentId: number; file?: File; transactionId?: string }) => {
      const formData = new FormData();
      formData.append("paymentId", paymentId.toString());
      if (file) {
        formData.append("proof", file);
      }
      if (transactionId) {
        formData.append("transactionId", transactionId);
      }
      
      const res = await fetch("/api/tenant/submit-proof", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to submit proof");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/dashboard"] });
    },
  });
}
