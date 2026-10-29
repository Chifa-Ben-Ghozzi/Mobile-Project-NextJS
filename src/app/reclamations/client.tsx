"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  isReclamationCategory,
  type ReclamationCategory,
  type ReclamationStatus,
} from "@/lib/reclamation";

interface Reclamation {
  id: string;
  category: ReclamationCategory;
  subject: string;
  description: string;
  ride_id: string | null;
  status: ReclamationStatus;
  admin_notes: string | null;
  created_at: string;
}

const statusLabels: Record<ReclamationStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  resolved: "Resolved",
  rejected: "Rejected",
};

export default function ReclamationsClient() {
  const [reclamations, setReclamations] = useState<Reclamation[]>([]);
  const [category, setCategory] = useState<ReclamationCategory>("ride_service");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [rideId, setRideId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadReclamations = useCallback(async () => {
    try {
      const response = await fetch("/api/reclamations");
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
  }, []);

  useEffect(() => {
    loadReclamations();
  }, [loadReclamations]);

  const resetForm = () => {
    setCategory("ride_service");
    setSubject("");
    setDescription("");
    setRideId("");
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/reclamations/${editingId}` : "/api/reclamations",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            subject,
            description,
            ride_id: rideId.trim() || null,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save reclamation");
      }

      toast.success(editingId ? "Reclamation updated" : "Reclamation submitted");
      resetForm();
      await loadReclamations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save reclamation");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (reclamation: Reclamation) => {
    setEditingId(reclamation.id);
    setCategory(reclamation.category);
    setSubject(reclamation.subject);
    setDescription(reclamation.description);
    setRideId(reclamation.ride_id || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteReclamation = async (id: string) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm("Delete this pending reclamation?")) return;
    try {
      const response = await fetch(`/api/reclamations/${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to delete reclamation");
      }
      setReclamations((items) => items.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
      toast.success("Reclamation deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete reclamation");
    }
  };

  return (
    <Layout>
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <section>
          <h1 className="text-3xl font-bold">Make a Reclamation</h1>
          <p className="mt-2 text-muted-foreground">
            Tell us what happened. You can edit or delete your submission while it is pending.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit reclamation" : "Submit a reclamation"}</CardTitle>
            <CardDescription>
              Choose the issue type and describe what happened. Do not include passwords or payment
              card details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="reclamation-category">
                  Category
                </label>
                <Select
                  onValueChange={(value) => {
                    if (isReclamationCategory(value)) setCategory(value);
                  }}
                  value={category}
                >
                  <SelectTrigger id="reclamation-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {reclamationCategories.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="reclamation-subject">
                  Subject
                </label>
                <Input
                  id="reclamation-subject"
                  maxLength={120}
                  minLength={5}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Briefly summarize the issue"
                  required
                  value={subject}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="reclamation-description">
                  Description
                </label>
                <Textarea
                  id="reclamation-description"
                  maxLength={5000}
                  minLength={10}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Include relevant details and what outcome you are seeking."
                  required
                  rows={6}
                  value={description}
                />
                <p className="text-xs text-muted-foreground">
                  10–5000 characters. Only the support team can see your submission.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="reclamation-ride">
                  Related ride ID <span className="font-normal text-muted-foreground">(optional)</span>
                </label>
                <Input
                  id="reclamation-ride"
                  onChange={(event) => setRideId(event.target.value)}
                  placeholder="Paste the ride ID if this concerns a ride"
                  value={rideId}
                />
                <p className="text-xs text-muted-foreground">
                  The ride ID is shown on the ride details page. Only rides you are involved in can
                  be linked.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button disabled={isSaving} type="submit">
                  {isSaving ? "Saving..." : editingId ? "Save changes" : "Submit reclamation"}
                </Button>
                {editingId && (
                  <Button onClick={resetForm} type="button" variant="outline">
                    Cancel edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">My submissions</h2>
          {isLoading ? (
            <p className="text-muted-foreground">Loading reclamations...</p>
          ) : reclamations.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                You have not submitted any reclamations.
              </CardContent>
            </Card>
          ) : (
            reclamations.map((reclamation) => (
              <Card key={reclamation.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{reclamation.subject}</CardTitle>
                    <CardDescription>
                      {reclamationCategories.find((item) => item.value === reclamation.category)
                        ?.label || reclamation.category}{" "}
                      · {new Date(reclamation.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant={reclamation.status === "pending" ? "secondary" : "outline"}>
                    {statusLabels[reclamation.status]}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm">{reclamation.description}</p>
                  {reclamation.ride_id && (
                    <p className="text-xs text-muted-foreground">
                      Related ride: <span className="font-mono">{reclamation.ride_id}</span>
                    </p>
                  )}
                  {reclamation.admin_notes && (
                    <div className="rounded-md bg-muted p-3">
                      <p className="text-sm font-medium">Response from the team</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{reclamation.admin_notes}</p>
                    </div>
                  )}
                  {reclamation.status === "pending" && (
                    <div className="flex gap-2">
                      <Button onClick={() => startEditing(reclamation)} size="sm" variant="outline">
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteReclamation(reclamation.id)}
                        size="sm"
                        variant="destructive"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </Layout>
  );
}
