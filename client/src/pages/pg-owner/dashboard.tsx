import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Plus, Bed, Users, IndianRupee, LogOut, Loader2, Phone, Calendar, Trash2 } from "lucide-react";

const createPgPropertySchema = z.object({
  name: z.string().min(1, "PG name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().optional(),
  ownerName: z.string().min(1, "Owner name is required"),
  ownerUpiId: z.string().optional(),
});

const createBedSchema = z.object({
  bedNumber: z.string().min(1, "Bed number is required"),
  roomNumber: z.string().optional(),
  rentAmount: z.coerce.number().min(1, "Rent must be greater than 0"),
  rentCycle: z.enum(["monthly", "quarterly", "half_yearly", "yearly"]),
  securityDeposit: z.coerce.number().min(0, "Deposit must be non-negative"),
});

const assignTenantSchema = z.object({
  tenantPhone: z.string().length(10, "Phone must be 10 digits"),
  onboardingStartDay: z.coerce.number().min(1).max(31, "Day must be 1-31"),
  onboardingStartMonth: z.coerce.number().min(1).max(12, "Month must be 1-12"),
  onboardingStartYear: z.coerce.number().min(2020).max(2100, "Invalid year"),
});

export default function PgOwnerDashboard() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddBed, setShowAddBed] = useState(false);
  const [assignBedId, setAssignBedId] = useState<number | null>(null);

  const { data: pgProperties = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pg/properties"],
  });

  const createPropertyForm = useForm({
    resolver: zodResolver(createPgPropertySchema),
    defaultValues: { name: "", address: "", city: "", ownerName: user?.name || "", ownerUpiId: "" },
  });

  const createBedForm = useForm({
    resolver: zodResolver(createBedSchema),
    defaultValues: { bedNumber: "", roomNumber: "", rentAmount: 0, rentCycle: "monthly" as const, securityDeposit: 0 },
  });

  const assignTenantForm = useForm({
    resolver: zodResolver(assignTenantSchema),
    defaultValues: { tenantPhone: "", onboardingStartDay: new Date().getDate(), onboardingStartMonth: new Date().getMonth() + 1, onboardingStartYear: new Date().getFullYear() },
  });

  const createPropertyMutation = useMutation({
    mutationFn: (data: z.infer<typeof createPgPropertySchema>) => apiRequest("POST", "/api/pg/properties", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pg/properties"] });
      setShowAddProperty(false);
      createPropertyForm.reset();
      toast({ title: "PG Created", description: "Your PG property has been created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create PG", variant: "destructive" });
    },
  });

  const createBedMutation = useMutation({
    mutationFn: (data: z.infer<typeof createBedSchema> & { pgPropertyId: number }) => apiRequest("POST", "/api/pg/beds", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pg/properties"] });
      setShowAddBed(false);
      createBedForm.reset();
      toast({ title: "Bed Added", description: "Bed has been added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add bed", variant: "destructive" });
    },
  });

  const assignTenantMutation = useMutation({
    mutationFn: ({ bedId, data }: { bedId: number; data: z.infer<typeof assignTenantSchema> }) =>
      apiRequest("POST", `/api/pg/beds/${bedId}/assign-tenant`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pg/properties"] });
      setAssignBedId(null);
      assignTenantForm.reset();
      toast({ title: "Tenant Assigned", description: "Tenant has been assigned to the bed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign tenant", variant: "destructive" });
    },
  });

  const removeTenantMutation = useMutation({
    mutationFn: (bedId: number) => apiRequest("DELETE", `/api/pg/beds/${bedId}/tenant`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pg/properties"] });
      toast({ title: "Tenant Removed", description: "Tenant has been removed from the bed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to remove tenant", variant: "destructive" });
    },
  });

  const selectedProperty = pgProperties.find((p: any) => p.id === selectedPropertyId);

  const getCycleLabel = (cycle: string) => {
    switch (cycle) {
      case "quarterly": return "Quarterly";
      case "half_yearly": return "Half-Yearly";
      case "yearly": return "Yearly";
      default: return "Monthly";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">RentEdge PG</h1>
              <p className="text-sm text-muted-foreground">Welcome, {user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={() => logout()} disabled={isLoggingOut} data-testid="button-logout">
              {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Your PG Properties</h2>
              <Dialog open={showAddProperty} onOpenChange={setShowAddProperty}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-pg">
                    <Plus className="h-4 w-4 mr-1" /> Add PG
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New PG Property</DialogTitle>
                    <DialogDescription>Enter details for your PG or hostel</DialogDescription>
                  </DialogHeader>
                  <Form {...createPropertyForm}>
                    <form onSubmit={createPropertyForm.handleSubmit((data) => createPropertyMutation.mutate(data))} className="space-y-4">
                      <FormField control={createPropertyForm.control} name="name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>PG Name</FormLabel>
                          <FormControl><Input {...field} placeholder="Enter PG name" data-testid="input-pg-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={createPropertyForm.control} name="address" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address</FormLabel>
                          <FormControl><Input {...field} placeholder="Full address" data-testid="input-pg-address" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={createPropertyForm.control} name="city" render={({ field }) => (
                        <FormItem>
                          <FormLabel>City (Optional)</FormLabel>
                          <FormControl><Input {...field} placeholder="City" data-testid="input-pg-city" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={createPropertyForm.control} name="ownerName" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner Name</FormLabel>
                          <FormControl><Input {...field} placeholder="Your name" data-testid="input-pg-owner-name" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={createPropertyForm.control} name="ownerUpiId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>UPI ID (Optional)</FormLabel>
                          <FormControl><Input {...field} placeholder="your@upi" data-testid="input-pg-upi" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <Button type="submit" className="w-full" disabled={createPropertyMutation.isPending} data-testid="button-submit-pg">
                        {createPropertyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Create PG Property
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {pgProperties.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No PG properties yet</p>
                  <p className="text-sm">Add your first PG to get started</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {pgProperties.map((pg: any) => (
                  <Card
                    key={pg.id}
                    className={`cursor-pointer transition-colors ${selectedPropertyId === pg.id ? "border-primary" : ""}`}
                    onClick={() => setSelectedPropertyId(pg.id)}
                    data-testid={`card-pg-${pg.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{pg.name}</h3>
                          <p className="text-sm text-muted-foreground">{pg.address}</p>
                          <Badge variant="outline" className="mt-1">{pg.propertyCode}</Badge>
                        </div>
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Bed className="h-4 w-4" />
                            <span>{pg.beds?.length || 0} beds</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            <span>{pg.beds?.filter((b: any) => b.tenantId).length || 0} occupied</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            {selectedProperty ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div>
                      <CardTitle>{selectedProperty.name}</CardTitle>
                      <CardDescription>{selectedProperty.address}</CardDescription>
                    </div>
                    <Dialog open={showAddBed} onOpenChange={setShowAddBed}>
                      <DialogTrigger asChild>
                        <Button size="sm" data-testid="button-add-bed">
                          <Plus className="h-4 w-4 mr-1" /> Add Bed
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Bed</DialogTitle>
                          <DialogDescription>Add a bed to {selectedProperty.name}</DialogDescription>
                        </DialogHeader>
                        <Form {...createBedForm}>
                          <form onSubmit={createBedForm.handleSubmit((data) => createBedMutation.mutate({ ...data, pgPropertyId: selectedProperty.id }))} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <FormField control={createBedForm.control} name="bedNumber" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bed Number</FormLabel>
                                  <FormControl><Input {...field} placeholder="e.g., B1" data-testid="input-bed-number" /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                              <FormField control={createBedForm.control} name="roomNumber" render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Room (Optional)</FormLabel>
                                  <FormControl><Input {...field} placeholder="e.g., R101" data-testid="input-room-number" /></FormControl>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </div>
                            <FormField control={createBedForm.control} name="rentAmount" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rent Amount (Rs.)</FormLabel>
                                <FormControl><Input {...field} type="number" placeholder="0" data-testid="input-bed-rent" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={createBedForm.control} name="rentCycle" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Rent Cycle</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-rent-cycle">
                                      <SelectValue placeholder="Select cycle" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="monthly">Monthly</SelectItem>
                                    <SelectItem value="quarterly">Quarterly (3 months)</SelectItem>
                                    <SelectItem value="half_yearly">Half-Yearly (6 months)</SelectItem>
                                    <SelectItem value="yearly">Yearly (12 months)</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={createBedForm.control} name="securityDeposit" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Security Deposit (Rs.)</FormLabel>
                                <FormControl><Input {...field} type="number" placeholder="0" data-testid="input-bed-deposit" /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <Button type="submit" className="w-full" disabled={createBedMutation.isPending} data-testid="button-submit-bed">
                              {createBedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                              Add Bed
                            </Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">{selectedProperty.beds?.length || 0}</div>
                        <div className="text-sm text-muted-foreground">Total Beds</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{selectedProperty.beds?.filter((b: any) => b.tenantId).length || 0}</div>
                        <div className="text-sm text-muted-foreground">Occupied</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-amber-600">{selectedProperty.beds?.filter((b: any) => !b.tenantId).length || 0}</div>
                        <div className="text-sm text-muted-foreground">Vacant</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <h3 className="font-medium">Beds</h3>
                  {selectedProperty.beds?.length === 0 ? (
                    <Card>
                      <CardContent className="py-6 text-center text-muted-foreground">
                        <Bed className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No beds added yet</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {selectedProperty.beds?.map((bed: any) => (
                        <Card key={bed.id} data-testid={`card-bed-${bed.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">Bed {bed.bedNumber}</span>
                                  {bed.roomNumber && <span className="text-sm text-muted-foreground">({bed.roomNumber})</span>}
                                  <Badge variant={bed.tenantId ? "default" : "secondary"}>
                                    {bed.tenantId ? "Occupied" : "Vacant"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                  <IndianRupee className="h-3 w-3" />
                                  <span>{bed.rentAmount}</span>
                                  <span>({getCycleLabel(bed.rentCycle)})</span>
                                </div>
                                {bed.tenant && (
                                  <div className="mt-2 text-sm">
                                    <div className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      <span>{bed.tenant.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-muted-foreground">
                                      <Phone className="h-3 w-3" />
                                      <span>{bed.tenant.phone}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div>
                                {bed.tenantId ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => removeTenantMutation.mutate(bed.id)}
                                    disabled={removeTenantMutation.isPending}
                                    data-testid={`button-remove-tenant-${bed.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Dialog open={assignBedId === bed.id} onOpenChange={(open) => setAssignBedId(open ? bed.id : null)}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="outline" data-testid={`button-assign-tenant-${bed.id}`}>
                                        <Plus className="h-4 w-4 mr-1" /> Assign
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Assign Tenant to Bed {bed.bedNumber}</DialogTitle>
                                        <DialogDescription>Enter tenant details and onboarding date</DialogDescription>
                                      </DialogHeader>
                                      <Form {...assignTenantForm}>
                                        <form onSubmit={assignTenantForm.handleSubmit((data) => assignTenantMutation.mutate({ bedId: bed.id, data }))} className="space-y-4">
                                          <FormField control={assignTenantForm.control} name="tenantPhone" render={({ field }) => (
                                            <FormItem>
                                              <FormLabel>Tenant Phone</FormLabel>
                                              <FormControl><Input {...field} placeholder="10 digit phone" maxLength={10} data-testid="input-tenant-phone" /></FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )} />
                                          <div className="grid grid-cols-3 gap-2">
                                            <FormField control={assignTenantForm.control} name="onboardingStartDay" render={({ field }) => (
                                              <FormItem>
                                                <FormLabel>Day</FormLabel>
                                                <FormControl><Input {...field} type="number" min={1} max={31} data-testid="input-onboard-day" /></FormControl>
                                                <FormMessage />
                                              </FormItem>
                                            )} />
                                            <FormField control={assignTenantForm.control} name="onboardingStartMonth" render={({ field }) => (
                                              <FormItem>
                                                <FormLabel>Month</FormLabel>
                                                <FormControl><Input {...field} type="number" min={1} max={12} data-testid="input-onboard-month" /></FormControl>
                                                <FormMessage />
                                              </FormItem>
                                            )} />
                                            <FormField control={assignTenantForm.control} name="onboardingStartYear" render={({ field }) => (
                                              <FormItem>
                                                <FormLabel>Year</FormLabel>
                                                <FormControl><Input {...field} type="number" min={2020} max={2100} data-testid="input-onboard-year" /></FormControl>
                                                <FormMessage />
                                              </FormItem>
                                            )} />
                                          </div>
                                          <Button type="submit" className="w-full" disabled={assignTenantMutation.isPending} data-testid="button-submit-assign">
                                            {assignTenantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                            Assign Tenant
                                          </Button>
                                        </form>
                                      </Form>
                                    </DialogContent>
                                  </Dialog>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <h3 className="text-lg font-medium mb-2">Select a PG Property</h3>
                  <p>Choose a PG from the list to view and manage beds</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
