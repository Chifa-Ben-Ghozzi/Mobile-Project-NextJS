import { randomUUID } from "crypto";

import {
  type Db,
  type Document,
  type Filter,
  type ObjectId,
  MongoClient,
} from "mongodb";

type MongoDocument = Document;
type DatabaseError = Error & { code?: number | string };
type QueryOperation = "find" | "insert" | "update" | "delete" | "upsert";
type SelectOptions = {
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
};

export type DatabaseResult<T> =
  | { data: T; error: null; count: number | null }
  | { data: null; error: DatabaseError; count: number | null };

declare global {
  // Node's global augmentation requires var for cross-module caching.
  // eslint-disable-next-line no-var
  var mongoClientPromise: Promise<MongoClient> | undefined;
  // eslint-disable-next-line no-var
  var mongoDatabasePromise: Promise<Db> | undefined;
}

const indexedCollections = [
  "users",
  "rides",
  "vehicles",
  "driver_offers",
  "associated_people",
  "bug_reports",
  "contacts",
  "email_verification_tokens",
  "notifications",
  "password_reset_tokens",
  "push_subscriptions",
  "reports",
  "reclamations",
  "reviews",
  "ride_notes",
  "forum_messages",
] as const;

async function createIndexes(db: Db) {
  await Promise.all(
    indexedCollections.map((name) =>
      db.collection(name).createIndex({ id: 1 }, { unique: true })
    )
  );
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ phone: 1 }),
    db.collection("rides").createIndex({ requester_id: 1 }),
    db.collection("rides").createIndex({ accepter_id: 1 }),
    db.collection("vehicles").createIndex({ user_id: 1 }),
    db.collection("driver_offers").createIndex({ status: 1, departure_time: 1 }),
    db.collection("driver_offers").createIndex({ driver_id: 1 }),
    db.collection("associated_people").createIndex({ user_id: 1 }),
    db.collection("bug_reports").createIndex({ status: 1 }),
    db.collection("bug_reports").createIndex({ user_id: 1 }),
    db.collection("contacts").createIndex(
      { user_id: 1, contact_id: 1 },
      { unique: true }
    ),
    db.collection("contacts").createIndex({ contact_id: 1 }),
    db.collection("email_verification_tokens").createIndex({ token: 1 }, { unique: true }),
    db.collection("notifications").createIndex({ user_id: 1 }),
    db.collection("notifications").createIndex({ related_id: 1 }),
    db.collection("password_reset_tokens").createIndex({ expires_at: 1 }),
    db.collection("password_reset_tokens").createIndex({ token: 1 }),
    db.collection("password_reset_tokens").createIndex({ user_id: 1 }),
    db.collection("push_subscriptions").createIndex(
      { user_id: 1, device_id: 1 },
      { unique: true }
    ),
    db.collection("push_subscriptions").createIndex({ device_id: 1 }),
    db.collection("push_subscriptions").createIndex({ last_used: 1 }),
    db.collection("reports").createIndex({ reported_id: 1 }),
    db.collection("reports").createIndex({ reporter_id: 1 }),
    db.collection("reports").createIndex({ ride_id: 1 }),
    db.collection("reports").createIndex({ status: 1 }),
    db.collection("reclamations").createIndex({ user_id: 1 }),
    db.collection("reclamations").createIndex({ status: 1 }),
    db.collection("reclamations").createIndex({ created_at: -1 }),
    db.collection("reviews").createIndex({ created_at: -1 }),
    db.collection("reviews").createIndex({ is_approved: 1 }),
    db.collection("reviews").createIndex({ user_id: 1 }),
    db.collection("ride_notes").createIndex({ ride_id: 1 }),
    db.collection("forum_messages").createIndex({ created_at: -1 }),
    db.collection("forum_message_reactions").createIndex(
      { message_id: 1, user_id: 1, emoji: 1 },
      { unique: true }
    ),
    db.collection("forum_message_reactions").createIndex({ message_id: 1 }),
  ]);
}

