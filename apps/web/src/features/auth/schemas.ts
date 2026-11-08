import { z } from "zod";

const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters");

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password,
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });
