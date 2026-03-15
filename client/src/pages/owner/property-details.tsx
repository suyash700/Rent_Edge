import { useState } from "react";
import { useRoute } from "wouter";
import { Layout, PageSkeleton } from "@/components/layout";
import { useProperty, useRemoveTenant } from "@/hooks/use-properties";
import { useVerifyProof, useRecordCashPayment } from "@/hooks/use-owner-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ProofStatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Copy, User, Phone, Calendar, IndianRupee, UserMinus, Receipt, Check, X, Image, Loader2 } from "lucide-react";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PropertyDetails() {
  const [, params] = useRoute("/owner/property/:id");
  const propertyId = parseInt(params?.id || "0");
  const { property, isLoading } = useProperty(propertyId);
  const removeTenant = useRemoveTenant();
  const verifyProof = useVerifyProof(propertyId);
  const recordCash = useRecordCashPayment(propertyId);
  const { toast } = useToast();
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Property code copied to clipboard" });
  };

  const handleApprove = (paymentId: number) => {
    verifyProof.mutate(
      { paymentId, action: "approve" },
      {
        onSuccess: () => {
          toast({ title: "Payment Verified", description: "The payment proof has been approved." });
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        },
      }
    );
  };

  const handleReject = () => {
    if (!rejectPaymentId || !rejectionReason.trim()) return;
    
    verifyProof.mutate(
      { paymentId: rejectPaymentId, action: "reject", rejectionReason: rejectionReason.trim() },
      {
        onSuccess: () => {
          toast({ title: "Payment Rejected", description: "The payment proof has been rejected." });
          setRejectDialogOpen(false);
          setRejectPaymentId(null);
          setRejectionReason("");
        },
        onError: (error) => {
          toast({ title: "Error", description: error.message, variant: "destructive" });
        },
      }
    );
  };

  const handleCashPayment = (paymentId: number) => {
    recordCash.mutate(paymentId, {
      onSuccess: () => {
        toast({ title: "Cash Payment Recorded", description: "The payment has been marked as paid." });
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

  const handleRemoveTenant = () => {
    removeTenant.mutate(propertyId, {
      onSuccess: () => {
        toast({ title: "Tenant Removed", description: "The tenant has been removed from this property." });
      },
      onError: (error) => {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      },
    });
  };

  if (isLoading || !property) return <PageSkeleton />;

  const sortedPayments = [...(property.rentPayments || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Layout title={property.name} showBackButton backTo="/owner/dashboard">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="text-lg px-3 py-1">#{property.serialNumber}</Badge>
          <h2 className="text-2xl font-bold">{property.name}</h2>
          <Button
            variant="outline"
            size="sm"
            className="font-mono"
            onClick={() => copyCode(property.propertyCode)}
            data-testid="button-copy-code"
          >
            {property.propertyCode}
            <Copy className="h-3 w-3 ml-2" />
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tenant Details</CardTitle>
            </CardHeader>
            <CardContent>
              {property.tenant ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium" data-testid="text-tenant-name">{property.tenant.name}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {property.tenant.phone}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Joined</p>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {property.tenantJoinedAt
                          ? format(new Date(property.tenantJoinedAt), "MMM d, yyyy")
                          : "N/A"}
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

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" data-testid="button-remove-tenant">
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove Tenant
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Tenant?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {property.tenant.name} from this property. They will no longer have access to property details or payment features.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleRemoveTenant}
                          className="bg-destructive text-destructive-foreground"
                          data-testid="button-confirm-remove"
                        >
                          {removeTenant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <div className="text-center py-6">
                  <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No tenant assigned</p>
                  <p className="text-sm text-muted-foreground mt-1">Share the property code to add a tenant</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {property.tenant && sortedPayments.length > 0 && sortedPayments[0].status !== "paid" && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleCashPayment(sortedPayments[0].id)}
                  disabled={recordCash.isPending}
                  data-testid="button-cash-payment"
                >
                  {recordCash.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4 mr-2" />
                  )}
                  Mark Paid (Cash)
                </Button>
              )}
              
              <div className="text-sm space-y-2 pt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Rent</span>
                  <span className="font-medium">₹{property.monthlyRent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Day</span>
                  <span className="font-medium">{property.rentDueDay}th of every month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security Deposit</span>
                  <span className="font-medium">₹{property.securityDeposit.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment History</CardTitle>
            <CardDescription>Track all rent payments for this property</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedPayments.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No payment history yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border bg-card"
                    data-testid={`payment-${payment.id}`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {monthNames[payment.month - 1]} {payment.year}
                        </span>
                        <StatusBadge status={payment.status as "paid" | "due" | "late"} />
                        <ProofStatusBadge status={payment.proofStatus as "none" | "submitted" | "verified" | "rejected"} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <span>Rent: ₹{payment.rentAmount.toLocaleString()}</span>
                        {payment.fineAmount > 0 && (
                          <>
                            <span className="text-destructive">Fine: ₹{payment.fineAmount.toLocaleString()}</span>
                            {payment.status !== "paid" && (
                              <span className="text-amber-600">
                                (Deposit: ₹{property.depositBalance.toLocaleString()} → ₹{Math.max(0, property.depositBalance - payment.fineAmount).toLocaleString()})
                              </span>
                            )}
                          </>
                        )}
                        {payment.transactionId && (
                          <span className="font-mono text-xs">ID: {payment.transactionId}</span>
                        )}
                      </div>
                      {payment.proofStatus === "rejected" && payment.rejectionReason && (
                        <p className="text-sm text-destructive">
                          Rejected: {payment.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {payment.proofImageUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setProofImageUrl(payment.proofImageUrl)}
                          data-testid={`button-view-proof-${payment.id}`}
                        >
                          <Image className="h-4 w-4 mr-1" />
                          View Proof
                        </Button>
                      )}
                      {payment.proofStatus === "submitted" && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(payment.id)}
                            disabled={verifyProof.isPending}
                            data-testid={`button-approve-${payment.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setRejectPaymentId(payment.id);
                              setRejectDialogOpen(true);
                            }}
                            disabled={verifyProof.isPending}
                            data-testid={`button-reject-${payment.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!proofImageUrl} onOpenChange={() => setProofImageUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center">
            {proofImageUrl && (
              <img
                src={proofImageUrl}
                alt="Payment Proof"
                className="max-w-full max-h-[60vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Proof</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this payment proof.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Rejection Reason</Label>
              <Input
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Amount doesn't match, unclear screenshot"
                data-testid="input-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || verifyProof.isPending}
              data-testid="button-confirm-reject"
            >
              {verifyProof.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
