import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: number;
      phone: string;
      role: "owner" | "tenant" | "admin" | "pg_owner";
      name: string;
      createdAt: Date;
    }
  }
}

passport.use(
  new LocalStrategy(
    { usernameField: "phone", passwordField: "password" },
    async (phone, password, done) => {
      try {
        const user = await storage.getUserByPhone(phone);
        if (!user) {
          return done(null, false, { message: "Invalid phone number or password" });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return done(null, false, { message: "Invalid phone number or password" });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user || null);
  } catch (error) {
    done(error);
  }
});

export { passport };
