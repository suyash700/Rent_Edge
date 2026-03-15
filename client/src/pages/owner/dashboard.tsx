import { useState } from "react";
import { Layout, PageSkeleton } from "@/components/layout";
import { useProperties, useCreateProperty } from "@/hooks/use-properties";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { Plus, MapPin, IndianRupee, Copy, Home, Users, Wrench, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const propertySchema = z.object({
  name: z.string().min(1, "Property name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().optional(),
  monthlyRent: z.coerce.number().min(1, "Rent must be at least 1"),
  rentDueDay: z.coerce.number().min(1).max(28, "Due day must be between 1-28"),
  onboardingStartDay: z.coerce.number().min(1).max(31, "Day must be 1-31"),
  onboardingStartMonth: z.coerce.number().min(1).max(12, "Month must be 1-12"),
  onboardingStartYear: z.coerce.number().min(2020).max(2100, "Invalid year"),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerUpiId: z.string().optional(),
  securityDeposit: z.coerce.number().min(0, "Deposit must be 0 or more"),
  electricianName: z.string().optional(),
  electricianPhone: z.string().max(10).optional(),
  plumberName: z.string().optional(),
  plumberPhone: z.string().max(10).optional(),
  mechanicName: z.string().optional(),
  mechanicPhone: z.string().max(10).optional(),
});

export default function OwnerDashboard() {
  const { properties, isLoading } = useProperties();
  const createProperty = useCreateProperty();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const today = new Date();
  const form = useForm<z.infer<typeof propertySchema>>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      monthlyRent: 0,
      rentDueDay: 1,
      onboardingStartDay: today.getDate(),
      onboardingStartMonth: today.getMonth() + 1,
      onboardingStartYear: today.getFullYear(),
      ownerName: "",
      ownerUpiId: "",
      securityDeposit: 0,
      electricianName: "",
      electricianPhone: "",
      plumberName: "",
      plumberPhone: "",
      mechanicName: "",
      mechanicPhone: "",
    },
  });

  const onSubmit = (data: z.infer<typeof propertySchema>) => {
    createProperty.mutate(data, {
      onSuccess: () => {
        toast({ title: "Property Added", description: "Your property has been added successfully." });
        form.reset();
        setDialogOpen(false);
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Property code copied to clipboard" });
  };

  if (isLoading) return <PageSkeleton />;

  return (
    <Layout title="My Properties">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Properties</h2>
            <p className="text-muted-foreground">Manage your rental properties</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-property">
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>Add New Property</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[calc(90vh-100px)]">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 pt-4">
                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <Home className="h-4 w-4" /> Property Details
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Property Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Sunrise Apartments" data-testid="input-property-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>City</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., Mumbai" data-testid="input-property-city" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Address</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Complete address" data-testid="input-property-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <IndianRupee className="h-4 w-4" /> Rent Details
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="monthlyRent"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Monthly Rent (₹)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" data-testid="input-monthly-rent" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="rentDueDay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Due Day (1-28)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min={1} max={28} data-testid="input-due-day" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="securityDeposit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Security Deposit (₹)</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" data-testid="input-security-deposit" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name="onboardingStartDay"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Onboarding Day</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min={1} max={31} data-testid="input-onboarding-day" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="onboardingStartMonth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Month</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min={1} max={12} data-testid="input-onboarding-month" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="onboardingStartYear"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Year</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min={2020} max={2100} data-testid="input-onboarding-year" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" /> Owner Details
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="ownerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Owner Name</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="Name for UPI" data-testid="input-owner-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="ownerUpiId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>UPI ID (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="owner@upi" data-testid="input-upi-id" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      <h3 className="font-medium flex items-center gap-2">
                        <Wrench className="h-4 w-4" /> Maintenance Contacts (Optional)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="electricianName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Electrician Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-electrician-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="electricianPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Electrician Phone</FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={10} data-testid="input-electrician-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="plumberName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Plumber Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-plumber-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="plumberPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Plumber Phone</FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={10} data-testid="input-plumber-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="mechanicName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mechanic Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-mechanic-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="mechanicPhone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mechanic Phone</FormLabel>
                              <FormControl>
                                <Input {...field} maxLength={10} data-testid="input-mechanic-phone" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={createProperty.isPending} data-testid="button-submit-property">
                      {createProperty.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Property"
                      )}
                    </Button>
                  </form>
                </Form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {properties.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Home className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">No Properties Yet</h3>
              <p className="text-muted-foreground text-center mb-4">Add your first property to start managing rent payments</p>
              <Button onClick={() => setDialogOpen(true)} data-testid="button-add-first-property">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Property
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((property) => (
              <Link key={property.id} href={`/owner/property/${property.id}`}>
                <Card className="hover-elevate cursor-pointer h-full transition-all">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="secondary" className="shrink-0" data-testid={`badge-serial-${property.id}`}>
                          #{property.serialNumber}
                        </Badge>
                        <CardTitle className="text-base truncate">{property.name}</CardTitle>
                      </div>
                      <StatusBadge status={property.tenantId ? "occupied" : "vacant"} />
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{property.address}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Monthly Rent</span>
                      <span className="font-semibold">₹{property.monthlyRent.toLocaleString()}</span>
                    </div>
                    
                    {property.tenant ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Tenant</span>
                        <span className="text-sm font-medium">{property.tenant.name}</span>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-xs text-muted-foreground">Property Code</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={(e) => {
                          e.preventDefault();
                          copyCode(property.propertyCode);
                        }}
                        data-testid={`button-copy-code-${property.id}`}
                      >
                        {property.propertyCode}
                        <Copy className="h-3 w-3 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
