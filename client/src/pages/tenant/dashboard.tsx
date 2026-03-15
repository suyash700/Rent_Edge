import { useState, useRef } from "react";
import { Layout, PageSkeleton } from "@/components/layout";
import { useTenantDashboard, useJoinProperty, useSubmitProof } from "@/hooks/use-tenant";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { StatusBadge, ProofStatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  MapPin, IndianRupee, Calendar, Phone, User, AlertTriangle,
  Upload, ExternalLink, Zap, Droplets, Wrench, Loader2, Building2
} from "lucide-react";

const joinSchema = z.object({
  code: z.string().length(6, "Property code must be 6 characters"),
});

export default function TenantDashboard() {
  const { data, isLoading, error } = useTenantDashboard();
  const joinProperty = useJoinProperty();
  const submitProof = useSubmitProof();
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [proofType, setProofType] = useState<"screenshot" | "transaction">("screenshot");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const joinForm = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: "" },
  });

  const onJoin = (formData: z.infer<typeof joinSchema>) => {
    joinProperty.mutate(formData.code.toUpperCase(), {
      onSuccess: () => {
        toast({ title: "Joined Successfully!", description: "You have joined the property." });
        joinForm.reset();
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleSubmitProof = () => {
    if (!data?.currentPayment) return;
    
    if (proofType === "screenshot" && !selectedFile) {
      toast({ title: "Error", description: "Please select a screenshot", variant: "destructive" });
      return;
    }
    
    if (proofType === "transaction" && !transactionId.trim()) {
      toast({ title: "Error", description: "Please enter transaction ID", variant: "destructive" });
      return;
    }

    submitProof.mutate(
      {
        paymentId: data.currentPayment.id,
        file: proofType === "screenshot" ? selectedFile! : undefined,
        transactionId: proofType === "transaction" ? transactionId : undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Proof Submitted", description: "Your payment proof has been submitted for verification." });
          setSelectedFile(null);
          setTransactionId("");
          if (fileInputRef.current) fileInputRef.current.value = "";
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  if (isLoading) return <PageSkeleton />;

  const hasNoProperty = error || !data?.property;

  if (hasNoProperty) {
    return (
      <Layout title="Join a Property">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto p-4 rounded-full bg-primary/10 w-fit mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Join a Property</CardTitle>
              <CardDescription>
                Enter the 6-digit property code shared by your landlord
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...joinForm}>
                <form onSubmit={joinForm.handleSubmit(onJoin)} className="space-y-4">
                  <FormField
                    control={joinForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property Code</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="e.g., ABC123"
                            className="text-center font-mono text-lg uppercase tracking-widest"
                            maxLength={6}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-property-code"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={joinProperty.isPending} data-testid="button-join-property">
                    {joinProperty.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      "Join Property"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const { property, currentPayment, fineBreakdown } = data;
  const rentDue = currentPayment ? currentPayment.rentAmount : property.monthlyRent;
  const fineAmount = fineBreakdown?.totalFine || 0;

  const maintenanceContacts = [
    { name: property.electricianName, phone: property.electricianPhone, icon: Zap, label: "Electrician" },
    { name: property.plumberName, phone: property.plumberPhone, icon: Droplets, label: "Plumber" },
    { name: property.mechanicName, phone: property.mechanicPhone, icon: Wrench, label: "Mechanic" },
  ].filter((c) => c.name && c.phone);

  return (
    <Layout title="My Rental">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-xl">{property.name}</CardTitle>
                <CardDescription className="flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />
                  {property.address}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono">{property.propertyCode}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Owner</p>
                <p className="font-medium flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {property.ownerName}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Monthly Rent</p>
                <p className="font-medium flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />
                  {property.monthlyRent.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {property.rentDueDay}th of month
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Deposit Balance</p>
                <p className="font-medium flex items-center gap-1">
                  <IndianRupee className="h-3 w-3" />
                  {property.depositBalance.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {currentPayment && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Month Rent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={currentPayment.status as "paid" | "due" | "late"} />
                <ProofStatusBadge status={currentPayment.proofStatus as "none" | "submitted" | "verified" | "rejected"} />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Rent Amount</p>
                  <p className="font-medium text-lg">₹{currentPayment.rentAmount.toLocaleString()}</p>
                </div>
                {fineAmount > 0 && (
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      Late Fine (from deposit)
                    </p>
                    <p className="font-medium text-lg text-amber-600">₹{fineAmount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Deposit Balance: ₹{property.depositBalance.toLocaleString()} → ₹{Math.max(0, property.depositBalance - fineAmount).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {fineBreakdown && fineBreakdown.totalFine > 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Payment is {fineBreakdown.daysLate} day{fineBreakdown.daysLate > 1 ? "s" : ""} late.
                    Fine of ₹{fineBreakdown.totalFine.toLocaleString()} will be deducted from your security deposit.
                  </p>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-medium">Rent Due</span>
                <span className="text-2xl font-bold">₹{rentDue.toLocaleString()}</span>
              </div>

              {property.ownerUpiId && currentPayment.status !== "paid" && (
                <div className="p-3 rounded-lg bg-primary/5 border">
                  <p className="text-xs text-muted-foreground mb-1">Pay to Owner's UPI ID:</p>
                  <p className="font-mono font-medium text-primary">{property.ownerUpiId}</p>
                </div>
              )}

              {currentPayment.status !== "paid" && (
                <>
                  {currentPayment.proofStatus === "none" || currentPayment.proofStatus === "rejected" ? (
                    <div className="space-y-3 pt-2">
                      <Separator />
                      <p className="text-sm font-medium">Upload Payment Proof</p>
                      
                      {currentPayment.proofStatus === "rejected" && currentPayment.rejectionReason && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                          <p className="text-sm text-destructive">
                            Previous proof rejected: {currentPayment.rejectionReason}
                          </p>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={proofType === "screenshot" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setProofType("screenshot")}
                            data-testid="button-proof-screenshot"
                          >
                            Screenshot
                          </Button>
                          <Button
                            type="button"
                            variant={proofType === "transaction" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setProofType("transaction")}
                            data-testid="button-proof-transaction"
                          >
                            Transaction ID
                          </Button>
                        </div>

                        {proofType === "screenshot" ? (
                          <div className="space-y-2">
                            <Input
                              type="file"
                              accept="image/*"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              data-testid="input-proof-file"
                            />
                            {selectedFile && (
                              <p className="text-sm text-muted-foreground">Selected: {selectedFile.name}</p>
                            )}
                          </div>
                        ) : (
                          <Input
                            placeholder="Enter Transaction ID"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            data-testid="input-transaction-id"
                          />
                        )}

                        <Button
                          onClick={handleSubmitProof}
                          disabled={submitProof.isPending}
                          className="w-full"
                          data-testid="button-submit-proof"
                        >
                          {submitProof.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Submit Proof
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : currentPayment.proofStatus === "submitted" ? (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        Your payment proof is pending verification by the owner.
                      </p>
                    </div>
                  ) : null}
                </>
              )}

              {currentPayment.status === "paid" && (
                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Payment verified on {currentPayment.paidAt ? format(new Date(currentPayment.paidAt), "MMM d, yyyy") : "N/A"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {maintenanceContacts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Maintenance Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {maintenanceContacts.map((contact) => (
                  <div key={contact.label} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <contact.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{contact.label}</p>
                      <p className="font-medium text-sm truncate">{contact.name}</p>
                    </div>
                    <a href={`tel:${contact.phone}`}>
                      <Button variant="ghost" size="icon" data-testid={`button-call-${contact.label.toLowerCase()}`}>
                        <Phone className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
