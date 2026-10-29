"use client";

import { CalendarClock, Car, Loader, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { DriverOffer, DriverOfferInput, User, Vehicle } from "@/types";
import {
  createDriverOffer,
  deleteDriverOffer,
  fetchDriverOffers,
  fetchVehicles,
  updateDriverOffer,
} from "@/utils/api";
import { useOnlineStatus } from "@/utils/useOnlineStatus";

interface DriverOffersPageProps {
  currentUser: User;
}

const makeInitialDraft = (): DriverOfferInput => ({
  from_location: "",
  to_location: "",
  departure_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  offered_price: 0,
  available_places: 1,
  pickup_details: null,
  message: null,
  vehicle_id: "",
  status: "active",
});

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export default function DriverOffersPage({ currentUser }: DriverOffersPageProps) {
  const [offers, setOffers] = useState<DriverOffer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [offerError, setOfferError] = useState("");
  const [vehicleError, setVehicleError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerToDelete, setOfferToDelete] = useState<DriverOffer | null>(null);
  const [draft, setDraft] = useState<DriverOfferInput>(makeInitialDraft);
  const isOnline = useOnlineStatus();

  const loadOffers = useCallback(async () => {
    try {
      setOffers(await fetchDriverOffers());
      setOfferError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load ride offers.";
      setOfferError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    try {
      setVehicles(await fetchVehicles());
      setVehicleError("");
    } catch (error) {
      setVehicleError(error instanceof Error ? error.message : "Could not load your cars.");
    }
  }, []);

  useEffect(() => {
    void loadOffers();
    void loadVehicles();
  }, [loadOffers, loadVehicles]);

  const startNewOffer = () => {
    setEditingOfferId(null);
    setDraft({
      ...makeInitialDraft(),
      vehicle_id: vehicles.find((vehicle) => vehicle.is_active)?.id || "",
    });
    setIsDialogOpen(true);
  };

  const startEditing = (offer: DriverOffer) => {
    setEditingOfferId(offer.id);
    setDraft({
      from_location: offer.from_location,
      to_location: offer.to_location,
      departure_time: offer.departure_time,
      offered_price: offer.offered_price,
      available_places: offer.available_places,
      pickup_details: offer.pickup_details,
      message: offer.message,
      vehicle_id:
        vehicles.find((vehicle) => vehicle.id === offer.vehicle_id && vehicle.is_active)?.id ||
        vehicles.find((vehicle) => vehicle.is_active)?.id ||
        "",
      status: offer.status,
    });
    setIsDialogOpen(true);
  };

  const saveOffer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        ...draft,
        departure_time: new Date(draft.departure_time).toISOString(),
      };
      if (editingOfferId) {
        await updateDriverOffer(editingOfferId, payload);
        toast.success("Ride offer updated.");
      } else {
        await createDriverOffer(payload);
        toast.success("Ride offer published.");
      }
      setIsDialogOpen(false);
      await loadOffers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the ride offer.");
    } finally {
      setIsSaving(false);
    }
  };

  const removeOffer = async () => {
    if (!offerToDelete) return;
    try {
      await deleteDriverOffer(offerToDelete.id);
      setOffers((current) => current.filter((offer) => offer.id !== offerToDelete.id));
      toast.success("Ride offer deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the ride offer.");
    } finally {
      setOfferToDelete(null);
    }
  };

  const activeVehicles = vehicles.filter((vehicle) => vehicle.is_active);
  const visibleOffers = offers.filter(
    (offer) => offer.status === "active" || offer.driver_id === currentUser.id
  );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl font-bold">Offer a Ride</CardTitle>
            <CardDescription>
              Publish a trip with your route, departure, available places, price, pickup details,
              and car.
            </CardDescription>
          </div>
          <Button onClick={startNewOffer} disabled={!isOnline}>
            <Plus className="h-4 w-4 mr-2" /> Publish a trip
          </Button>
        </CardHeader>
        <CardContent>
          {vehicleError ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{vehicleError}</p>
          ) : activeVehicles.length === 0 ? (
            <div className="rounded-lg border border-dashed p-5 text-sm">
              <p className="font-medium">Add an active car before publishing a trip.</p>
              <Button asChild variant="link" className="px-0">
                <Link href="/profile?tab=vehicles">Manage cars in Profile</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your active cars are available to select in each ride offer.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Ride offers</h2>
          <p className="text-sm text-muted-foreground">
            Active trips are visible to signed-in users. You can manage your own offers here.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : offerError ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{offerError}</CardContent>
          </Card>
        ) : visibleOffers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No active ride offers yet. Publish a trip to share your drive.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {visibleOffers.map((offer) => {
              const isOwner = offer.driver_id === currentUser.id;
              const vehicle = offer.vehicle_snapshot;
              return (
                <Card key={offer.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg flex flex-wrap items-center gap-2">
                          {offer.from_location} <span aria-hidden="true">→</span> {offer.to_location}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {isOwner ? "Your trip" : `Offered by ${offer.driver_name}`}
                        </CardDescription>
                      </div>
                      <Badge
                        variant={
                          offer.status === "active"
                            ? "default"
                            : offer.status === "completed"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {offer.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <p className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-primary" />
                        {new Date(offer.departure_time).toLocaleString()}
                      </p>
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {offer.available_places} place{offer.available_places === 1 ? "" : "s"}
                      </p>
                      <p className="font-medium">Price: {offer.offered_price}</p>
                    </div>
                    <div className="rounded-md border p-3 text-sm space-y-1">
                      <p className="flex items-center gap-2 font-medium">
                        <Car className="h-4 w-4 text-primary" />
                        {vehicle.make_model}{vehicle.year ? ` (${vehicle.year})` : ""} ·{" "}
                        {vehicle.color || "Color not specified"} · {vehicle.vehicle_type.toUpperCase()}
                      </p>
                      <p className="text-muted-foreground">
                        Pets {vehicle.pet_policy === "allowed" ? "allowed" : "not allowed"} ·{" "}
                        {vehicle.smoking_policy === "non_smoking" ? "Non-smoking" : "Smoking allowed"}
                        {vehicle.accessibility_features
                          ? ` · Accessibility: ${vehicle.accessibility_features}`
                          : ""}
                      </p>
                    </div>
                    {offer.pickup_details && (
                      <p className="text-sm break-words">
                        <MapPin className="inline h-4 w-4 mr-1 text-primary" />
                        <span className="font-medium">Pickup:</span> {offer.pickup_details}
                      </p>
                    )}
                    {offer.message && (
                      <p className="text-sm text-muted-foreground break-words">{offer.message}</p>
                    )}
                    {isOwner && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(offer)}
                          disabled={!isOnline}
                        >
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOfferToDelete(offer)}
                          disabled={!isOnline}
                        >
                          <Trash2 className="h-4 w-4 mr-2 text-destructive" /> Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingOfferId ? "Edit ride offer" : "Publish a ride offer"}</DialogTitle>
            <DialogDescription>
              Share your trip information so passengers can review your offer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveOffer} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="offer_from">From</Label>
                <Input
                  id="offer_from"
                  required
                  maxLength={255}
                  value={draft.from_location}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, from_location: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer_to">To</Label>
                <Input
                  id="offer_to"
                  required
                  maxLength={255}
                  value={draft.to_location}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, to_location: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer_departure">Departure date and time</Label>
                <Input
                  id="offer_departure"
                  type="datetime-local"
                  required
                  value={toLocalDateTime(draft.departure_time)}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, departure_time: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer_places">Available places</Label>
                <Input
                  id="offer_places"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={draft.available_places}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      available_places: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer_price">Price offered</Label>
                <Input
                  id="offer_price"
                  type="number"
                  min={0}
                  max={99999999}
                  step="0.01"
                  required
                  value={draft.offered_price}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      offered_price: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Car</Label>
                <Select
                  value={draft.vehicle_id}
                  onValueChange={(vehicle_id) => setDraft((current) => ({ ...current, vehicle_id }))}
                  disabled={!activeVehicles.length}
                >
                  <SelectTrigger><SelectValue placeholder="Select an active car" /></SelectTrigger>
                  <SelectContent>
                    {activeVehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.make_model} · {vehicle.seats} seats · {vehicle.vehicle_type.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="offer_pickup">Pickup details (optional)</Label>
                <Input
                  id="offer_pickup"
                  maxLength={500}
                  value={draft.pickup_details || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      pickup_details: event.target.value || null,
                    }))
                  }
                  placeholder="Pickup point or meeting instructions"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="offer_message">Message (optional)</Label>
                <Textarea
                  id="offer_message"
                  maxLength={1000}
                  rows={3}
                  value={draft.message || ""}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, message: event.target.value || null }))
                  }
                  placeholder="Add details for passengers"
                />
              </div>
              {editingOfferId && (
                <div className="space-y-2">
                  <Label>Offer status</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(status: DriverOfferInput["status"]) =>
                      setDraft((current) => ({ ...current, status }))
                    }
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  !isOnline ||
                  activeVehicles.length === 0 ||
                  !draft.vehicle_id
                }
              >
                {isSaving && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                {isSaving ? "Saving..." : editingOfferId ? "Save changes" : "Publish trip"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!offerToDelete}
        onOpenChange={(open) => !open && setOfferToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ride offer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your trip announcement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep offer</AlertDialogCancel>
            <AlertDialogAction onClick={removeOffer}>Delete offer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
