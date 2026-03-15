import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { passport } from "./auth";
import { storage } from "./storage";
import { signupSchema, loginSchema, insertPropertySchema, users } from "@shared/schema";
import { db } from "./db";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import MemoryStore from "memorystore";

const MemoryStoreSession = MemoryStore(session);

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage: multerStorage });

function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

function isOwner(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "owner") {
    return next();
  }
  res.status(403).json({ message: "Forbidden" });
}

function isTenant(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "tenant") {
    return next();
  }
  res.status(403).json({ message: "Forbidden" });
}

function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Forbidden" });
}

function isPgOwner(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role === "pg_owner") {
    return next();
  }
  res.status(403).json({ message: "Forbidden" });
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getAdjustedDueDay(dueDay: number, year: number, month: number): number {
  const lastDay = getLastDayOfMonth(year, month);
  return Math.min(dueDay, lastDay);
}

function calculateFine(
  onboardingStartDay: number,
  onboardingStartMonth: number,
  onboardingStartYear: number
): { daysLate: number; dailyFine: number; totalFine: number; dueDate: Date | null } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const onboardingDate = new Date(onboardingStartYear, onboardingStartMonth - 1, onboardingStartDay);
  onboardingDate.setHours(0, 0, 0, 0);
  
  if (now < onboardingDate) {
    return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate: null };
  }

  let monthsSinceOnboarding = (now.getFullYear() - onboardingStartYear) * 12 + (now.getMonth() - (onboardingStartMonth - 1));
  
  let dueDateMonth = onboardingStartMonth + monthsSinceOnboarding;
  let dueDateYear = onboardingStartYear + Math.floor((dueDateMonth - 1) / 12);
  let normalizedMonth = ((dueDateMonth - 1) % 12) + 1;
  
  let adjustedDueDay = getAdjustedDueDay(onboardingStartDay, dueDateYear, normalizedMonth);
  let dueDate = new Date(dueDateYear, normalizedMonth - 1, adjustedDueDay);
  dueDate.setHours(0, 0, 0, 0);
  
  if (now.getTime() < dueDate.getTime()) {
    monthsSinceOnboarding -= 1;
    if (monthsSinceOnboarding < 0) {
      return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate: null };
    }
    dueDateMonth = onboardingStartMonth + monthsSinceOnboarding;
    dueDateYear = onboardingStartYear + Math.floor((dueDateMonth - 1) / 12);
    normalizedMonth = ((dueDateMonth - 1) % 12) + 1;
    adjustedDueDay = getAdjustedDueDay(onboardingStartDay, dueDateYear, normalizedMonth);
    dueDate = new Date(dueDateYear, normalizedMonth - 1, adjustedDueDay);
    dueDate.setHours(0, 0, 0, 0);
  }
  
  if (now.getTime() <= dueDate.getTime()) {
    return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate };
  }

  const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLate <= 0) {
    return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate };
  }

  const baseFine = 100;
  const period = Math.floor((daysLate - 1) / 2);
  const dailyFine = baseFine * Math.pow(2, period);
  
  let totalFine = 0;
  for (let i = 1; i <= daysLate; i++) {
    const p = Math.floor((i - 1) / 2);
    totalFine += baseFine * Math.pow(2, p);
  }

  return { daysLate, dailyFine, totalFine, dueDate };
}

function getCycleMonths(cycle: string): number {
  switch (cycle) {
    case "quarterly": return 3;
    case "half_yearly": return 6;
    case "yearly": return 12;
    default: return 1;
  }
}