async function getMongoDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI in your environment.");
  }

  if (!globalThis.mongoClientPromise) {
    const client = new MongoClient(uri);
    globalThis.mongoClientPromise = client.connect().catch((error: unknown) => {
      globalThis.mongoClientPromise = undefined;
      throw error;
    });
  }

  if (!globalThis.mongoDatabasePromise) {
    globalThis.mongoDatabasePromise = globalThis.mongoClientPromise
      .then(async (client) => {
        const db = client.db(process.env.MONGODB_DB || "ride_share");
        await createIndexes(db);
        return db;
      })
      .catch((error: unknown) => {
        globalThis.mongoDatabasePromise = undefined;
        throw error;
      });
  }

  return globalThis.mongoDatabasePromise;
}

function errorResult<T>(error: unknown): DatabaseResult<T> {
  return {
    data: null,
    error: error instanceof Error ? error : new Error(String(error)),
    count: null,
  };
}

function splitSelection(selection: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < selection.length; index += 1) {
    if (selection[index] === "(") depth += 1;
    if (selection[index] === ")") depth -= 1;
    if (selection[index] === "," && depth === 0) {
      fields.push(selection.slice(start, index).trim());
      start = index + 1;
    }
  }

  const lastField = selection.slice(start).trim();
  if (lastField) fields.push(lastField);
  return fields;
}

