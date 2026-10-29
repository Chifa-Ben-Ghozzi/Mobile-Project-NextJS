import { supabase } from "@/lib/db";
import { isUuid } from "@/lib/uuid";

type ContactUser = {
  id: string;
  name: string;
  phone: string;
};

type ContactRecord = {
  id: string;
  user_id: string;
  contact_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
  country_code: string | null;
  user: ContactUser;
  contact: ContactUser;
};

/**
 * Fetches all contacts for a given user
 *
 * @param userId - The ID of the user whose contacts to fetch
 * @returns An object containing the contacts data and any error
 */
export async function getUserContacts(userId: string) {
  if (!isUuid(userId)) {
    return { data: null, error: new Error("A valid user ID is required to load contacts.") };
  }

  const { data: contacts, error: contactsError } = await supabase
    .from("contacts")
    .select("*")
    .or(`user_id.eq.${userId},contact_id.eq.${userId}`);

  if (contactsError) {
    return { data: null, error: contactsError };
  }

  const validContacts = (contacts || []).filter(({ user_id, contact_id }) => {
    const valid = isUuid(user_id) && isUuid(contact_id);
    if (!valid) {
      console.error("Ignoring contact record with invalid user IDs:", { user_id, contact_id });
    }
    return valid;
  });

  if (!validContacts.length) {
    return { data: [], error: null };
  }

  const userIds = Array.from(
    new Set(validContacts.flatMap(({ user_id, contact_id }) => [user_id, contact_id]))
  );
  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, phone")
    .in("id", userIds);

  if (usersError) {
    return { data: null, error: usersError };
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const missingUser = validContacts.some(
    ({ user_id, contact_id }) => !usersById.has(user_id) || !usersById.has(contact_id)
  );
  if (missingUser) {
    return { data: null, error: new Error("Could not load users for contact records") };
  }

  const contactRecords: ContactRecord[] = validContacts.map((contact) => {
    const user = usersById.get(contact.user_id);
    const contactUser = usersById.get(contact.contact_id);
    if (!user || !contactUser) {
      throw new Error("Could not load users for contact records");
    }
    return { ...contact, user, contact: contactUser };
  });

  return { data: contactRecords, error: null };
}