function calculateBedFine(
  onboardingStartDay: number,
  onboardingStartMonth: number,
  onboardingStartYear: number,
  rentCycle: string
): { daysLate: number; dailyFine: number; totalFine: number; dueDate: Date | null; cycleEndDate: Date | null } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const onboardingDate = new Date(onboardingStartYear, onboardingStartMonth - 1, onboardingStartDay);
  onboardingDate.setHours(0, 0, 0, 0);
  
  if (now < onboardingDate) {
    return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate: null, cycleEndDate: null };
  }

  const cycleMonths = getCycleMonths(rentCycle);
  let monthsSinceOnboarding = (now.getFullYear() - onboardingStartYear) * 12 + (now.getMonth() - (onboardingStartMonth - 1));
  let cyclesSinceOnboarding = Math.floor(monthsSinceOnboarding / cycleMonths);
  
  let dueDateMonth = onboardingStartMonth + (cyclesSinceOnboarding * cycleMonths);
  let dueDateYear = onboardingStartYear + Math.floor((dueDateMonth - 1) / 12);
  let normalizedMonth = ((dueDateMonth - 1) % 12) + 1;
  
  let adjustedDueDay = getAdjustedDueDay(onboardingStartDay, dueDateYear, normalizedMonth);
  let dueDate = new Date(dueDateYear, normalizedMonth - 1, adjustedDueDay);
  dueDate.setHours(0, 0, 0, 0);
  
  if (now.getTime() < dueDate.getTime()) {
    cyclesSinceOnboarding -= 1;
    if (cyclesSinceOnboarding < 0) {
      return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate: null, cycleEndDate: null };
    }
    dueDateMonth = onboardingStartMonth + (cyclesSinceOnboarding * cycleMonths);
    dueDateYear = onboardingStartYear + Math.floor((dueDateMonth - 1) / 12);
    normalizedMonth = ((dueDateMonth - 1) % 12) + 1;
    adjustedDueDay = getAdjustedDueDay(onboardingStartDay, dueDateYear, normalizedMonth);
    dueDate = new Date(dueDateYear, normalizedMonth - 1, adjustedDueDay);
    dueDate.setHours(0, 0, 0, 0);
  }
  
  const cycleEndMonth = normalizedMonth + cycleMonths;
  const cycleEndYear = dueDateYear + Math.floor((cycleEndMonth - 1) / 12);
  const normalizedEndMonth = ((cycleEndMonth - 1) % 12) + 1;
  const adjustedEndDay = getAdjustedDueDay(onboardingStartDay, cycleEndYear, normalizedEndMonth);
  const cycleEndDate = new Date(cycleEndYear, normalizedEndMonth - 1, adjustedEndDay);
  cycleEndDate.setHours(0, 0, 0, 0);
  
  if (now.getTime() <= dueDate.getTime()) {
    return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate, cycleEndDate };
  }

  const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLate <= 0) {
    return { daysLate: 0, dailyFine: 0, totalFine: 0, dueDate, cycleEndDate };
  }

  const baseFine = 100;
  const period = Math.floor((daysLate - 1) / 2);
  const dailyFine = baseFine * Math.pow(2, period);
  
  let totalFine = 0;
  for (let i = 1; i <= daysLate; i++) {
    const p = Math.floor((i - 1) / 2);
    totalFine += baseFine * Math.pow(2, p);
  }

  return { daysLate, dailyFine, totalFine, dueDate, cycleEndDate };
}

async function ensureCurrentPaymentExists(propertyId: number, tenantId: number, rentAmount: number) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let payment = await storage.getCurrentPayment(propertyId, tenantId);
  
  if (!payment) {
    payment = await storage.createRentPayment({
      propertyId,
      tenantId,
      month,
      year,
      rentAmount,
      fineAmount: 0,
      status: "due",
      proofStatus: "none",
    });
  }

  return payment;
}

