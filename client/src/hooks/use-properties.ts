import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Property, PropertyWithTenant, PropertyWithPayments, InsertProperty } from "@shared/schema";

export function useProperties() {
  const { data: properties, isLoading, error, refetch } = useQuery<PropertyWithTenant[]>({
    queryKey: ["/api/properties"],
  });

  return { properties: properties || [], isLoading, error, refetch };
}

export function useProperty(id: number) {
  const { data: property, isLoading, error } = useQuery<PropertyWithPayments>({
    queryKey: ["/api/properties", id],
    enabled: !!id,
  });

  return { property, isLoading, error };
}

export function useCreateProperty() {
  return useMutation({
    mutationFn: async (data: Omit<InsertProperty, "ownerId">) => {
      const res = await apiRequest("POST", "/api/properties", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
    },
  });
}

export function useRemoveTenant() {
  return useMutation({
    mutationFn: async (propertyId: number) => {
      const res = await apiRequest("DELETE", `/api/properties/${propertyId}/tenant`);
      return res.json();
    },
    onSuccess: (_, propertyId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId] });
    },
  });
}
