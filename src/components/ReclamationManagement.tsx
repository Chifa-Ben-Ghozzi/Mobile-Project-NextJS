"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  reclamationCategories,
  reclamationStatuses,
  isReclamationStatus,
  type ReclamationStatus,
} from "@/lib/reclamation";

interface AdminReclamation {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  description: string;
  ride_id: string | null;
  status: ReclamationStatus;
  admin_notes: string | null;
  created_at: string;
  user: { name: string; email: string } | null;
  ride: { from_location: string; to_location: string; time: string } | null;
}

const statusLabels: Record<ReclamationStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  resolved: "Resolved",
  rejected: "Rejected",
};

export default function ReclamationManagement() {
  const [reclamations, setReclamations] = useState<AdminReclamation[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  const loadReclamations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/reclamations?status=${statusFilter}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load reclamations");
      }
      setReclamations(data.reclamations);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reclamations");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadReclamations();
  }, [loadReclamations]);

  const updateReclamation = async (
    id: string,
    status: ReclamationStatus,
    adminNotes: string
  ) => {
    try {
      const response = await fetch(`/api/admin/reclamations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, admin_notes: adminNotes }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update reclamation");
      }
      toast.success("Reclamation updated");
      await loadReclamations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update reclamation");
    }
  };

  const deleteReclamation = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Permanently delete this reclamation?")) return;
    try {
      const response = await fetch(`/api/admin/reclamations/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete reclamation");
      }
      setReclamations((items) => items.filter((item) => item.id !== id));
      toast.success("Reclamation deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete reclamation");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Review users’ complaints, send a response, and update their status.
        </p>
        <Select onValueChange={setStatusFilter} value={statusFilter}>
          <SelectTrigger className="w-44" aria-label="Filter reclamations by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {reclamationStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading reclamations...</p>
      ) : reclamations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No reclamations match this filter.
          </CardContent>
        </Card>
      ) : (
        reclamations.map((reclamation) => (
          <AdminReclamationCard
            key={reclamation.id}
            onDelete={deleteReclamation}
            onSave={updateReclamation}
            reclamation={reclamation}
          />
        ))
      )}
    </div>
  );
}

function AdminReclamationCard({
  reclamation,
  onSave,
  onDelete,
}: {
  reclamation: AdminReclamation;
  onSave: (id: string, status: ReclamationStatus, adminNotes: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<ReclamationStatus>(reclamation.status);
  const [adminNotes, setAdminNotes] = useState(reclamation.admin_notes || "");
  const categoryLabel =
    reclamationCategories.find((item) => item.value === reclamation.category)?.label ||
    reclamation.category;

  useEffect(() => {
    setStatus(reclamation.status);
    setAdminNotes(reclamation.admin_notes || "");
  }, [reclamation]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-lg">{reclamation.subject}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {categoryLabel} · {reclamation.user?.name || "Unknown user"} (
            {reclamation.user?.email || "no email"}) ·{" "}
            {new Date(reclamation.created_at).toLocaleString()}
          </p>
        </div>
        <Badge variant={reclamation.status === "pending" ? "secondary" : "outline"}>
          {statusLabels[reclamation.status]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm">{reclamation.description}</p>
        {reclamation.ride && (
          <p className="text-sm text-muted-foreground">
            Related ride: {reclamation.ride.from_location} → {reclamation.ride.to_location} (
            {new Date(reclamation.ride.time).toLocaleString()})
          </p>
        )}
        {reclamation.ride_id && !reclamation.ride && (
          <p className="text-xs text-muted-foreground">Related ride ID: {reclamation.ride_id}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Select
            onValueChange={(value) => {
              if (isReclamationStatus(value)) setStatus(value);
            }}
            value={status}
          >
            <SelectTrigger aria-label="Reclamation status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {reclamationStatuses.map((item) => (
                <SelectItem key={item} value={item}>
                  {statusLabels[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            aria-label="Message to the user"
            maxLength={5000}
            onChange={(event) => setAdminNotes(event.target.value)}
            placeholder="Response visible to the user (optional)"
            rows={3}
            value={adminNotes}
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => onSave(reclamation.id, status, adminNotes)}
            size="sm"
            type="button"
          >
            Save status and response
          </Button>
          <Button
            onClick={() => onDelete(reclamation.id)}
            size="sm"
            type="button"
            variant="destructive"
          >
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
