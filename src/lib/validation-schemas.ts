import { z } from "zod";

// Stripe Connect
export const stripeConnectSchema = z.object({
  code: z.string().min(1),
  state: z.string().optional(),
});

// Run leak scan
export const runScanSchema = z.object({
  connectionId: z.string().uuid(),
  scanType: z.enum(["quick", "deep"]).default("quick"),
});

// Create scenario
export const createScenarioSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["churn_reduction", "price_increase", "expansion", "recovery"]),
  parameters: z.record(z.unknown()),
});

// AI Copilot
export const copilotMessageSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationHistory: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

// Churn intervention
export const churnInterventionSchema = z.object({
  customerId: z.string().min(1),
  type: z.enum(["discount", "outreach", "feature_highlight", "survey"]),
  params: z.record(z.unknown()).optional(),
});
