import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { useLocation } from "wouter";

export function useAuth() {
  const [, setLocation] = useLocation();

  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    staleTime: Infinity,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { phone: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      const role = data.user.role;
      if (role === "admin") {
        setLocation("/admin/dashboard");
      } else if (role === "owner") {
        setLocation("/owner/dashboard");
      } else if (role === "pg_owner") {
        setLocation("/pg-owner/dashboard");
      } else {
        setLocation("/tenant/dashboard");
      }
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: { phone: string; password: string; name: string; role: "owner" | "tenant" | "pg_owner" }) => {
      const res = await apiRequest("POST", "/api/auth/signup", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      const role = data.user.role;
      if (role === "owner") {
        setLocation("/owner/dashboard");
      } else if (role === "pg_owner") {
        setLocation("/pg-owner/dashboard");
      } else {
        setLocation("/tenant/dashboard");
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      setLocation("/auth");
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login: loginMutation.mutate,
    signup: signupMutation.mutate,
    logout: logoutMutation.mutate,
    loginError: loginMutation.error,
    signupError: signupMutation.error,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
