import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User, Property, RentPayment } from "@shared/schema";

export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  totalOwners: number;
  totalTenants: number;
  occupiedProperties: number;
  vacantProperties: number;
  paidPayments: number;
  duePayments: number;
  latePayments: number;
  users: User[];
  properties: (Property & { owner?: User; tenant?: User; rentPayments: RentPayment[] })[];
}

export function useAdminStats() {
  const { data, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  return { stats: data, isLoading, error };
}

export function useDeleteUser() {
  return useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });
}

export function useEditFine() {
  return useMutation({
    mutationFn: async ({ paymentId, fineAmount }: { paymentId: number; fineAmount: number }) => {
      const res = await apiRequest("POST", "/api/admin/edit-fine", { paymentId, fineAmount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });
}

export function useSendNotification() {
  return useMutation({
    mutationFn: async ({ userId, title, message }: { userId: number; title: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/send-notification", { userId, title, message });
      return res.json();
    },
  });
}
