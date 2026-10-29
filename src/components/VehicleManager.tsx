"use client";

import { Car, Loader, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Vehicle, VehicleInput } from "@/types";
import { createVehicle, deleteVehicle, fetchVehicles, updateVehicle } from "@/utils/api";
import { useOnlineStatus } from "@/utils/useOnlineStatus";

const emptyVehicle: VehicleInput = {
  make_model: "",
  year: null,
  color: null,
  seats: 4,
  vehicle_type: "sedan",
  pet_policy: "not_allowed",
  smoking_policy: "non_smoking",
  accessibility_features: null,
  is_active: true,
};

export function VehicleManager() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleInput>(emptyVehicle);
  const isOnline = useOnlineStatus();

  const loadVehicles = useCallback(async () => {
    try {
      setVehicles(await fetchVehicles());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load your cars.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const openCreateDialog = () => {
    setEditingVehicleId(null);
    setVehicleDraft(emptyVehicle);
    setIsDialogOpen(true);
  };

  const openEditDialog = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setVehicleDraft({
      make_model: vehicle.make_model,
      year: vehicle.year,
      color: vehicle.color,
      seats: vehicle.seats,
      vehicle_type: vehicle.vehicle_type,
      pet_policy: vehicle.pet_policy,
      smoking_policy: vehicle.smoking_policy,
      accessibility_features: vehicle.accessibility_features,
      is_active: vehicle.is_active,
    });
    setIsDialogOpen(true);
  };

  const saveVehicle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (editingVehicleId) {
        await updateVehicle(editingVehicleId, vehicleDraft);
        toast.success("Car updated.");
      } else {
        await createVehicle(vehicleDraft);
        toast.success("Car added.");
      }
      setIsDialogOpen(false);
      await loadVehicles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the car.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleVehicleStatus = async (vehicle: Vehicle) => {
    try {
      await updateVehicle(vehicle.id, { ...vehicle, is_active: !vehicle.is_active });
      await loadVehicles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update car availability.");
    }
  };

  const confirmDelete = async () => {
    if (!vehicleToDelete) return;
    try {
      await deleteVehicle(vehicleToDelete.id);
      setVehicles((current) => current.filter((vehicle) => vehicle.id !== vehicleToDelete.id));
      toast.success("Car removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove the car.");
    } finally {
      setVehicleToDelete(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" /> My Cars
            </CardTitle>
            <CardDescription>
              Manage the vehicle details drivers can attach to ride offers.
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} disabled={!isOnline}>
            <Plus className="h-4 w-4 mr-2" /> Add car
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Car className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium">No cars added</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add a car to attach its details when you offer a ride.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((vehicle) => (
                <Card key={vehicle.id}>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">
                          {vehicle.make_model}
                          {vehicle.year ? ` (${vehicle.year})` : ""}
                        </h3>
                        <Badge variant={vehicle.is_active ? "default" : "secondary"}>
                          {vehicle.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {[vehicle.color, `${vehicle.seats} seats`, vehicle.vehicle_type.toUpperCase()]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pets {vehicle.pet_policy === "allowed" ? "allowed" : "not allowed"} ·{" "}
                        {vehicle.smoking_policy === "non_smoking" ? "Non-smoking" : "Smoking allowed"}
                      </p>
                      {vehicle.accessibility_features && (
                        <p className="text-sm text-muted-foreground break-words">
                          Accessibility: {vehicle.accessibility_features}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`vehicle-active-${vehicle.id}`} className="text-sm">
                          Active
                        </Label>
                        <Switch
                          id={`vehicle-active-${vehicle.id}`}
                          checked={vehicle.is_active}
                          onCheckedChange={() => toggleVehicleStatus(vehicle)}
                          disabled={!isOnline}
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Edit ${vehicle.make_model}`}
                        onClick={() => openEditDialog(vehicle)}
                        disabled={!isOnline}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`Delete ${vehicle.make_model}`}
                        onClick={() => setVehicleToDelete(vehicle)}
                        disabled={!isOnline}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVehicleId ? "Edit car" : "Add a car"}</DialogTitle>
            <DialogDescription>
              Saved details are copied into the ride offer when you choose this car.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveVehicle} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vehicle_make_model">Make and model</Label>
                <Input
                  id="vehicle_make_model"
                  required
                  maxLength={120}
                  value={vehicleDraft.make_model}
                  onChange={(event) =>
                    setVehicleDraft((current) => ({ ...current, make_model: event.target.value }))
                  }
                  placeholder="e.g. Toyota Corolla"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_year">Year</Label>
                <Input
                  id="vehicle_year"
                  type="number"
                  min={1950}
                  max={new Date().getFullYear() + 1}
                  value={vehicleDraft.year ?? ""}
                  onChange={(event) =>
                    setVehicleDraft((current) => ({
                      ...current,
                      year: event.target.value ? Number(event.target.value) : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_color">Color</Label>
                <Input
                  id="vehicle_color"
                  maxLength={50}
                  value={vehicleDraft.color ?? ""}
                  onChange={(event) =>
                    setVehicleDraft((current) => ({
                      ...current,
                      color: event.target.value || null,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicle_seats">Seats</Label>
                <Input
                  id="vehicle_seats"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={vehicleDraft.seats}
                  onChange={(event) =>
                    setVehicleDraft((current) => ({
                      ...current,
                      seats: Number(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle type</Label>
                <Select
                  value={vehicleDraft.vehicle_type}
                  onValueChange={(vehicle_type: VehicleInput["vehicle_type"]) =>
                    setVehicleDraft((current) => ({ ...current, vehicle_type }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedan">Sedan</SelectItem>
                    <SelectItem value="suv">SUV</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pet policy</Label>
                <Select
                  value={vehicleDraft.pet_policy}
                  onValueChange={(pet_policy: VehicleInput["pet_policy"]) =>
                    setVehicleDraft((current) => ({ ...current, pet_policy }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allowed">Pets allowed</SelectItem>
                    <SelectItem value="not_allowed">Pets not allowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Smoking policy</Label>
                <Select
                  value={vehicleDraft.smoking_policy}
                  onValueChange={(smoking_policy: VehicleInput["smoking_policy"]) =>
                    setVehicleDraft((current) => ({ ...current, smoking_policy }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="non_smoking">Non-smoking</SelectItem>
                    <SelectItem value="smoking_allowed">Smoking allowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle_accessibility">Accessibility features</Label>
              <Textarea
                id="vehicle_accessibility"
                maxLength={500}
                rows={3}
                value={vehicleDraft.accessibility_features ?? ""}
                onChange={(event) =>
                  setVehicleDraft((current) => ({
                    ...current,
                    accessibility_features: event.target.value || null,
                  }))
                }
                placeholder="Describe accessibility features"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="vehicle-is-active">Available for offers</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive cars cannot be attached to new ride offers.
                </p>
              </div>
              <Switch
                id="vehicle-is-active"
                checked={vehicleDraft.is_active}
                onCheckedChange={(is_active) =>
                  setVehicleDraft((current) => ({ ...current, is_active }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSaving || !isOnline}>
                {isSaving && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                {isSaving ? "Saving..." : editingVehicleId ? "Save changes" : "Add car"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!vehicleToDelete} onOpenChange={(open) => !open && setVehicleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this car?</AlertDialogTitle>
            <AlertDialogDescription>
              This car will no longer be available for new offers. Past ride offers keep their saved vehicle details.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove car</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
