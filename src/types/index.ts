export type User = {
  id: string;
  name: string;
  phone: string;
  email: string;
};

export type Ride = {
  id: string;
  from_location: string;
  to_location: string;
  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;
  time: string;
  requester_id: string;
  accepter_id: string | null;
  status: "pending" | "accepted" | "cancelled" | "completed";
  rider_name: string;
  rider_phone: string | null;
  note: string | null;
  is_edited: boolean;
  passenger_count: number;
  max_price: number | null;
  luggage_count: number | null;
  pet_preference: "any" | "pets_allowed" | "no_pets";
  smoking_preference: "any" | "non_smoking" | "smoking_allowed";
  accessibility_needs: string | null;
  vehicle_type: "any" | "sedan" | "suv" | "van";
  gender_preference: "any" | "female" | "male";
  requester_name?: string;
  offered_vehicle?: VehicleSnapshot | null;
};

export type VehicleType = "sedan" | "suv" | "van";
export type VehiclePetPolicy = "allowed" | "not_allowed";
export type VehicleSmokingPolicy = "non_smoking" | "smoking_allowed";

export type Vehicle = {
  id: string;
  user_id: string;
  make_model: string;
  year: number | null;
  color: string | null;
  seats: number;
  vehicle_type: VehicleType;
  pet_policy: VehiclePetPolicy;
  smoking_policy: VehicleSmokingPolicy;
  accessibility_features: string | null;
  is_active: boolean;
  created_at: string;
};

export type VehicleInput = Omit<Vehicle, "id" | "user_id" | "created_at">;
export type VehicleSnapshot = Omit<Vehicle, "user_id" | "created_at" | "is_active">;

export type DriverOfferStatus = "active" | "cancelled" | "completed";

export type DriverOfferInput = {
  from_location: string;
  to_location: string;
  departure_time: string;
  offered_price: number;
  available_places: number;
  pickup_details: string | null;
  message: string | null;
  vehicle_id: string;
  status: DriverOfferStatus;
};

export type DriverOffer = DriverOfferInput & {
  id: string;
  driver_id: string;
  driver_name: string;
  vehicle_snapshot: VehicleSnapshot;
  created_at: string;
};

export type Contact = {
  id: string;
  user_id: string;
  contact_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  user: {
    name: string;
    phone: string;
  };
  contact: {
    name: string;
    phone: string;
  };
};

export interface Notification {
  id: string;
  user_id: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_id?: string | null; // ID of the related entity (ride, contact, etc.)
  link?: string | null; // Optional direct link to navigate to
}

export type RideData = {
  from_location: string;
  to_location: string;
  from_lat: number;
  from_lon: number;
  to_lat: number;
  to_lon: number;
  time: string;
  rider_name: string;
  rider_phone: string | null;
  note: string | null;
  passenger_count: number;
  max_price: number | null;
  luggage_count: number | null;
  pet_preference: "any" | "pets_allowed" | "no_pets";
  smoking_preference: "any" | "non_smoking" | "smoking_allowed";
  accessibility_needs: string | null;
  vehicle_type: "any" | "sedan" | "suv" | "van";
  gender_preference: "any" | "female" | "male";
};

export type AssociatedPerson = {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
};

export type UserStats = {
  rides_offered: number;
  rides_accepted: number;
};

export type Note = {
  id: string;
  ride_id: string;
  user_id: string;
  note: string;
  created_at: string;
  is_edited: boolean;
  is_deleted: boolean;
  seen_by: string[];
  user?: {
    name: string;
  };
};

export type PushSubscription = {
  id: string;
  user_id: string;
  device_id: string;
  subscription: string;
  enabled: boolean;
  device_name: string;
  last_used: string;
};

// Report form data type
export interface ReportFormData {
  reason: string;
  details: string;
  report_type: "user" | "ride";
  reported_id: string;
  ride_id?: string | null;
}

// New Report type for user reporting feature
export interface Report {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  details: string;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  report_type: "user" | "ride";
  ride_id?: string | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  reporter_name?: string;
  reported_name?: string;
}

// Bug report form data type
export interface BugReportFormData {
  title: string;
  description: string;
  steps_to_reproduce?: string;
  severity: "low" | "medium" | "high" | "critical";
  device_info?: string;
  browser_info?: string;
}

// Bug report type
export interface BugReport {
  id: string;
  user_id: string;
  title: string;
  description: string;
  steps_to_reproduce?: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "in_progress" | "resolved" | "closed";
  device_info?: string;
  browser_info?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

// Bug report stats
export interface BugReportStats {
  totalBugs: number;
  openBugs: number;
  bySeverity: { severity: string; count: number }[];
  byStatus: { status: string; count: number }[];
}
