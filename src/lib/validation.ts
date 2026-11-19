import { z } from "zod";

const clean = (max: number) => z.string().trim().max(max).transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F<>]/g, ""));
const optional = (max: number) => clean(max).optional().or(z.literal("")).transform((v) => v || null);
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{8,15}$/, "Enter a valid mobile number").transform((s) => s.replace(/[\s-]/g, ""));
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(160);
const uuid = z.string().uuid().optional().or(z.literal("")).transform((v) => v || null);
const check = z.union([z.literal("on"), z.literal("true"), z.literal("")]).optional().transform((v) => v === "on" || v === "true");

export const donationSchema = z.object({
  donor_name: clean(120).pipe(z.string().min(2, "Enter your name")),
  email, phone,
  amount: z.coerce.number({ message: "Enter the amount you paid" }).positive("Enter the amount you paid").max(10_000_000),
  utr: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{8,30}$/, "Enter the transaction reference (UTR) from your UPI app: 8 to 30 letters and digits"),
  paid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the payment date")
    .refine((d) => new Date(d).getTime() <= Date.now() + 86_400_000, "The payment date cannot be in the future"),
  purpose: optional(120),
  proof_path: z.string().regex(/^proofs\/[\w-]+\.(jpg|jpeg|png|webp|pdf)$/i).optional().or(z.literal("")).transform((v) => v || null),
  whatsapp_opt_in: check,
});

export const volunteerSchema = z.object({
  full_name: clean(120).pipe(z.string().min(2, "Enter your full name")),
  email, phone,
  state_id: uuid, district_id: uuid,
  city: optional(80), interest: optional(160), skills: optional(300), availability: optional(160), intro: optional(1000),
  photo_path: z.string().regex(/^applicants\/[\w-]+\.(jpg|jpeg|png|webp)$/i).optional().or(z.literal("")).transform((v) => v || null),
  consent_contact: check.refine((v) => v, "Please agree to be contacted about your application"),
  whatsapp_opt_in: check,
});

export const registrationSchema = z.object({
  event_id: z.string().uuid(),
  full_name: clean(120).pipe(z.string().min(2, "Enter your name")),
  email, phone: phone.optional().or(z.literal("")).transform((v) => v || null),
  whatsapp_opt_in: check,
});

export const passwordSchema = z.string().min(10, "Use at least 10 characters")
  .regex(/[a-z]/, "Add a lowercase letter").regex(/[A-Z]/, "Add an uppercase letter").regex(/[0-9]/, "Add a number");

export const registerSchema = z.object({
  full_name: clean(120).pipe(z.string().min(2, "Enter your name")),
  email, phone: phone.optional().or(z.literal("")).transform((v) => v || null),
  password: passwordSchema,
});

export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Please check the form";

/* ── Upgrade 2: membership ─────────────────────────────────────────────── */
const adult = (d: string) => {
  const b = new Date(d), n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) age--;
  return age >= 18 && age < 110;
};
const dob = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth").refine(adult, "You must be 18 or older to register");
const photo = z.string().regex(/^applicants\/[\w-]+\.(jpg|jpeg|png)$/i, "Upload the photograph again").optional().or(z.literal("")).transform((v) => v || null);

export const volunteerRegisterSchema = z.object({
  full_name: clean(120).pipe(z.string().min(2, "Enter your full name")),
  email, phone, date_of_birth: dob,
  gender: optional(30),
  district_id: z.string().uuid("Choose your district"),
  city: optional(80), address: optional(400), occupation: optional(120),
  interest: optional(300), skills: optional(300), availability: optional(160),
  photo_path: photo,
  consent_contact: check.refine((v) => v, "Please accept the declaration to register"),
  whatsapp_opt_in: check,
});

export const repApplicationSchema = z.object({
  full_name: clean(120).pipe(z.string().min(2, "Enter your full name")),
  date_of_birth: dob, email, phone,
  state_id: uuid, district_id: z.string().uuid("Choose the district you want to represent"),
  city: clean(80).pipe(z.string().min(2, "Enter your city")),
  address: clean(400).pipe(z.string().min(10, "Enter your complete address")),
  photo_path: z.string().regex(/^applicants\/[\w-]+\.(jpg|jpeg|png)$/i, "Upload a passport-size photograph"),
  employment_type: z.enum(["salaried", "self_employed", "business_owner", "student", "other"], { message: "Choose your employment type" }),
  organisation: optional(160), designation: optional(120), business_name: optional(160), business_type: optional(120),
  profession: optional(160), institution: optional(160), course: optional(120),
  annual_income: optional(60),
  motivation: clean(2000).pipe(z.string().min(20, "Tell us why you want to represent Vrutsa Foundation (a few sentences)")),
  past_activities: optional(2000), ngo_experience: optional(2000),
  introduction: clean(1500).pipe(z.string().min(20, "Write a short personal introduction")),
  document_path: z.string().regex(/^documents\/[\w-]+\.(jpg|jpeg|png|webp|pdf)$/i).optional().or(z.literal("")).transform((v) => v || null),
  consent: check.refine((v) => v, "Please accept the declaration to submit"),
});