function selectionProjection(selection: string): Record<string, 1> | undefined {
  const fields = splitSelection(selection);
  if (fields.length === 0 || fields.includes("*")) return undefined;

  const projection: Record<string, 1> = {};
  for (const field of fields) {
    const relation = field.match(/^[^:]+:([^()]+)\(/);
    projection[relation?.[1] ?? field] = 1;
  }
  return projection;
}

function relationSelection(selection: string) {
  return splitSelection(selection)
    .map((field) => {
      const match = field.match(/^([^:]+):([^()]+)\(([^()]*)\)$/);
      if (!match) return null;
      const [, alias, foreignKey, fields] = match;
      if (alias === "user" && foreignKey === "user_id") {
        return { alias, foreignKey, collection: "users", fields };
      }
      if (alias === "ride" && foreignKey === "ride_id") {
        return { alias, foreignKey, collection: "rides", fields };
      }
      return null;
    })
    .filter((relation): relation is NonNullable<typeof relation> => relation !== null);
}

function stripMongoId(document: MongoDocument): MongoDocument {
  const { _id: _mongoId, ...result } = document;
  return result;
}

function projectSelectedFields(
  document: MongoDocument,
  selection: string
): MongoDocument {
  const stripped = stripMongoId(document);
  const fields = splitSelection(selection);
  if (fields.length === 0 || fields.includes("*")) return stripped;
  const result: MongoDocument = {};
  for (const field of fields) {
    if (!field.includes(":") && Object.prototype.hasOwnProperty.call(stripped, field)) {
      result[field] = stripped[field];
    }
  }
  return result;
}

function parseFilterValue(value: string): unknown {
  if (value === "null") return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

function splitFilterExpression(expression: string): string[] {
  const values: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < expression.length; index += 1) {
    if (expression[index] === "(") depth += 1;
    if (expression[index] === ")") depth -= 1;
    if (expression[index] === "," && depth === 0) {
      values.push(expression.slice(start, index).trim());
      start = index + 1;
    }
  }

  const lastValue = expression.slice(start).trim();
  if (lastValue) values.push(lastValue);
  return values;
}

function parseFilterExpression(expression: string): Filter<MongoDocument> {
  const trimmed = expression.trim();
  const group = trimmed.match(/^(and|or)\((.*)\)$/);
  if (group) {
    const operator = group[1] === "and" ? "$and" : "$or";
    return {
      [operator]: splitFilterExpression(group[2]).map(parseFilterExpression),
    };
  }

  const match = trimmed.match(/^([^.]*)\.(not\.)?(eq|neq|gt|gte|lt|lte|ilike|like|in|is)\.(.*)$/);
  if (!match) {
    throw new Error(`Unsupported MongoDB filter expression: ${expression}`);
  }

  const [, field, negated, operator, rawValue] = match;
  const value = rawValue.startsWith("(") && rawValue.endsWith(")")
    ? rawValue.slice(1, -1)
    : rawValue;

  if (operator === "in") {
    const values = splitFilterExpression(value).map(parseFilterValue);
    return { [field]: { [negated ? "$nin" : "$in"]: values } };
  }
  if (operator === "is") {
    const parsedValue = parseFilterValue(value);
    return { [field]: { [negated ? "$ne" : "$eq"]: parsedValue } };
  }
  if (operator === "ilike" || operator === "like") {
    const regex = value
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    const pattern = new RegExp(regex, operator === "ilike" ? "i" : "");
    return { [field]: negated ? { $not: pattern } : { $regex: regex, ...(operator === "ilike" ? { $options: "i" } : {}) } };
  }

  const mongoOperators: Record<string, string> = {
    eq: "$eq",
    neq: "$ne",
    gt: "$gt",
    gte: "$gte",
    lt: "$lt",
    lte: "$lte",
  };
  const parsedValue = parseFilterValue(value);
  if (!negated) return { [field]: { [mongoOperators[operator]]: parsedValue } };
  if (operator === "eq") return { [field]: { $ne: parsedValue } };
  if (operator === "neq") return { [field]: { $eq: parsedValue } };
  return { [field]: { $not: { [mongoOperators[operator]]: parsedValue } } };
}

function addDefaults(collection: string, input: MongoDocument): MongoDocument {
  const document = { ...input };
  const now = new Date().toISOString();
  if (collection !== "forum_message_reactions" && !document.id) {
    document.id = randomUUID();
  }
  document.created_at ??= now;

  switch (collection) {
    case "users":
      document.push_enabled ??= true;
      document.is_verified ??= false;
      break;
    case "rides":
      document.passenger_count ??= 1;
      document.pet_preference ??= "any";
      document.smoking_preference ??= "any";
      document.vehicle_type ??= "any";
      document.gender_preference ??= "any";
      document.is_edited ??= false;
      break;
    case "vehicles":
      document.seats ??= 4;
      document.pet_policy ??= "not_allowed";
      document.smoking_policy ??= "non_smoking";
      document.is_active ??= true;
      break;
    case "driver_offers":
      document.status ??= "active";
      break;
    case "reclamations":
      document.status ??= "pending";
      document.updated_at ??= now;
      break;
    case "bug_reports":
      document.status ??= "new";
      document.updated_at ??= now;
      break;
    case "notifications":
      document.is_read ??= false;
      if (!document.link && document.related_id) {
        if (["newNote", "rideAccepted", "rideCancelled", "rideCompleted"].includes(document.type)) {
          document.link = `/rides/${document.related_id}`;
        } else if (["contactRequest", "contactAccepted"].includes(document.type)) {
          document.link = "/profile?tab=contacts";
        } else if (document.type === "newRide") {
          document.link = "/dashboard";
        }
      }
      break;
    case "password_reset_tokens":
      document.updated_at ??= now;
      break;
    case "reports":
      document.updated_at ??= now;
      break;
    case "push_subscriptions":
      document.device_id ??= randomUUID();
      document.enabled ??= true;
      document.last_used ??= now;
      break;
    case "reviews":
      document.is_approved ??= false;
      break;
    case "ride_notes":
      document.is_edited ??= false;
      document.is_deleted ??= false;
      document.seen_by ??= [];
      break;
    case "forum_messages":
      document.updated_at ??= now;
      break;
  }

  return document;
}

async function deleteRelatedDocuments(db: Db, collection: string, documents: MongoDocument[]) {
  if (collection === "users") {
    const userIds = documents.map((document) => document.id).filter(Boolean);
    if (userIds.length === 0) return;
    const [vehicleRecords, ownedRides, authoredMessages] = await Promise.all([
      db.collection("vehicles").find({ user_id: { $in: userIds } }).project({ id: 1 }).toArray(),
      db.collection("rides").find({ requester_id: { $in: userIds } }).toArray(),
      db.collection("forum_messages").find({ user_id: { $in: userIds } }).toArray(),
    ]);
    const vehicleIds = vehicleRecords.map((vehicle) => vehicle.id);
    await Promise.all([
      deleteRelatedDocuments(db, "rides", ownedRides),
      deleteRelatedDocuments(db, "forum_messages", authoredMessages),
    ]);
    await Promise.all([
      db.collection("associated_people").deleteMany({ user_id: { $in: userIds } }),
      db.collection("contacts").deleteMany({
        $or: [{ user_id: { $in: userIds } }, { contact_id: { $in: userIds } }],
      }),
      db.collection("email_verification_tokens").deleteMany({ user_id: { $in: userIds } }),
      db.collection("notifications").deleteMany({ user_id: { $in: userIds } }),
      db.collection("password_reset_tokens").deleteMany({ user_id: { $in: userIds } }),
      db.collection("push_subscriptions").deleteMany({ user_id: { $in: userIds } }),
      db.collection("bug_reports").deleteMany({ user_id: { $in: userIds } }),
      db.collection("reports").deleteMany({
        $or: [{ reporter_id: { $in: userIds } }, { reported_id: { $in: userIds } }],
      }),
      db.collection("reclamations").deleteMany({ user_id: { $in: userIds } }),
      db.collection("reviews").deleteMany({ user_id: { $in: userIds } }),
      db.collection("ride_notes").deleteMany({ user_id: { $in: userIds } }),
      db.collection("forum_message_reactions").deleteMany({ user_id: { $in: userIds } }),
      db.collection("rides").deleteMany({ requester_id: { $in: userIds } }),
      db.collection("rides").updateMany(
        { accepter_id: { $in: userIds } },
        { $set: { accepter_id: null } }
      ),
      db.collection("vehicles").deleteMany({ user_id: { $in: userIds } }),
      db.collection("driver_offers").deleteMany({ driver_id: { $in: userIds } }),
      db.collection("forum_messages").deleteMany({ user_id: { $in: userIds } }),
    ]);
    if (vehicleIds.length > 0) {
      await db
        .collection("driver_offers")
        .updateMany({ vehicle_id: { $in: vehicleIds } }, { $set: { vehicle_id: null } });
    }
    return;
  }

  if (collection === "rides") {
    const rideIds = documents.map((document) => document.id).filter(Boolean);
    if (rideIds.length === 0) return;
    await Promise.all([
      db.collection("ride_notes").deleteMany({ ride_id: { $in: rideIds } }),
      db.collection("reports").updateMany(
        { ride_id: { $in: rideIds } },
        { $set: { ride_id: null } }
      ),
      db.collection("reclamations").updateMany(
        { ride_id: { $in: rideIds } },
        { $set: { ride_id: null } }
      ),
    ]);
    return;
  }

  if (collection === "vehicles") {
    const vehicleIds = documents.map((document) => document.id).filter(Boolean);
    if (vehicleIds.length > 0) {
      await db
        .collection("driver_offers")
        .updateMany({ vehicle_id: { $in: vehicleIds } }, { $set: { vehicle_id: null } });
    }
    return;
  }

  if (collection === "forum_messages") {
    const messageIds = documents.map((document) => document.id).filter(Boolean);
    if (messageIds.length > 0) {
      await db
        .collection("forum_message_reactions")
        .deleteMany({ message_id: { $in: messageIds } });
    }
  }
}

class MongoQuery<T = MongoDocument[]> implements PromiseLike<DatabaseResult<T>> {
  private readonly filters: Filter<MongoDocument>[] = [];
  private operation: QueryOperation = "find";
  private payload: MongoDocument | MongoDocument[] = {};
  private selection = "*";
  private selectionOptions: SelectOptions = {};
  private returningData = false;
  private sort: Record<string, 1 | -1> = {};
  private maxResults: number | undefined;
  private offset = 0;
  private singleResult = false;
  private optionalSingleResult = false;
  private conflictFields: string[] = [];
  private ignoreDuplicates = false;
  private execution: Promise<DatabaseResult<T>> | undefined;

  constructor(private readonly collectionName: string) {}

  select(selection = "*", options: SelectOptions = {}): this {
    this.selection = selection;
    this.selectionOptions = options;
    this.returningData = true;
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ [field]: { $eq: value } });
    return this;
  }

  neq(field: string, value: unknown): this {
    this.filters.push({ [field]: { $ne: value } });
    return this;
  }

  gt(field: string, value: unknown): this {
    this.filters.push({ [field]: { $gt: value } });
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters.push({ [field]: { $gte: value } });
    return this;
  }

  lt(field: string, value: unknown): this {
    this.filters.push({ [field]: { $lt: value } });
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push({ [field]: { $lte: value } });
    return this;
  }

  in(field: string, values: readonly unknown[]): this {
    this.filters.push({ [field]: { $in: [...values] } });
    return this;
  }

  is(field: string, value: unknown): this {
    this.filters.push({ [field]: value === null ? null : { $eq: value } });
    return this;
  }

  not(field: string, operator: string, value: unknown): this {
    if (operator === "like" || operator === "ilike") {
      const regex = String(value)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      this.filters.push({
        [field]: {
          $not: new RegExp(regex, operator === "ilike" ? "i" : ""),
        },
      });
      return this;
    }

    const operators: Record<string, string> = {
      eq: "$ne",
      neq: "$eq",
      is: "$ne",
      in: "$nin",
      like: "$not",
      ilike: "$not",
    };
    const mongoOperator = operators[operator];
    if (!mongoOperator) throw new Error(`Unsupported MongoDB negation operator: ${operator}`);
    const condition = operator === "is" && value === null
      ? { $ne: null }
      : { [mongoOperator]: value };
    this.filters.push({ [field]: condition });
    return this;
  }

  ilike(field: string, pattern: string): this {
    const regex = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    this.filters.push({ [field]: { $regex: regex, $options: "i" } });
    return this;
  }

  like(field: string, pattern: string): this {
    const regex = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    this.filters.push({ [field]: { $regex: regex } });
    return this;
  }

  or(expression: string): this {
    this.filters.push(parseFilterExpression(`or(${expression})`));
    return this;
  }

  orIlike(fields: string[], value: string): this {
    const regex = value
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".");
    this.filters.push({
      $or: fields.map((field) => ({
        [field]: { $regex: regex, $options: "i" },
      })),
    });
    return this;
  }

  match(values: MongoDocument): this {
    for (const [field, value] of Object.entries(values)) {
      this.filters.push({ [field]: { $eq: value } });
    }
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}): this {
    this.sort[field] = options.ascending === false ? -1 : 1;
    return this;
  }

  limit(count: number): this {
    this.maxResults = count;
    return this;
  }

  range(from: number, to: number): this {
    this.offset = from;
    this.maxResults = Math.max(0, to - from + 1);
    return this;
  }

  single(): MongoQuery<any> {
    this.singleResult = true;
    this.optionalSingleResult = false;
    return this as unknown as MongoQuery<any>;
  }

  maybeSingle(): MongoQuery<any | null> {
    this.singleResult = true;
    this.optionalSingleResult = true;
    return this as unknown as MongoQuery<any | null>;
  }

  insert(values: MongoDocument | MongoDocument[]): this {
    this.operation = "insert";
    this.payload = values;
    return this;
  }

  update(values: MongoDocument): this {
    this.operation = "update";
    this.payload = values;
    return this;
  }

  delete(): this {
    this.operation = "delete";
    this.payload = {};
    return this;
  }

  upsert(
    values: MongoDocument | MongoDocument[],
    options: { onConflict?: string; ignoreDuplicates?: boolean } = {}
  ): this {
    this.operation = "upsert";
    this.payload = values;
    this.conflictFields = options.onConflict?.split(",").map((field) => field.trim()) ?? [];
    this.ignoreDuplicates = options.ignoreDuplicates ?? false;
    return this;
  }

  private getFilter(): Filter<MongoDocument> {
    if (this.filters.length === 0) return {};
    if (this.filters.length === 1) return this.filters[0];
    return { $and: this.filters };
  }

  private async findSelected(
    db: Db,
    filter: Filter<MongoDocument>,
    ids?: ObjectId[]
  ): Promise<MongoDocument[]> {
    const collection = db.collection<MongoDocument>(this.collectionName);
    const projection = selectionProjection(this.selection);
    const queryFilter = ids ? { _id: { $in: ids } } : filter;
    let cursor = collection.find(queryFilter, projection ? { projection } : {});
    if (Object.keys(this.sort).length > 0) cursor = cursor.sort(this.sort);
    if (this.offset > 0) cursor = cursor.skip(this.offset);
    if (this.maxResults !== undefined) cursor = cursor.limit(this.maxResults);

    const documents = await cursor.toArray();
    const relations = relationSelection(this.selection);
    const relatedDocuments = await Promise.all(
      documents.map(async (document) => {
        const result = stripMongoId(document);
        for (const relation of relations) {
          const foreignId = document[relation.foreignKey];
          const related = foreignId
            ? await db
                .collection<MongoDocument>(relation.collection)
                .findOne(
                  { id: foreignId },
                  { projection: selectionProjection(relation.fields) }
                )
            : null;
          result[relation.alias] = related ? stripMongoId(related) : null;
          if (!splitSelection(this.selection).includes(relation.foreignKey)) {
            delete result[relation.foreignKey];
          }
        }
        return result;
      })
    );
    return relatedDocuments;
  }

  private async performUpsert(db: Db, filter: Filter<MongoDocument>) {
    const collection = db.collection<MongoDocument>(this.collectionName);
    const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
    const results: MongoDocument[] = [];

    for (const input of inputs) {
      const document = addDefaults(this.collectionName, input);
      const conflictFilter = this.conflictFields.length > 0
        ? Object.fromEntries(this.conflictFields.map((field) => [field, document[field]]))
        : filter;
      if (Object.keys(conflictFilter).length === 0) {
        throw new Error(`MongoDB upsert requires conflict fields for ${this.collectionName}.`);
      }

      const defaults = addDefaults(this.collectionName, {});
      const insertOnlyFields = Object.fromEntries(
        Object.entries(defaults).filter(([field]) => !(field in input))
      );
      await collection.updateOne(
        conflictFilter,
        this.ignoreDuplicates
          ? { $setOnInsert: document }
          : { $set: input, $setOnInsert: insertOnlyFields },
        { upsert: true }
      );
      const saved = await collection.findOne(conflictFilter);
      if (saved) results.push(saved);
    }

    return results;
  }

  private async executeQuery(): Promise<DatabaseResult<T>> {
    try {
      const db = await getMongoDatabase();
      const collection = db.collection<MongoDocument>(this.collectionName);
      const filter = this.getFilter();
      const shouldReturnData = this.operation === "find" || this.returningData;
      let data: MongoDocument[] | null = null;
      let count: number | null = null;

      if (this.selectionOptions.count) {
        count = await collection.countDocuments(filter);
      }

      if (this.operation === "find") {
        if (this.selectionOptions.head) {
          data = null;
        } else {
          data = await this.findSelected(db, filter);
        }
      } else if (this.operation === "insert") {
        const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
        const documents = inputs.map((input) => addDefaults(this.collectionName, input));
        if (documents.length > 0) {
          await collection.insertMany(documents);
          if (shouldReturnData) {
            data = await this.findSelected(
              db,
              { id: { $in: documents.map((document) => document.id).filter(Boolean) } }
            );
          }
        } else if (shouldReturnData) {
          data = [];
        }
      } else if (this.operation === "upsert") {
        const saved = await this.performUpsert(db, filter);
        if (shouldReturnData) {
          data = await this.findSelected(
            db,
            filter,
            saved.map((document) => document._id)
          );
        }
      } else if (this.operation === "update") {
        let matchedIds: ObjectId[] | undefined;
        if (shouldReturnData) {
          matchedIds = (await collection.find(filter, { projection: { _id: 1 } }).toArray()).map(
            (document) => document._id
          );
        }
        if (Object.keys(this.payload).length > 0) {
          await collection.updateMany(filter, {
            $set: {
              ...this.payload,
              ...(this.collectionName === "bug_reports" ||
              this.collectionName === "password_reset_tokens" ||
              this.collectionName === "reports" ||
              this.collectionName === "reclamations" ||
              this.collectionName === "forum_messages"
                ? { updated_at: new Date().toISOString() }
                : {}),
            },
          });
        }
        if (shouldReturnData) data = await this.findSelected(db, filter, matchedIds);
      } else if (this.operation === "delete") {
        const documents = shouldReturnData ? await collection.find(filter).toArray() : [];
        await deleteRelatedDocuments(db, this.collectionName, documents);
        await collection.deleteMany(filter);
        if (shouldReturnData) {
          data = await Promise.all(
            documents.map(async (document) => {
              const relations = relationSelection(this.selection);
              const result = projectSelectedFields(document, this.selection);
              for (const relation of relations) {
                const foreignId = document[relation.foreignKey];
                const related = foreignId
                  ? await db
                      .collection<MongoDocument>(relation.collection)
                      .findOne(
                        { id: foreignId },
                        { projection: selectionProjection(relation.fields) }
                      )
                  : null;
                result[relation.alias] = related ? stripMongoId(related) : null;
              }
              return result;
            })
          );
        }
      }

      if (this.singleResult) {
        const documents = data ?? [];
        if (documents.length !== 1) {
          if (documents.length === 0 && this.optionalSingleResult) {
            return { data: null as T, error: null, count };
          }
          return {
            data: null,
            error: Object.assign(
              new Error(
                documents.length === 0
                  ? "No rows returned."
                  : "Multiple rows returned for a single-document query."
              ),
              { code: "PGRST116" }
            ),
            count,
          };
        }
        return { data: documents[0] as T, error: null, count };
      }

      return {
        data: (
          this.selectionOptions.head || !shouldReturnData ? null : (data ?? [])
        ) as T,
        error: null,
        count,
      };
    } catch (error) {
      return errorResult<T>(error);
    }
  }

  private execute(): Promise<DatabaseResult<T>> {
    this.execution ??= this.executeQuery();
    return this.execution;
  }

  then<TResult1 = DatabaseResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DatabaseResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

