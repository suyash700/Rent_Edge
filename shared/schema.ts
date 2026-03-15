import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["owner", "tenant", "admin", "pg_owner"]);
export const paymentStatusEnum = pgEnum("payment_status", ["due", "late", "paid"]);
export const proofStatusEnum = pgEnum("proof_status", ["none", "submitted", "verified", "rejected"]);
export const rentCycleEnum = pgEnum("rent_cycle", ["monthly", "quarterly", "half_yearly", "yearly"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "rent_due", "rent_late", "payment_received", "proof_submitted",
  "proof_verified", "proof_rejected", "tenant_joined", "tenant_removed"
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  phone: varchar("phone", { length: 10 }).notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("tenant"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  tenantId: integer("tenant_id").references(() => users.id),
  propertyCode: varchar("property_code", { length: 6 }).notNull().unique(),
  serialNumber: integer("serial_number").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  monthlyRent: integer("monthly_rent").notNull(),
  rentDueDay: integer("rent_due_day").notNull().default(1),
  onboardingStartDay: integer("onboarding_start_day").notNull(),
  onboardingStartMonth: integer("onboarding_start_month").notNull(),
  onboardingStartYear: integer("onboarding_start_year").notNull(),
  ownerName: text("owner_name").notNull(),
  ownerUpiId: text("owner_upi_id"),
  securityDeposit: integer("security_deposit").notNull(),
  depositBalance: integer("deposit_balance").notNull(),
  tenantJoinedAt: timestamp("tenant_joined_at"),
  electricianName: text("electrician_name"),
  electricianPhone: varchar("electrician_phone", { length: 10 }),
  plumberName: text("plumber_name"),
  plumberPhone: varchar("plumber_phone", { length: 10 }),
  mechanicName: text("mechanic_name"),
  mechanicPhone: varchar("mechanic_phone", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rentPayments = pgTable("rent_payments", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => properties.id),
  tenantId: integer("tenant_id").notNull().references(() => users.id),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  rentAmount: integer("rent_amount").notNull(),
  fineAmount: integer("fine_amount").notNull().default(0),
  status: paymentStatusEnum("status").notNull().default("due"),
  proofStatus: proofStatusEnum("proof_status").notNull().default("none"),
  proofImageUrl: text("proof_image_url"),
  transactionId: text("transaction_id"),
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  propertyId: integer("property_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pgProperties = pgTable("pg_properties", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  propertyCode: varchar("property_code", { length: 6 }).notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  ownerName: text("owner_name").notNull(),
  ownerUpiId: text("owner_upi_id"),
  electricianName: text("electrician_name"),
  electricianPhone: varchar("electrician_phone", { length: 10 }),
  plumberName: text("plumber_name"),
  plumberPhone: varchar("plumber_phone", { length: 10 }),
  mechanicName: text("mechanic_name"),
  mechanicPhone: varchar("mechanic_phone", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const beds = pgTable("beds", {
  id: serial("id").primaryKey(),
  pgPropertyId: integer("pg_property_id").notNull().references(() => pgProperties.id),
  tenantId: integer("tenant_id").references(() => users.id),
  bedCode: varchar("bed_code", { length: 10 }).notNull().unique(),
  bedNumber: text("bed_number").notNull(),
  roomNumber: text("room_number"),
  rentAmount: integer("rent_amount").notNull(),
  rentCycle: rentCycleEnum("rent_cycle").notNull().default("monthly"),
  securityDeposit: integer("security_deposit").notNull(),
  depositBalance: integer("deposit_balance").notNull(),
  onboardingStartDay: integer("onboarding_start_day"),
  onboardingStartMonth: integer("onboarding_start_month"),
  onboardingStartYear: integer("onboarding_start_year"),
  tenantJoinedAt: timestamp("tenant_joined_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bedPayments = pgTable("bed_payments", {
  id: serial("id").primaryKey(),
  bedId: integer("bed_id").notNull().references(() => beds.id),
  tenantId: integer("tenant_id").notNull().references(() => users.id),
  cycleStartDate: timestamp("cycle_start_date").notNull(),
  cycleEndDate: timestamp("cycle_end_date").notNull(),
  rentAmount: integer("rent_amount").notNull(),
  fineAmount: integer("fine_amount").notNull().default(0),
  status: paymentStatusEnum("status").notNull().default("due"),
  proofStatus: proofStatusEnum("proof_status").notNull().default("none"),
  proofImageUrl: text("proof_image_url"),
  transactionId: text("transaction_id"),
  rejectionReason: text("rejection_reason"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  ownedProperties: many(properties, { relationName: "owner" }),
  rentedProperty: many(properties, { relationName: "tenant" }),
  rentPayments: many(rentPayments),
  notifications: many(notifications),
  ownedPgProperties: many(pgProperties, { relationName: "pgOwner" }),
  beds: many(beds, { relationName: "bedTenant" }),
  bedPayments: many(bedPayments),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(users, {
    fields: [properties.ownerId],
    references: [users.id],
    relationName: "owner",
  }),
  tenant: one(users, {
    fields: [properties.tenantId],
    references: [users.id],
    relationName: "tenant",
  }),
  rentPayments: many(rentPayments),
}));

export const rentPaymentsRelations = relations(rentPayments, ({ one }) => ({
  property: one(properties, {
    fields: [rentPayments.propertyId],
    references: [properties.id],
  }),
  tenant: one(users, {
    fields: [rentPayments.tenantId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const pgPropertiesRelations = relations(pgProperties, ({ one, many }) => ({
  owner: one(users, {
    fields: [pgProperties.ownerId],
    references: [users.id],
    relationName: "pgOwner",
  }),
  beds: many(beds),
}));

export const bedsRelations = relations(beds, ({ one, many }) => ({
  pgProperty: one(pgProperties, {
    fields: [beds.pgPropertyId],
    references: [pgProperties.id],
  }),
  tenant: one(users, {
    fields: [beds.tenantId],
    references: [users.id],
    relationName: "bedTenant",
  }),
  payments: many(bedPayments),
}));

export const bedPaymentsRelations = relations(bedPayments, ({ one }) => ({
  bed: one(beds, {
    fields: [bedPayments.bedId],
    references: [beds.id],
  }),
  tenant: one(users, {
    fields: [bedPayments.tenantId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
  propertyCode: true,
  serialNumber: true,
  tenantId: true,
  tenantJoinedAt: true,
  depositBalance: true,
  rentDueDay: true,
});

export const insertRentPaymentSchema = createInsertSchema(rentPayments).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertPgPropertySchema = createInsertSchema(pgProperties).omit({
  id: true,
  createdAt: true,
  propertyCode: true,
});

export const insertBedSchema = createInsertSchema(beds).omit({
  id: true,
  createdAt: true,
  bedCode: true,
  tenantId: true,
  tenantJoinedAt: true,
  depositBalance: true,
  onboardingStartDay: true,
  onboardingStartMonth: true,
  onboardingStartYear: true,
});

export const insertBedPaymentSchema = createInsertSchema(bedPayments).omit({
  id: true,
  createdAt: true,
});

export const loginSchema = z.object({
  phone: z.string().length(10, "Phone number must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z.object({
  phone: z.string().length(10, "Phone number must be 10 digits"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
  role: z.enum(["owner", "tenant", "pg_owner"]),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Property = typeof properties.$inferSelect;
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type RentPayment = typeof rentPayments.$inferSelect;
export type InsertRentPayment = z.infer<typeof insertRentPaymentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type PgProperty = typeof pgProperties.$inferSelect;
export type InsertPgProperty = z.infer<typeof insertPgPropertySchema>;
export type Bed = typeof beds.$inferSelect;
export type InsertBed = z.infer<typeof insertBedSchema>;
export type BedPayment = typeof bedPayments.$inferSelect;
export type InsertBedPayment = z.infer<typeof insertBedPaymentSchema>;

export type PropertyWithTenant = Property & {
  tenant?: User | null;
};

export type PropertyWithPayments = Property & {
  tenant?: User | null;
  rentPayments: RentPayment[];
};

export type BedWithTenant = Bed & {
  tenant?: User | null;
};

export type PgPropertyWithBeds = PgProperty & {
  beds: BedWithTenant[];
};

export type BedWithPayments = Bed & {
  tenant?: User | null;
  payments: BedPayment[];
};
