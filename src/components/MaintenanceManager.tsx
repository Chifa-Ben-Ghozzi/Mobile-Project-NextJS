"use client";

import { Pencil, Trash2, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  MAINTENANCE_TYPES,
  maintenanceTypeIcon,
  maintenanceTypeLabel,
} from "@/lib/maintenance";
import type { MaintenanceLog, Vehicle } from "@/types";
import {
  createMaintenanceLog,
  deleteMaintenanceLog,
  fetchVehicleMaintenance,
  updateMaintenanceLog,
} from "@/utils/api";
import { useOnlineStatus } from "@/utils/useOnlineStatus";

interface MaintenanceManagerProps {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const emptyForm = {
  type: "oil_change" as MaintenanceLog["type"],
  title: "",
  description: "",
  performed_at: new Date().toISOString().slice(0, 10),
  mileage_km: "",
  cost: "",
  receipt_url: "",
  next_due_at: "",
  next_due_mileage: "",
};

export function MaintenanceManager({ vehicle, open, onOpenChange }: MaintenanceManagerProps) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      setLogs(await fetchVehicleMaintenance(vehicle.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load maintenance logs.");
    } finally {
      setIsLoading(false);
    }
  }, [vehicle.id]);

  useEffect(() => {
    if (open) loadLogs();
  }, [open, loadLogs]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (log: MaintenanceLog) => {
    setEditingId(log.id);
    setForm({
      type: log.type,
      title: log.title,
      description: log.description ?? "",
      performed_at: log.performed_at.slice(0, 10),
      mileage_km: log.mileage_km !== null ? String(log.mileage_km) : "",
      cost: log.cost !== null ? String(log.cost) : "",
      receipt_url: log.receipt_url ?? "",
      next_due_at: log.next_due_at ? log.next_due_at.slice(0, 10) : "",
      next_due_mileage: log.next_due_mileage !== null ? String(log.next_due_mileage) : "",
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim() || null,
        performed_at: form.performed_at,
        mileage_km: form.mileage_km ? Number(form.mileage_km) : null,
        cost: form.cost ? Number(form.cost) : null,
        receipt_url: form.receipt_url.trim() || null,
        next_due_at: form.next_due_at || null,
        next_due_mileage: form.next_due_mileage ? Number(form.next_due_mileage) : null,
      };
      if (editingId) {
        await updateMaintenanceLog(vehicle.id, editingId, payload);
        toast.success("Maintenance log updated.");
      } else {
        await createMaintenanceLog(vehicle.id, payload);
        toast.success("Maintenance log added.");
      }
      resetForm();
      await loadLogs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save maintenance log.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMaintenanceLog(vehicle.id, deletingId);
      setLogs((current) => current.filter((l) => l.id !== deletingId));
      toast.success("Maintenance log removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove maintenance log.");
    } finally {
      setDeletingId(null);
    }
  };

  const statusBadge = (status: MaintenanceLog["status"]) => {
    if (status === "overdue") return <Badge variant="destructive">Overdue</Badge>;
    if (status === "due_soon") return <Badge className="bg-amber-500 hover:bg-amber-600">Due soon</Badge>;
    return <Badge variant="secondary">OK</Badge>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" /> Maintenance — {vehicle.make_model}
              {vehicle.year ? ` (${vehicle.year})` : ""}
            </DialogTitle>
            <DialogDescription>
              Track service history and upcoming maintenance for this car.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-3 rounded-lg border p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: MaintenanceLog["type"]) => setForm((c) => ({ ...c, type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.icon} {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m_title">Title</Label>
                <Input
                  id="m_title"
                  required
                  maxLength={120}
                  value={form.title}
                  onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                  placeholder="e.g. Oil change 5W-30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m_performed">Performed on</Label>
                <Input
                  id="m_performed"
                  type="date"
                  required
                  value={form.performed_at}
                  onChange={(e) => setForm((c) => ({ ...c, performed_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m_mileage">Mileage (km)</Label>
                <Input
                  id="m_mileage"
                  type="number"
                  min={0}
                  value={form.mileage_km}
                  onChange={(e) => setForm((c) => ({ ...c, mileage_km: e.target.value }))}
                  placeholder="e.g. 45000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m_cost">Cost</Label>
                <Input
                  id="m_cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost}
                  onChange={(e) => setForm((c) => ({ ...c, cost: e.target.value }))}
                  placeholder="e.g. 45.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m_next_due">Next due date</Label>
                <Input
                  id="m_next_due"
                  type="date"
                  value={form.next_due_at}
                  onChange={(e) => setForm((c) => ({ ...c, next_due_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m_next_mileage">Next due mileage (km)</Label>
                <Input
                  id="m_next_mileage"
                  type="number"
                  min={0}
                  value={form.next_due_mileage}
                  onChange={(e) => setForm((c) => ({ ...c, next_due_mileage: e.target.value }))}
                  placeholder="e.g. 50000"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m_receipt">Receipt URL (optional)</Label>
                <Input
                  id="m_receipt"
                  type="url"
                  value={form.receipt_url}
                  onChange={(e) => setForm((c) => ({ ...c, receipt_url: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="m_desc">Notes</Label>
                <Textarea
                  id="m_desc"
                  rows={2}
                  maxLength={1000}
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  placeholder="Shop, parts used, observations…"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm} disabled={isSaving}>
                  Cancel edit
                </Button>
              )}
              <Button type="submit" disabled={isSaving || !isOnline} className="ml-auto">
                {isSaving ? "Saving…" : editingId ? "Save changes" : "Add log"}
              </Button>
            </div>
          </form>

          <div className="mt-4 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Service history ({logs.length})
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : logs.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No maintenance records yet. Add your first service above.
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <Card key={log.id} className="border">
                    <CardContent className="flex flex-col gap-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg">{maintenanceTypeIcon(log.type)}</span>
                            <span className="font-semibold">{log.title}</span>
                            {statusBadge(log.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {maintenanceTypeLabel(log.type)} ·{" "}
                            {new Date(log.performed_at).toLocaleDateString()}
                            {log.mileage_km !== null ? ` · ${log.mileage_km.toLocaleString()} km` : ""}
                            {log.cost !== null ? ` · ${log.cost.toFixed(2)}` : ""}
                          </p>
                          {log.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{log.description}</p>
                          )}
                          {log.next_due_at && (
                            <p className="mt-1 text-xs">
                              Next due: {new Date(log.next_due_at).toLocaleDateString()}
                              {log.next_due_mileage !== null ? ` or ${log.next_due_mileage.toLocaleString()} km` : ""}
                            </p>
                          )}
                          {log.receipt_url && (
                            <a
                              href={log.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-block text-xs text-primary underline"
                            >
                              View receipt
                            </a>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(log)}
                            disabled={!isOnline}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(log.id)}
                            disabled={!isOnline}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>

        <Dialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove this maintenance log?</DialogTitle>
              <DialogDescription>
                This service record will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Remove</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Dialog>
    </>
  );
}
