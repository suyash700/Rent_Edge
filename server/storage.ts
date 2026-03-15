import {
  users, properties, rentPayments, notifications, pgProperties, beds, bedPayments,
  type User, type InsertUser, type Property, type InsertProperty,
  type RentPayment, type InsertRentPayment, type Notification, type InsertNotification,
  type PropertyWithTenant, type PropertyWithPayments,
  type PgProperty, type InsertPgProperty, type Bed, type InsertBed,
  type BedPayment, type InsertBedPayment, type BedWithTenant, type PgPropertyWithBeds, type BedWithPayments
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import bcrypt from "bcrypt";

function generatePropertyCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  
  getOwnerWithFullData(ownerId: number): Promise<{
    owner: User;
    properties: (Property & { tenant?: User; rentPayments: RentPayment[] })[];
  } | undefined>;
  
  getPropertiesByOwner(ownerId: number): Promise<PropertyWithTenant[]>;
  getPropertyById(id: number): Promise<PropertyWithPayments | undefined>;
  getPropertyByCode(code: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty & { ownerId: number }): Promise<Property>;
  assignTenant(propertyId: number, tenantId: number): Promise<Property>;
  removeTenant(propertyId: number): Promise<Property>;
  getPropertyByTenant(tenantId: number): Promise<PropertyWithPayments | undefined>;
  getAllProperties(): Promise<(Property & { owner?: User; tenant?: User; rentPayments: RentPayment[] })[]>;
  updatePropertyDeposit(propertyId: number, newBalance: number): Promise<void>;
  
  getRentPaymentsByProperty(propertyId: number): Promise<RentPayment[]>;
  getCurrentPayment(propertyId: number, tenantId: number): Promise<RentPayment | undefined>;
  getPaymentById(paymentId: number): Promise<RentPayment | undefined>;
  createRentPayment(payment: InsertRentPayment): Promise<RentPayment>;
  updatePaymentProof(paymentId: number, proofUrl: string | null, transactionId?: string): Promise<RentPayment>;
  verifyPayment(paymentId: number, approved: boolean, rejectionReason?: string): Promise<RentPayment>;
  markPaymentPaid(paymentId: number): Promise<RentPayment>;
  updatePaymentFine(paymentId: number, fineAmount: number): Promise<RentPayment>;
  adminUpdateFine(paymentId: number, fineAmount: number): Promise<RentPayment>;
  
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;
  
  getPgPropertiesByOwner(ownerId: number): Promise<PgPropertyWithBeds[]>;
  getPgPropertyById(id: number): Promise<PgPropertyWithBeds | undefined>;
  getPgPropertyByCode(code: string): Promise<PgProperty | undefined>;
  createPgProperty(property: InsertPgProperty & { ownerId: number }): Promise<PgProperty>;
  getAllPgProperties(): Promise<(PgProperty & { owner?: User; beds: BedWithTenant[] })[]>;
  
  getBedById(id: number): Promise<BedWithPayments | undefined>;
  getBedByCode(code: string): Promise<Bed | undefined>;
  createBed(bed: InsertBed & { pgPropertyId: number }): Promise<Bed>;
  assignTenantToBed(bedId: number, tenantId: number, onboardingDay: number, onboardingMonth: number, onboardingYear: number): Promise<Bed>;
  removeTenantFromBed(bedId: number): Promise<Bed>;
  getBedByTenant(tenantId: number): Promise<BedWithPayments | undefined>;
  updateBedDeposit(bedId: number, newBalance: number): Promise<void>;
  
  getBedPaymentsByBed(bedId: number): Promise<BedPayment[]>;
  getCurrentBedPayment(bedId: number, tenantId: number): Promise<BedPayment | undefined>;
  getBedPaymentById(paymentId: number): Promise<BedPayment | undefined>;
  createBedPayment(payment: InsertBedPayment): Promise<BedPayment>;
  updateBedPaymentProof(paymentId: number, proofUrl: string | null, transactionId?: string): Promise<BedPayment>;
  verifyBedPayment(paymentId: number, approved: boolean, rejectionReason?: string): Promise<BedPayment>;
  markBedPaymentPaid(paymentId: number): Promise<BedPayment>;
  updateBedPaymentFine(paymentId: number, fineAmount: number): Promise<BedPayment>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, id));
    await db.update(properties).set({ tenantId: null }).where(eq(properties.tenantId, id));
    await db.delete(users).where(eq(users.id, id));
  }

  async getOwnerWithFullData(ownerId: number): Promise<{
    owner: User;
    properties: (Property & { tenant?: User; rentPayments: RentPayment[] })[];
  } | undefined> {
    const [owner] = await db.select().from(users).where(eq(users.id, ownerId));
    if (!owner || owner.role !== "owner") return undefined;

    const props = await db.select().from(properties).where(eq(properties.ownerId, ownerId));
    const result: (Property & { tenant?: User; rentPayments: RentPayment[] })[] = [];
    
    for (const prop of props) {
      let tenant: User | undefined;
      if (prop.tenantId) {
        const [t] = await db.select().from(users).where(eq(users.id, prop.tenantId));
        tenant = t;
      }
      const payments = await db.select().from(rentPayments).where(eq(rentPayments.propertyId, prop.id)).orderBy(desc(rentPayments.createdAt));
      result.push({ ...prop, tenant, rentPayments: payments });
    }
    
    return { owner, properties: result };
  }

  async getPropertiesByOwner(ownerId: number): Promise<PropertyWithTenant[]> {
    const props = await db.select().from(properties).where(eq(properties.ownerId, ownerId)).orderBy(properties.serialNumber);
    
    const result: PropertyWithTenant[] = [];
    for (const prop of props) {
      let tenant: User | null = null;
      if (prop.tenantId) {
        const [t] = await db.select().from(users).where(eq(users.id, prop.tenantId));
        tenant = t || null;
      }
      result.push({ ...prop, tenant });
    }
    return result;
  }

  async getPropertyById(id: number): Promise<PropertyWithPayments | undefined> {
    const [prop] = await db.select().from(properties).where(eq(properties.id, id));
    if (!prop) return undefined;

    let tenant: User | null = null;
    if (prop.tenantId) {
      const [t] = await db.select().from(users).where(eq(users.id, prop.tenantId));
      tenant = t || null;
    }

    const payments = await db.select().from(rentPayments).where(eq(rentPayments.propertyId, id)).orderBy(desc(rentPayments.createdAt));

    return { ...prop, tenant, rentPayments: payments };
  }

  async getPropertyByCode(code: string): Promise<Property | undefined> {
    const [prop] = await db.select().from(properties).where(eq(properties.propertyCode, code.toUpperCase()));
    return prop || undefined;
  }

  async createProperty(property: InsertProperty & { ownerId: number }): Promise<Property> {
    const ownerProperties = await db.select().from(properties).where(eq(properties.ownerId, property.ownerId));
    const serialNumber = ownerProperties.length + 1;
    
    let propertyCode = generatePropertyCode();
    let existing = await this.getPropertyByCode(propertyCode);
    while (existing) {
      propertyCode = generatePropertyCode();
      existing = await this.getPropertyByCode(propertyCode);
    }

    const [prop] = await db
      .insert(properties)
      .values({
        ...property,
        propertyCode,
        serialNumber,
        depositBalance: property.securityDeposit,
      })
      .returning();
    return prop;
  }

  async assignTenant(propertyId: number, tenantId: number): Promise<Property> {
    const [prop] = await db
      .update(properties)
      .set({ tenantId, tenantJoinedAt: new Date() })
      .where(eq(properties.id, propertyId))
      .returning();
    return prop;
  }

  async removeTenant(propertyId: number): Promise<Property> {
    const [prop] = await db
      .update(properties)
      .set({ tenantId: null, tenantJoinedAt: null })
      .where(eq(properties.id, propertyId))
      .returning();
    return prop;
  }

  async getPropertyByTenant(tenantId: number): Promise<PropertyWithPayments | undefined> {
    const [prop] = await db.select().from(properties).where(eq(properties.tenantId, tenantId));
    if (!prop) return undefined;

    const [owner] = await db.select().from(users).where(eq(users.id, prop.ownerId));
    const payments = await db.select().from(rentPayments).where(eq(rentPayments.propertyId, prop.id)).orderBy(desc(rentPayments.createdAt));

    return { ...prop, owner, rentPayments: payments } as PropertyWithPayments & { owner?: User };
  }

  async getAllProperties(): Promise<(Property & { owner?: User; tenant?: User; rentPayments: RentPayment[] })[]> {
    const props = await db.select().from(properties);
    const result = [];
    
    for (const prop of props) {
      const [owner] = await db.select().from(users).where(eq(users.id, prop.ownerId));
      let tenant: User | undefined;
      if (prop.tenantId) {
        const [t] = await db.select().from(users).where(eq(users.id, prop.tenantId));
        tenant = t;
      }
      const payments = await db.select().from(rentPayments).where(eq(rentPayments.propertyId, prop.id));
      result.push({ ...prop, owner, tenant, rentPayments: payments });
    }
    
    return result;
  }

  async updatePropertyDeposit(propertyId: number, newBalance: number): Promise<void> {
    await db.update(properties).set({ depositBalance: newBalance }).where(eq(properties.id, propertyId));
  }

  async getRentPaymentsByProperty(propertyId: number): Promise<RentPayment[]> {
    return db.select().from(rentPayments).where(eq(rentPayments.propertyId, propertyId)).orderBy(desc(rentPayments.createdAt));
  }

  async getCurrentPayment(propertyId: number, tenantId: number): Promise<RentPayment | undefined> {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [payment] = await db
      .select()
      .from(rentPayments)
      .where(
        and(
          eq(rentPayments.propertyId, propertyId),
          eq(rentPayments.tenantId, tenantId),
          eq(rentPayments.month, month),
          eq(rentPayments.year, year)
        )
      );

    return payment || undefined;
  }

  async getPaymentById(paymentId: number): Promise<RentPayment | undefined> {
    const [payment] = await db.select().from(rentPayments).where(eq(rentPayments.id, paymentId));
    return payment || undefined;
  }

  async createRentPayment(payment: InsertRentPayment): Promise<RentPayment> {
    const [rp] = await db.insert(rentPayments).values(payment).returning();
    return rp;
  }

  async updatePaymentProof(paymentId: number, proofUrl: string | null, transactionId?: string): Promise<RentPayment> {
    const updateData: Partial<RentPayment> = { proofStatus: "submitted" };
    if (proofUrl) {
      updateData.proofImageUrl = proofUrl;
    }
    if (transactionId) {
      updateData.transactionId = transactionId;
    }
    const [rp] = await db.update(rentPayments).set(updateData).where(eq(rentPayments.id, paymentId)).returning();
    return rp;
  }

  async verifyPayment(paymentId: number, approved: boolean, rejectionReason?: string): Promise<RentPayment> {
    if (approved) {
      const [rp] = await db
        .update(rentPayments)
        .set({ proofStatus: "verified", status: "paid", paidAt: new Date() })
        .where(eq(rentPayments.id, paymentId))
        .returning();
      return rp;
    } else {
      const [rp] = await db
        .update(rentPayments)
        .set({ proofStatus: "rejected", rejectionReason })
        .where(eq(rentPayments.id, paymentId))
        .returning();
      return rp;
    }
  }

  async markPaymentPaid(paymentId: number): Promise<RentPayment> {
    const [rp] = await db
      .update(rentPayments)
      .set({ status: "paid", proofStatus: "verified", paidAt: new Date() })
      .where(eq(rentPayments.id, paymentId))
      .returning();
    return rp;
  }

  async updatePaymentFine(paymentId: number, fineAmount: number): Promise<RentPayment> {
    const [rp] = await db
      .update(rentPayments)
      .set({ fineAmount, status: fineAmount > 0 ? "late" : "due" })
      .where(eq(rentPayments.id, paymentId))
      .returning();
    return rp;
  }

  async adminUpdateFine(paymentId: number, fineAmount: number): Promise<RentPayment> {
    const [rp] = await db
      .update(rentPayments)
      .set({ fineAmount, status: fineAmount > 0 ? "late" : "due" })
      .where(eq(rentPayments.id, paymentId))
      .returning();
    return rp;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [n] = await db.insert(notifications).values(notification).returning();
    return n;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async getPgPropertiesByOwner(ownerId: number): Promise<PgPropertyWithBeds[]> {
    const props = await db.select().from(pgProperties).where(eq(pgProperties.ownerId, ownerId));
    const result: PgPropertyWithBeds[] = [];
    
    for (const prop of props) {
      const propBeds = await db.select().from(beds).where(eq(beds.pgPropertyId, prop.id));
      const bedsWithTenants: BedWithTenant[] = [];
      
      for (const bed of propBeds) {
        let tenant: User | null = null;
        if (bed.tenantId) {
          const [t] = await db.select().from(users).where(eq(users.id, bed.tenantId));
          tenant = t || null;
        }
        bedsWithTenants.push({ ...bed, tenant });
      }
      result.push({ ...prop, beds: bedsWithTenants });
    }
    return result;
  }

  async getPgPropertyById(id: number): Promise<PgPropertyWithBeds | undefined> {
    const [prop] = await db.select().from(pgProperties).where(eq(pgProperties.id, id));
    if (!prop) return undefined;

    const propBeds = await db.select().from(beds).where(eq(beds.pgPropertyId, id));
    const bedsWithTenants: BedWithTenant[] = [];
    
    for (const bed of propBeds) {
      let tenant: User | null = null;
      if (bed.tenantId) {
        const [t] = await db.select().from(users).where(eq(users.id, bed.tenantId));
        tenant = t || null;
      }
      bedsWithTenants.push({ ...bed, tenant });
    }
    
    return { ...prop, beds: bedsWithTenants };
  }

  async getPgPropertyByCode(code: string): Promise<PgProperty | undefined> {
    const [prop] = await db.select().from(pgProperties).where(eq(pgProperties.propertyCode, code.toUpperCase()));
    return prop || undefined;
  }

  async createPgProperty(property: InsertPgProperty & { ownerId: number }): Promise<PgProperty> {
    let propertyCode = generatePropertyCode();
    let existing = await this.getPgPropertyByCode(propertyCode);
    while (existing) {
      propertyCode = generatePropertyCode();
      existing = await this.getPgPropertyByCode(propertyCode);
    }

    const [prop] = await db
      .insert(pgProperties)
      .values({ ...property, propertyCode })
      .returning();
    return prop;
  }

  async getAllPgProperties(): Promise<(PgProperty & { owner?: User; beds: BedWithTenant[] })[]> {
    const props = await db.select().from(pgProperties);
    const result = [];
    
    for (const prop of props) {
      const [owner] = await db.select().from(users).where(eq(users.id, prop.ownerId));
      const propBeds = await db.select().from(beds).where(eq(beds.pgPropertyId, prop.id));
      const bedsWithTenants: BedWithTenant[] = [];
      
      for (const bed of propBeds) {
        let tenant: User | null = null;
        if (bed.tenantId) {
          const [t] = await db.select().from(users).where(eq(users.id, bed.tenantId));
          tenant = t || null;
        }
        bedsWithTenants.push({ ...bed, tenant });
      }
      result.push({ ...prop, owner, beds: bedsWithTenants });
    }
    return result;
  }

  async getBedById(id: number): Promise<BedWithPayments | undefined> {
    const [bed] = await db.select().from(beds).where(eq(beds.id, id));
    if (!bed) return undefined;

    let tenant: User | null = null;
    if (bed.tenantId) {
      const [t] = await db.select().from(users).where(eq(users.id, bed.tenantId));
      tenant = t || null;
    }

    const payments = await db.select().from(bedPayments).where(eq(bedPayments.bedId, id)).orderBy(desc(bedPayments.createdAt));
    return { ...bed, tenant, payments };
  }

  async getBedByCode(code: string): Promise<Bed | undefined> {
    const [bed] = await db.select().from(beds).where(eq(beds.bedCode, code.toUpperCase()));
    return bed || undefined;
  }

  async createBed(bed: InsertBed & { pgPropertyId: number }): Promise<Bed> {
    let bedCode = generatePropertyCode();
    let existing = await this.getBedByCode(bedCode);
    while (existing) {
      bedCode = generatePropertyCode();
      existing = await this.getBedByCode(bedCode);
    }

    const [newBed] = await db
      .insert(beds)
      .values({
        ...bed,
        bedCode,
        depositBalance: bed.securityDeposit,
      })
      .returning();
    return newBed;
  }

  async assignTenantToBed(bedId: number, tenantId: number, onboardingDay: number, onboardingMonth: number, onboardingYear: number): Promise<Bed> {
    const [bed] = await db.select().from(beds).where(eq(beds.id, bedId));
    const [updatedBed] = await db
      .update(beds)
      .set({
        tenantId,
        tenantJoinedAt: new Date(),
        onboardingStartDay: onboardingDay,
        onboardingStartMonth: onboardingMonth,
        onboardingStartYear: onboardingYear,
        depositBalance: bed.securityDeposit,
      })
      .where(eq(beds.id, bedId))
      .returning();
    return updatedBed;
  }

  async removeTenantFromBed(bedId: number): Promise<Bed> {
    const [bed] = await db
      .update(beds)
      .set({
        tenantId: null,
        tenantJoinedAt: null,
        onboardingStartDay: null,
        onboardingStartMonth: null,
        onboardingStartYear: null,
      })
      .where(eq(beds.id, bedId))
      .returning();
    return bed;
  }

  async getBedByTenant(tenantId: number): Promise<BedWithPayments | undefined> {
    const [bed] = await db.select().from(beds).where(eq(beds.tenantId, tenantId));
    if (!bed) return undefined;

    const [pgProp] = await db.select().from(pgProperties).where(eq(pgProperties.id, bed.pgPropertyId));
    const payments = await db.select().from(bedPayments).where(eq(bedPayments.bedId, bed.id)).orderBy(desc(bedPayments.createdAt));

    return { ...bed, pgProperty: pgProp, payments } as BedWithPayments & { pgProperty?: PgProperty };
  }

  async updateBedDeposit(bedId: number, newBalance: number): Promise<void> {
    await db.update(beds).set({ depositBalance: newBalance }).where(eq(beds.id, bedId));
  }

  async getBedPaymentsByBed(bedId: number): Promise<BedPayment[]> {
    return db.select().from(bedPayments).where(eq(bedPayments.bedId, bedId)).orderBy(desc(bedPayments.createdAt));
  }

  async getCurrentBedPayment(bedId: number, tenantId: number): Promise<BedPayment | undefined> {
    const now = new Date();
    const [payment] = await db
      .select()
      .from(bedPayments)
      .where(
        and(
          eq(bedPayments.bedId, bedId),
          eq(bedPayments.tenantId, tenantId),
          eq(bedPayments.status, "due")
        )
      )
      .orderBy(desc(bedPayments.createdAt))
      .limit(1);

    if (!payment) {
      const [latePayment] = await db
        .select()
        .from(bedPayments)
        .where(
          and(
            eq(bedPayments.bedId, bedId),
            eq(bedPayments.tenantId, tenantId),
            eq(bedPayments.status, "late")
          )
        )
        .orderBy(desc(bedPayments.createdAt))
        .limit(1);
      return latePayment || undefined;
    }
    return payment;
  }

  async getBedPaymentById(paymentId: number): Promise<BedPayment | undefined> {
    const [payment] = await db.select().from(bedPayments).where(eq(bedPayments.id, paymentId));
    return payment || undefined;
  }

  async createBedPayment(payment: InsertBedPayment): Promise<BedPayment> {
    const [bp] = await db.insert(bedPayments).values(payment).returning();
    return bp;
  }

  async updateBedPaymentProof(paymentId: number, proofUrl: string | null, transactionId?: string): Promise<BedPayment> {
    const updateData: Partial<BedPayment> = { proofStatus: "submitted" };
    if (proofUrl) updateData.proofImageUrl = proofUrl;
    if (transactionId) updateData.transactionId = transactionId;
    const [bp] = await db.update(bedPayments).set(updateData).where(eq(bedPayments.id, paymentId)).returning();
    return bp;
  }

  async verifyBedPayment(paymentId: number, approved: boolean, rejectionReason?: string): Promise<BedPayment> {
    if (approved) {
      const [bp] = await db
        .update(bedPayments)
        .set({ proofStatus: "verified", status: "paid", paidAt: new Date() })
        .where(eq(bedPayments.id, paymentId))
        .returning();
      return bp;
    } else {
      const [bp] = await db
        .update(bedPayments)
        .set({ proofStatus: "rejected", rejectionReason })
        .where(eq(bedPayments.id, paymentId))
        .returning();
      return bp;
    }
  }

  async markBedPaymentPaid(paymentId: number): Promise<BedPayment> {
    const [bp] = await db
      .update(bedPayments)
      .set({ status: "paid", proofStatus: "verified", paidAt: new Date() })
      .where(eq(bedPayments.id, paymentId))
      .returning();
    return bp;
  }

  async updateBedPaymentFine(paymentId: number, fineAmount: number): Promise<BedPayment> {
    const [bp] = await db
      .update(bedPayments)
      .set({ fineAmount, status: fineAmount > 0 ? "late" : "due" })
      .where(eq(bedPayments.id, paymentId))
      .returning();
    return bp;
  }
}

export const storage = new DatabaseStorage();
