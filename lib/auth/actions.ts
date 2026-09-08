"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "./password";
import { createSessionCookie, clearSessionCookie } from "./session";
import { loginSchema, registerSchema } from "@/lib/validation/auth";

export interface AuthActionState {
  error?: string;
}

function safeNextPath(raw: FormDataEntryValue | null): string {
  // Only ever redirect within the app — an unvalidated "next" param taken
  // from a query string is a classic open-redirect vector.
  const value = typeof raw === "string" ? raw : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/console";
}

export async function registerAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await createSessionCookie({ userId: user.id, email: user.email, name: user.name });
  redirect(safeNextPath(formData.get("next")));
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately identical error for "no such user" and "wrong password" —
  // distinguishing them lets an attacker enumerate registered emails.
  const genericError = "Invalid email or password.";
  if (!user) {
    return { error: genericError };
  }
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return { error: genericError };
  }

  await createSessionCookie({ userId: user.id, email: user.email, name: user.name });
  redirect(safeNextPath(formData.get("next")));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
