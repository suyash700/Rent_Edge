import { useState } from "react";
import { Layout, PageSkeleton } from "@/components/layout";
import { useAdminStats, useDeleteUser, useEditFine, useSendNotification } from "@/hooks/use-admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ProofStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Users, Building2, UserCheck, Home as HomeIcon, ChevronLeft, ChevronRight, Trash2, Bell, Edit2, Image, Loader2 } from "lucide-react";
import type { User, Property, RentPayment } from "@shared/schema";

const COLORS = ["hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(217, 91%, 60%)"];

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function AdminDashboard() {
  const { stats, isLoading } = useAdminStats();
  const deleteUser = useDeleteUser();
  const editFine = useEditFine();
  const sendNotification = useSendNotification();
  const { toast } = useToast();
  
  const [selectedOwner, setSelectedOwner] = useState<User | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);
  const [notifyUser, setNotifyUser] = useState<User | null>(null);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [editFinePayment, setEditFinePayment] = useState<RentPayment | null>(null);
  const [newFineAmount, setNewFineAmount] = useState(0);
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  if (isLoading || !stats) return <PageSkeleton />;

  const handleDeleteUser = () => {
    if (deleteUserId) {
      deleteUser.mutate(deleteUserId, {
        onSuccess: () => {
          toast({ title: "User deleted successfully" });
          setDeleteUserId(null);
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  };

  const handleSendNotification = () => {
    if (notifyUser && notifyTitle && notifyMessage) {
      sendNotification.mutate({ userId: notifyUser.id, title: notifyTitle, message: notifyMessage }, {
        onSuccess: () => {
          toast({ title: "Notification sent" });
          setNotifyUser(null);
          setNotifyTitle("");
          setNotifyMessage("");
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  };

  const handleEditFine = () => {
    if (editFinePayment) {
      editFine.mutate({ paymentId: editFinePayment.id, fineAmount: newFineAmount }, {
        onSuccess: () => {
          toast({ title: "Fine updated successfully" });
          setEditFinePayment(null);
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  };

  const propertyStatusData = [
    { name: "Occupied", value: stats.occupiedProperties },
    { name: "Vacant", value: stats.vacantProperties },
  ];

  const paymentStatusData = [
    { name: "Paid", value: stats.paidPayments },
    { name: "Due", value: stats.duePayments },
    { name: "Late", value: stats.latePayments },
  ];

  const owners = stats.users.filter((u) => u.role === "owner");
  const paginatedUsers = stats.users.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(stats.users.length / pageSize);

  const ownerProperties = selectedOwner
    ? stats.properties.filter((p) => p.ownerId === selectedOwner.id)
    : [];

  const totalCollected = ownerProperties.reduce((sum, p) => {
    return (
      sum +
      p.rentPayments
        .filter((rp) => rp.status === "paid")
        .reduce((s, rp) => s + rp.rentAmount, 0)
    );
  }, 0);

  return (
    <Layout title="Admin Dashboard">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-users">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-properties">{stats.totalProperties}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Owners</CardTitle>
              <HomeIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-owners">{stats.totalOwners}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-tenants">{stats.totalTenants}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Property Status</CardTitle>
              <CardDescription>Occupied vs Vacant properties</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={propertyStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {propertyStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Status</CardTitle>
              <CardDescription>Current month payment overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Users</CardTitle>
            <CardDescription>Click on owner names to view their properties</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell>
                      {user.role === "owner" ? (
                        <Button
                          variant="link"
                          className="p-0 h-auto font-medium"
                          onClick={() => setSelectedOwner(user)}
                          data-testid={`button-view-owner-${user.id}`}
                        >
                          {user.name}
                        </Button>
                      ) : (
                        <span className="font-medium">{user.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono">{user.phone}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setNotifyUser(user)}
                          data-testid={`button-notify-${user.id}`}
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                        {user.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteUserId(user.id)}
                            data-testid={`button-delete-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedOwner} onOpenChange={() => setSelectedOwner(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{selectedOwner?.name}'s Properties</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-100px)]">
            <div className="p-6 pt-4 space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">Total Rent Collected</p>
                <p className="text-2xl font-bold">₹{totalCollected.toLocaleString()}</p>
              </div>

              {ownerProperties.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No properties found</p>
              ) : (
                ownerProperties.map((property) => (
                  <Card key={property.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">#{property.serialNumber}</Badge>
                        <CardTitle className="text-base">{property.name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tenant</span>
                        <span className="font-medium">
                          {property.tenant?.name || "Vacant"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Monthly Rent</span>
                        <span className="font-medium">₹{property.monthlyRent.toLocaleString()}</span>
                      </div>

                      {property.rentPayments.length > 0 && (
                        <>
                          <Separator />
                          <p className="text-sm font-medium">Recent Payments</p>
                          <div className="space-y-2">
                            {property.rentPayments.slice(0, 5).map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <span>{monthNames[payment.month - 1]} {payment.year}</span>
                                  <StatusBadge status={payment.status as "paid" | "due" | "late"} />
                                  <ProofStatusBadge status={payment.proofStatus as "none" | "submitted" | "verified" | "rejected"} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span>₹{payment.rentAmount.toLocaleString()}</span>
                                  {payment.fineAmount > 0 && (
                                    <span className="text-destructive">+₹{payment.fineAmount}</span>
                                  )}
                                  {payment.proofImageUrl && (
                                    <Button variant="ghost" size="icon" onClick={() => setProofImageUrl(payment.proofImageUrl)}>
                                      <Image className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setEditFinePayment(payment); setNewFineAmount(payment.fineAmount); }}
                                    data-testid={`button-edit-fine-${payment.id}`}
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!notifyUser} onOpenChange={() => setNotifyUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Notification to {notifyUser?.name}</DialogTitle>
            <DialogDescription>Send a custom notification to this user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} placeholder="Notification title" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea value={notifyMessage} onChange={(e) => setNotifyMessage(e.target.value)} placeholder="Notification message" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyUser(null)}>Cancel</Button>
            <Button onClick={handleSendNotification} disabled={sendNotification.isPending || !notifyTitle || !notifyMessage}>
              {sendNotification.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editFinePayment} onOpenChange={() => setEditFinePayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fine</DialogTitle>
            <DialogDescription>
              {editFinePayment && `${monthNames[editFinePayment.month - 1]} ${editFinePayment.year} - Current fine: ₹${editFinePayment.fineAmount}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Fine Amount (₹)</Label>
              <Input type="number" min={0} value={newFineAmount} onChange={(e) => setNewFineAmount(Number(e.target.value))} />
              <p className="text-sm text-muted-foreground">Set to 0 to remove the fine</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFinePayment(null)}>Cancel</Button>
            <Button onClick={handleEditFine} disabled={editFine.isPending}>
              {editFine.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Fine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!proofImageUrl} onOpenChange={() => setProofImageUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          {proofImageUrl && <img src={proofImageUrl} alt="Payment proof" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
