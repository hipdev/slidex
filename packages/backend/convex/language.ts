import { v } from "convex/values";
export const localeValidator = v.optional(v.union(v.literal("es"), v.literal("en")));
export const languageName = (locale?: "es" | "en") => locale === "en" ? "English" : "Spanish";