async function countByField(collectionName: string, field: string, limit?: number) {
  const db = await getMongoDatabase();
  const counts = await db
    .collection(collectionName)
    .aggregate<{ _id: string; count: number }>([
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $sort: { ...(field === "reason" ? { count: -1 } : { _id: 1 }) } },
      ...(limit ? [{ $limit: limit }] : []),
    ])
    .toArray();
  return counts.map(({ _id, count }) => ({ [field]: _id, count }));
}

function removeDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export const database = {
  collection<T = any>(name: string): MongoQuery<T[]> {
    return new MongoQuery<T[]>(name);
  },

  async rpc(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<DatabaseResult<any[]>> {
    try {
      if (name.startsWith("count_reports_by_")) {
        const field = name.slice("count_reports_by_".length);
        if (["type", "status", "reason"].includes(field)) {
          return {
            data: await countByField("reports", field === "type" ? "report_type" : field, field === "reason" ? 10 : undefined),
            error: null,
            count: null,
          };
        }
      }
      if (name === "count_bug_reports_by_severity" || name === "count_bug_reports_by_status") {
        const field = name.endsWith("_severity") ? "severity" : "status";
        return { data: await countByField("bug_reports", field), error: null, count: null };
      }
      if (name === "get_approved_reviews") {
        const db = await getMongoDatabase();
        const reviews = await db
          .collection("reviews")
          .find({ is_approved: true })
          .sort({ created_at: -1 })
          .project({ id: 1, reviewer_name: 1, review: 1, rating: 1, created_at: 1, _id: 0 })
          .toArray();
        return {
          data: reviews.map(({ reviewer_name, ...review }) => ({
            ...review,
            user_name: reviewer_name,
          })),
          error: null,
          count: null,
        };
      }
      if (name === "search_users_with_unaccent") {
        const db = await getMongoDatabase();
        const searchQuery = removeDiacritics(String(args.search_query ?? ""));
        const currentUserId = args.current_user_id;
        const limit = Number(args.limit_count ?? 7);
        const users = await db
          .collection("users")
          .find({ id: { $ne: currentUserId } })
          .project({ id: 1, name: 1, phone: 1, _id: 0 })
          .toArray();
        const matches = users
          .filter(
            (user) =>
              removeDiacritics(String(user.name ?? "")).includes(searchQuery) ||
              removeDiacritics(String(user.phone ?? "")).includes(searchQuery)
          )
          .slice(0, limit);
        return { data: matches, error: null, count: null };
      }
      throw new Error(`Unsupported MongoDB operation: ${name}`);
    } catch (error) {
      return errorResult<any[]>(error);
    }
  },
};
