import { prisma } from "@/lib/db";

export async function logUserAction(
  userId: string,
  action: string,
  method: string,
  path: string,
  ip?: string,
  userAgent?: string,
  details?: any
) {
  try {
    await prisma.userActionLog.create({
      data: {
        userId,
        action,
        method,
        path,
        ip,
        userAgent,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    // Swallow logging failures to avoid impacting the app, especially when the pool is saturated.
    console.error("Failed to log user action:", error);
  }
}