async function seedAdminUser() {
  try {
    const adminPhone = "8000000001";
    const existing = await storage.getUserByPhone(adminPhone);
    if (!existing) {
      const hashedPassword = await bcrypt.hash("Admin@2025Secure!", 10);
      const [admin] = await db
        .insert(users)
        .values({
          phone: adminPhone,
          password: hashedPassword,
          name: "Admin",
          role: "admin",
        })
        .returning();
      console.log("Admin user seeded with id:", admin.id);
    } else {
      console.log("Admin user already exists with id:", existing.id);
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.set('trust proxy', 1);
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "rentedge-secret-key-change-in-prod",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStoreSession({
        checkPeriod: 86400000,
      }),
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.use("/uploads", (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  });
  app.use("/uploads", express.static(uploadsDir));

  await seedAdminUser();

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const result = signupSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.errors[0].message });
      }

      const { phone, password, name, role } = result.data;

      const existing = await storage.getUserByPhone(phone);
      if (existing) {
        return res.status(400).json({ message: "Phone number already registered" });
      }

      const user = await storage.createUser({ phone, password, name, role });

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed after signup" });
        }
        const { password: _, ...safeUser } = user;
        res.json({ user: safeUser });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: result.error.errors[0].message });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }

      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Login failed" });
        }
        const { password: _, ...safeUser } = user;
        res.json({ user: safeUser });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { password: _, ...safeUser } = req.user as any;
    res.json(safeUser);
  });

  app.get("/api/properties", isAuthenticated, isOwner, async (req, res) => {
    try {
      const properties = await storage.getPropertiesByOwner(req.user!.id);
      res.json(properties);
    } catch (error) {
      console.error("Get properties error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/properties/:id", isAuthenticated, isOwner, async (req, res) => {
    try {
      const property = await storage.getPropertyById(parseInt(String(req.params.id)));
      if (!property || property.ownerId !== req.user!.id) {
        return res.status(404).json({ message: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Get property error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/properties", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { name, address, monthlyRent, securityDeposit, ownerName, ownerUpiId,
              electricianName, electricianPhone, plumberName, plumberPhone, mechanicName, mechanicPhone, city,
              onboardingStartDay, onboardingStartMonth, onboardingStartYear } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Property name is required" });
      }
      if (!address || typeof address !== "string" || address.trim().length === 0) {
        return res.status(400).json({ message: "Property address is required" });
      }
      if (!monthlyRent || typeof monthlyRent !== "number" || monthlyRent <= 0) {
        return res.status(400).json({ message: "Valid monthly rent is required" });
      }
      if (!onboardingStartDay || typeof onboardingStartDay !== "number" || onboardingStartDay < 1 || onboardingStartDay > 31) {
        return res.status(400).json({ message: "Valid onboarding start day (1-31) is required" });
      }
      if (!onboardingStartMonth || typeof onboardingStartMonth !== "number" || onboardingStartMonth < 1 || onboardingStartMonth > 12) {
        return res.status(400).json({ message: "Valid onboarding start month is required" });
      }
      if (!onboardingStartYear || typeof onboardingStartYear !== "number" || onboardingStartYear < 2020 || onboardingStartYear > 2100) {
        return res.status(400).json({ message: "Valid onboarding start year is required" });
      }
      if (securityDeposit !== undefined && (typeof securityDeposit !== "number" || securityDeposit < 0)) {
        return res.status(400).json({ message: "Security deposit must be a non-negative number" });
      }
      if (!ownerName || typeof ownerName !== "string" || ownerName.trim().length === 0) {
        return res.status(400).json({ message: "Owner name is required" });
      }

      const property = await storage.createProperty({
        name: name.trim(),
        address: address.trim(),
        city: city?.trim() || null,
        monthlyRent,
        onboardingStartDay,
        onboardingStartMonth,
        onboardingStartYear,
        ownerName: ownerName.trim(),
        ownerUpiId: ownerUpiId?.trim() || null,
        securityDeposit: securityDeposit || 0,
        electricianName: electricianName?.trim() || null,
        electricianPhone: electricianPhone?.trim() || null,
        plumberName: plumberName?.trim() || null,
        plumberPhone: plumberPhone?.trim() || null,
        mechanicName: mechanicName?.trim() || null,
        mechanicPhone: mechanicPhone?.trim() || null,
        ownerId: req.user!.id,
      });
      res.json(property);
    } catch (error) {
      console.error("Create property error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/properties/:id/tenant", isAuthenticated, isOwner, async (req, res) => {
    try {
      const property = await storage.getPropertyById(parseInt(String(req.params.id)));
      if (!property || property.ownerId !== req.user!.id) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (property.tenantId) {
        await storage.createNotification({
          userId: property.tenantId,
          type: "tenant_removed",
          title: "Removed from Property",
          message: `You have been removed from ${property.name}`,
          propertyId: property.id,
        });
      }

      const updated = await storage.removeTenant(property.id);
      res.json(updated);
    } catch (error) {
      console.error("Remove tenant error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/tenant/dashboard", isAuthenticated, isTenant, async (req, res) => {
    try {
      const property = await storage.getPropertyByTenant(req.user!.id);
      if (!property) {
        return res.status(404).json({ message: "No property assigned" });
      }

      let currentPayment = await ensureCurrentPaymentExists(property.id, req.user!.id, property.monthlyRent);
      
      let fineBreakdown = null;
      if (currentPayment.status !== "paid") {
        fineBreakdown = calculateFine(
          property.onboardingStartDay,
          property.onboardingStartMonth,
          property.onboardingStartYear
        );
        if (fineBreakdown.totalFine > 0 && currentPayment.fineAmount !== fineBreakdown.totalFine) {
          currentPayment = await storage.updatePaymentFine(currentPayment.id, fineBreakdown.totalFine);
        }
      }

      res.json({ property, currentPayment, fineBreakdown });
    } catch (error) {
      console.error("Tenant dashboard error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/tenant/join", isAuthenticated, isTenant, async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || code.length !== 6) {
        return res.status(400).json({ message: "Invalid property code" });
      }

      const existingProperty = await storage.getPropertyByTenant(req.user!.id);
      if (existingProperty) {
        return res.status(400).json({ message: "You are already assigned to a property" });
      }

      const property = await storage.getPropertyByCode(code.toUpperCase());
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }

      if (property.tenantId) {
        return res.status(400).json({ message: "Property already has a tenant" });
      }

      const updated = await storage.assignTenant(property.id, req.user!.id);

      await storage.createNotification({
        userId: property.ownerId,
        type: "tenant_joined",
        title: "New Tenant Joined",
        message: `${req.user!.name} has joined ${property.name}`,
        propertyId: property.id,
      });

      res.json(updated);
    } catch (error) {
      console.error("Join property error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/tenant/submit-proof", isAuthenticated, isTenant, upload.single("proof"), async (req, res) => {
    try {
      const paymentId = parseInt(req.body.paymentId);
      const transactionId = req.body.transactionId;

      if (isNaN(paymentId)) {
        return res.status(400).json({ message: "Valid payment ID is required" });
      }

      if (!req.file && !transactionId) {
        return res.status(400).json({ message: "Please provide either a screenshot or transaction ID" });
      }

      const property = await storage.getPropertyByTenant(req.user!.id);
      if (!property) {
        return res.status(403).json({ message: "You are not assigned to any property" });
      }

      const currentPayment = await storage.getCurrentPayment(property.id, req.user!.id);
      if (!currentPayment || currentPayment.id !== paymentId) {
        return res.status(403).json({ message: "Invalid payment" });
      }

      const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const payment = await storage.updatePaymentProof(paymentId, proofUrl, transactionId);

      await storage.createNotification({
        userId: property.ownerId,
        type: "proof_submitted",
        title: "Payment Proof Submitted",
        message: `${req.user!.name} has submitted payment proof for ${property.name}`,
        propertyId: property.id,
      });

      res.json(payment);
    } catch (error) {
      console.error("Submit proof error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/owner/verify-proof", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { paymentId, action, rejectionReason } = req.body;

      if (!paymentId || !action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid request" });
      }

      if (action === "reject" && !rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const paymentToVerify = await storage.getPaymentById(paymentId);
      if (!paymentToVerify) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const property = await storage.getPropertyById(paymentToVerify.propertyId);
      if (!property || property.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to verify this payment" });
      }

      const approved = action === "approve";
      const payment = await storage.verifyPayment(paymentId, approved, rejectionReason);

      if (payment.tenantId) {
        if (approved && payment.fineAmount > 0) {
          const newBalance = Math.max(0, property.depositBalance - payment.fineAmount);
          await storage.updatePropertyDeposit(property.id, newBalance);
        }

        await storage.createNotification({
          userId: payment.tenantId,
          type: approved ? "proof_verified" : "proof_rejected",
          title: approved ? "Payment Verified" : "Payment Rejected",
          message: approved
            ? `Your payment for ${property.name} has been verified`
            : `Your payment proof for ${property.name} was rejected: ${rejectionReason}`,
          propertyId: property.id,
        });
      }

      res.json(payment);
    } catch (error) {
      console.error("Verify proof error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/owner/cash-payment", isAuthenticated, isOwner, async (req, res) => {
    try {
      const { paymentId } = req.body;

      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }

      const paymentToMark = await storage.getPaymentById(paymentId);
      if (!paymentToMark) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const property = await storage.getPropertyById(paymentToMark.propertyId);
      if (!property || property.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to mark this payment" });
      }

      const payment = await storage.markPaymentPaid(paymentId);

      if (payment.tenantId) {
        if (payment.fineAmount > 0) {
          const newBalance = Math.max(0, property.depositBalance - payment.fineAmount);
          await storage.updatePropertyDeposit(property.id, newBalance);
        }

        await storage.createNotification({
          userId: payment.tenantId,
          type: "payment_received",
          title: "Cash Payment Recorded",
          message: `Your cash payment for ${property.name} has been recorded`,
          propertyId: property.id,
        });
      }

      res.json(payment);
    } catch (error) {
      console.error("Cash payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      await storage.markNotificationRead(parseInt(String(req.params.id)));
      res.json({ success: true });
    } catch (error) {
      console.error("Mark read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      await storage.markAllNotificationsRead(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all read error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = parseInt(String(req.params.id));
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.role === "admin") {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }
      
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/owners/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const ownerId = parseInt(String(req.params.id));
      const data = await storage.getOwnerWithFullData(ownerId);
      
      if (!data) {
        return res.status(404).json({ message: "Owner not found" });
      }
      
      const { password, ...ownerSafe } = data.owner;
      res.json({ owner: ownerSafe, properties: data.properties });
    } catch (error) {
      console.error("Get owner data error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/edit-fine", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { paymentId, fineAmount } = req.body;
      
      if (paymentId === undefined || fineAmount === undefined) {
        return res.status(400).json({ message: "Payment ID and fine amount required" });
      }
      if (typeof fineAmount !== "number" || fineAmount < 0) {
        return res.status(400).json({ message: "Fine must be a non-negative number" });
      }
      
      const payment = await storage.adminUpdateFine(paymentId, fineAmount);
      res.json(payment);
    } catch (error) {
      console.error("Edit fine error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/send-notification", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { userId, title, message, type } = req.body;
      
      if (!userId || !title || !message) {
        return res.status(400).json({ message: "User ID, title and message required" });
      }
      
      const notification = await storage.createNotification({
        userId,
        type: type || "rent_due",
        title,
        message,
      });
      
      res.json(notification);
    } catch (error) {
      console.error("Send notification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const properties = await storage.getAllProperties();

      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      let paidPayments = 0;
      let duePayments = 0;
      let latePayments = 0;

      for (const prop of properties) {
        for (const payment of prop.rentPayments) {
          if (payment.month === month && payment.year === year) {
            if (payment.status === "paid") paidPayments++;
            else if (payment.status === "late") latePayments++;
            else duePayments++;
          }
        }
      }

      res.json({
        totalUsers: users.length,
        totalProperties: properties.length,
        totalOwners: users.filter((u) => u.role === "owner").length,
        totalTenants: users.filter((u) => u.role === "tenant").length,
        totalPgOwners: users.filter((u) => u.role === "pg_owner").length,
        occupiedProperties: properties.filter((p) => p.tenantId).length,
        vacantProperties: properties.filter((p) => !p.tenantId).length,
        paidPayments,
        duePayments,
        latePayments,
        users: users.map(({ password, ...u }) => u),
        properties,
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/pg/properties", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const properties = await storage.getPgPropertiesByOwner(req.user!.id);
      res.json(properties);
    } catch (error) {
      console.error("Get PG properties error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/pg/properties/:id", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const property = await storage.getPgPropertyById(parseInt(String(req.params.id)));
      if (!property || property.ownerId !== req.user!.id) {
        return res.status(404).json({ message: "PG Property not found" });
      }
      res.json(property);
    } catch (error) {
      console.error("Get PG property error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/pg/properties", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const { name, address, city, ownerName, ownerUpiId,
              electricianName, electricianPhone, plumberName, plumberPhone, mechanicName, mechanicPhone } = req.body;

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "PG name is required" });
      }
      if (!address || typeof address !== "string" || address.trim().length === 0) {
        return res.status(400).json({ message: "PG address is required" });
      }
      if (!ownerName || typeof ownerName !== "string" || ownerName.trim().length === 0) {
        return res.status(400).json({ message: "Owner name is required" });
      }

      const property = await storage.createPgProperty({
        name: name.trim(),
        address: address.trim(),
        city: city?.trim() || null,
        ownerName: ownerName.trim(),
        ownerUpiId: ownerUpiId?.trim() || null,
        electricianName: electricianName?.trim() || null,
        electricianPhone: electricianPhone?.trim() || null,
        plumberName: plumberName?.trim() || null,
        plumberPhone: plumberPhone?.trim() || null,
        mechanicName: mechanicName?.trim() || null,
        mechanicPhone: mechanicPhone?.trim() || null,
        ownerId: req.user!.id,
      });
      res.json(property);
    } catch (error) {
      console.error("Create PG property error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/pg/beds", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const { pgPropertyId, bedNumber, roomNumber, rentAmount, rentCycle, securityDeposit } = req.body;

      if (!pgPropertyId || typeof pgPropertyId !== "number") {
        return res.status(400).json({ message: "Valid PG property ID is required" });
      }
      if (!bedNumber || typeof bedNumber !== "string" || bedNumber.trim().length === 0) {
        return res.status(400).json({ message: "Bed number is required" });
      }
      if (!rentAmount || typeof rentAmount !== "number" || rentAmount <= 0) {
        return res.status(400).json({ message: "Valid rent amount is required" });
      }
      if (!rentCycle || !["monthly", "quarterly", "half_yearly", "yearly"].includes(rentCycle)) {
        return res.status(400).json({ message: "Valid rent cycle is required" });
      }
      if (securityDeposit !== undefined && (typeof securityDeposit !== "number" || securityDeposit < 0)) {
        return res.status(400).json({ message: "Security deposit must be a non-negative number" });
      }

      const pgProperty = await storage.getPgPropertyById(pgPropertyId);
      if (!pgProperty || pgProperty.ownerId !== req.user!.id) {
        return res.status(404).json({ message: "PG Property not found" });
      }

      const bed = await storage.createBed({
        pgPropertyId,
        bedNumber: bedNumber.trim(),
        roomNumber: roomNumber?.trim() || null,
        rentAmount,
        rentCycle,
        securityDeposit: securityDeposit || 0,
      });
      res.json(bed);
    } catch (error) {
      console.error("Create bed error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/pg/beds/:id", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const bed = await storage.getBedById(parseInt(String(req.params.id)));
      if (!bed) {
        return res.status(404).json({ message: "Bed not found" });
      }

      const pgProperty = await storage.getPgPropertyById(bed.pgPropertyId);
      if (!pgProperty || pgProperty.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      let fineBreakdown = null;
      if (bed.tenantId && bed.onboardingStartDay && bed.onboardingStartMonth && bed.onboardingStartYear) {
        fineBreakdown = calculateBedFine(
          bed.onboardingStartDay,
          bed.onboardingStartMonth,
          bed.onboardingStartYear,
          bed.rentCycle
        );
      }

      res.json({ bed, pgProperty, fineBreakdown });
    } catch (error) {
      console.error("Get bed error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/pg/beds/:id/assign-tenant", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const bedId = parseInt(String(req.params.id));
      const { tenantPhone, onboardingStartDay, onboardingStartMonth, onboardingStartYear } = req.body;

      if (!tenantPhone || tenantPhone.length !== 10) {
        return res.status(400).json({ message: "Valid tenant phone (10 digits) is required" });
      }
      if (!onboardingStartDay || typeof onboardingStartDay !== "number" || onboardingStartDay < 1 || onboardingStartDay > 31) {
        return res.status(400).json({ message: "Valid onboarding start day (1-31) is required" });
      }
      if (!onboardingStartMonth || typeof onboardingStartMonth !== "number" || onboardingStartMonth < 1 || onboardingStartMonth > 12) {
        return res.status(400).json({ message: "Valid onboarding start month is required" });
      }
      if (!onboardingStartYear || typeof onboardingStartYear !== "number" || onboardingStartYear < 2020 || onboardingStartYear > 2100) {
        return res.status(400).json({ message: "Valid onboarding start year is required" });
      }

      const bed = await storage.getBedById(bedId);
      if (!bed) {
        return res.status(404).json({ message: "Bed not found" });
      }

      const pgProperty = await storage.getPgPropertyById(bed.pgPropertyId);
      if (!pgProperty || pgProperty.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (bed.tenantId) {
        return res.status(400).json({ message: "Bed already has a tenant" });
      }

      const tenant = await storage.getUserByPhone(tenantPhone);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found. They must sign up first." });
      }
      if (tenant.role !== "tenant") {
        return res.status(400).json({ message: "User is not a tenant" });
      }

      const existingBed = await storage.getBedByTenant(tenant.id);
      if (existingBed) {
        return res.status(400).json({ message: "Tenant is already assigned to another bed" });
      }

      const existingProperty = await storage.getPropertyByTenant(tenant.id);
      if (existingProperty) {
        return res.status(400).json({ message: "Tenant is already assigned to a regular property" });
      }

      const updated = await storage.assignTenantToBed(bedId, tenant.id, onboardingStartDay, onboardingStartMonth, onboardingStartYear);

      await storage.createNotification({
        userId: tenant.id,
        type: "tenant_joined",
        title: "Assigned to Bed",
        message: `You have been assigned to bed ${bed.bedNumber} in ${pgProperty.name}`,
        propertyId: null,
      });

      res.json(updated);
    } catch (error) {
      console.error("Assign tenant to bed error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/pg/beds/:id/tenant", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const bedId = parseInt(String(req.params.id));
      const bed = await storage.getBedById(bedId);
      if (!bed) {
        return res.status(404).json({ message: "Bed not found" });
      }

      const pgProperty = await storage.getPgPropertyById(bed.pgPropertyId);
      if (!pgProperty || pgProperty.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (bed.tenantId) {
        await storage.createNotification({
          userId: bed.tenantId,
          type: "tenant_removed",
          title: "Removed from Bed",
          message: `You have been removed from bed ${bed.bedNumber} in ${pgProperty.name}`,
          propertyId: null,
        });
      }

      const updated = await storage.removeTenantFromBed(bedId);
      res.json(updated);
    } catch (error) {
      console.error("Remove tenant from bed error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/pg/verify-proof", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const { paymentId, action, rejectionReason } = req.body;

      if (!paymentId || !action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Invalid request" });
      }

      if (action === "reject" && !rejectionReason) {
        return res.status(400).json({ message: "Rejection reason is required" });
      }

      const payment = await storage.getBedPaymentById(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const bed = await storage.getBedById(payment.bedId);
      if (!bed) {
        return res.status(404).json({ message: "Bed not found" });
      }

      const pgProperty = await storage.getPgPropertyById(bed.pgPropertyId);
      if (!pgProperty || pgProperty.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized to verify this payment" });
      }

      const approved = action === "approve";
      const updatedPayment = await storage.verifyBedPayment(paymentId, approved, rejectionReason);

      if (payment.tenantId) {
        if (approved && payment.fineAmount > 0) {
          const newBalance = Math.max(0, bed.depositBalance - payment.fineAmount);
          await storage.updateBedDeposit(bed.id, newBalance);
        }

        await storage.createNotification({
          userId: payment.tenantId,
          type: approved ? "proof_verified" : "proof_rejected",
          title: approved ? "Payment Verified" : "Payment Rejected",
          message: approved
            ? `Your payment for bed ${bed.bedNumber} has been verified`
            : `Your payment proof was rejected: ${rejectionReason}`,
          propertyId: null,
        });
      }

      res.json(updatedPayment);
    } catch (error) {
      console.error("Verify bed payment proof error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/pg/cash-payment", isAuthenticated, isPgOwner, async (req, res) => {
    try {
      const { paymentId } = req.body;

      if (!paymentId) {
        return res.status(400).json({ message: "Payment ID is required" });
      }

      const payment = await storage.getBedPaymentById(paymentId);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      const bed = await storage.getBedById(payment.bedId);
      if (!bed) {
        return res.status(404).json({ message: "Bed not found" });
      }

      const pgProperty = await storage.getPgPropertyById(bed.pgPropertyId);
      if (!pgProperty || pgProperty.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const updatedPayment = await storage.markBedPaymentPaid(paymentId);

      if (payment.tenantId) {
        if (payment.fineAmount > 0) {
          const newBalance = Math.max(0, bed.depositBalance - payment.fineAmount);
          await storage.updateBedDeposit(bed.id, newBalance);
        }

        await storage.createNotification({
          userId: payment.tenantId,
          type: "payment_received",
          title: "Cash Payment Recorded",
          message: `Your cash payment for bed ${bed.bedNumber} has been recorded`,
          propertyId: null,
        });
      }

      res.json(updatedPayment);
    } catch (error) {
      console.error("PG cash payment error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/tenant/pg-dashboard", isAuthenticated, isTenant, async (req, res) => {
    try {
      const bed = await storage.getBedByTenant(req.user!.id);
      if (!bed) {
        return res.status(404).json({ message: "No bed assigned" });
      }

      const pgProperty = await storage.getPgPropertyById(bed.pgPropertyId);
      if (!pgProperty) {
        return res.status(404).json({ message: "PG property not found" });
      }

      let currentPayment = await storage.getCurrentBedPayment(bed.id, req.user!.id);
      let fineBreakdown = null;

      if (bed.onboardingStartDay && bed.onboardingStartMonth && bed.onboardingStartYear) {
        fineBreakdown = calculateBedFine(
          bed.onboardingStartDay,
          bed.onboardingStartMonth,
          bed.onboardingStartYear,
          bed.rentCycle
        );

        if (!currentPayment && fineBreakdown.dueDate) {
          currentPayment = await storage.createBedPayment({
            bedId: bed.id,
            tenantId: req.user!.id,
            cycleStartDate: fineBreakdown.dueDate,
            cycleEndDate: fineBreakdown.cycleEndDate || fineBreakdown.dueDate,
            rentAmount: bed.rentAmount,
            fineAmount: 0,
            status: "due",
            proofStatus: "none",
          });
        }

        if (currentPayment && currentPayment.status !== "paid" && fineBreakdown.totalFine > 0 && currentPayment.fineAmount !== fineBreakdown.totalFine) {
          currentPayment = await storage.updateBedPaymentFine(currentPayment.id, fineBreakdown.totalFine);
        }
      }

      res.json({ bed, pgProperty, currentPayment, fineBreakdown });
    } catch (error) {
      console.error("Tenant PG dashboard error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/tenant/pg-submit-proof", isAuthenticated, isTenant, upload.single("proof"), async (req, res) => {
    try {
      const paymentId = parseInt(req.body.paymentId);
      const transactionId = req.body.transactionId;

      if (isNaN(paymentId)) {
        return res.status(400).json({ message: "Valid payment ID is required" });
      }

      if (!req.file && !transactionId) {
        return res.status(400).json({ message: "Please provide either a screenshot or transaction ID" });
      }

      const bed = await storage.getBedByTenant(req.user!.id);
      if (!bed) {
        return res.status(403).json({ message: "You are not assigned to any bed" });
      }

      const currentPayment = await storage.getCurrentBedPayment(bed.id, req.user!.id);
      if (!currentPayment || currentPayment.id !== paymentId) {
        return res.status(403).json({ message: "Invalid payment" });
      }

      const proofUrl = req.file ? `/uploads/${req.file.filename}` : null;
      const payment = await storage.updateBedPaymentProof(paymentId, proofUrl, transactionId);

      const pgProperty = await storage.getPgPropertyById(bed.pgPropertyId);
      if (pgProperty) {
        await storage.createNotification({
          userId: pgProperty.ownerId,
          type: "proof_submitted",
          title: "Payment Proof Submitted",
          message: `${req.user!.name} has submitted payment proof for bed ${bed.bedNumber}`,
          propertyId: null,
        });
      }

      res.json(payment);
    } catch (error) {
      console.error("Submit PG proof error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
