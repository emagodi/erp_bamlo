'use server';

import { prisma } from '@/lib/db';

export async function checkEmployeeAvailability(
    employeeIds: string[],
    startDate: string, // ISO Date string YYYY-MM-DD
    endDate: string,   // ISO Date string YYYY-MM-DD
    excludeScheduleItemId?: string
) {
    if (!employeeIds.length) return { busy: [] };

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Ensure valid dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date range');
    }

    // Find any schedule items that overlap with the requested range
    // AND have any of the requested employees assigned
    // AND are not the item we are currently editing

    // Overlap logic: (StartA <= EndB) and (EndA >= StartB)
    // The user mentioned a 1-day buffer for cross-project tasks.
    // "task ends 1 day before... or starts 1 day after"
    // This implies we should treat the busy period as [Start - 1 day, End + 1 day] effectively?
    // Or just ensure strict non-overlap?
    // "tasks dont overlap but its already sorted since we are calculating..." -> This is for same project.
    // For cross-project: "another project can be able to assign... if that task ends 1 day before... or starts 1 day after"
    // This means if Task A is Jan 5 - Jan 10.
    // Task B can start Jan 12 (1 day gap: Jan 11).
    // Task B cannot start Jan 11.
    // So effectively, we extend the busy range by 1 day on both ends? 
    // Or simply: Busy Range = [Start, End].
    // Requested Range = [ReqStart, ReqEnd].
    // Check if [ReqStart, ReqEnd] overlaps with [BusyStart, BusyEnd].
    // User says: "ends 1 day before" -> End < Start - 1 -> End + 1 < Start
    // "starts 1 day after" -> Start > End + 1
    // So if (Start <= End + 1) AND (End >= Start - 1), it's a conflict.

    // Let's implement strict overlap first, then add the buffer if needed.
    // Actually, the user's text is specific: "ends 1 day before... starts 1 day after".
    // This implies a 1-day gap is REQUIRED.
    // So if Task A ends Jan 10, Task B can start Jan 12. Jan 11 is the gap.
    // So conflict if: Task B Start <= Task A End + 1 Day.

    // Let's query for conflicting items.
    const conflicts = await prisma.scheduleItem.findMany({
        where: {
            id: excludeScheduleItemId ? { not: excludeScheduleItemId } : undefined,
            assignees: {
                some: {
                    id: { in: employeeIds },
                },
            },
            // Conflict logic with 1 day buffer:
            // Existing Item: [ES, EE]
            // New Item: [NS, NE]
            // Conflict if NOT (NE < ES - 1 OR NS > EE + 1)
            // Conflict if (NE >= ES - 1) AND (NS <= EE + 1)
            AND: [
                {
                    plannedEnd: {
                        gte: new Date(start.getTime() - 24 * 60 * 60 * 1000), // New Start - 1 day
                    },
                },
                {
                    plannedStart: {
                        lte: new Date(end.getTime() + 24 * 60 * 60 * 1000), // New End + 1 day
                    },
                },
            ],
            status: { not: 'DONE' }, // Assuming DONE tasks don't block? Or do they? "during the duration of that task". Assuming planned tasks block.
        },
        select: {
            id: true,
            plannedStart: true,
            plannedEnd: true,
            assignees: {
                where: { id: { in: employeeIds } },
                select: { id: true, givenName: true, surname: true },
            },
            schedule: {
                select: {
                    project: {
                        select: { name: true, projectNumber: true },
                    },
                },
            },
        },
    });

    // Extract busy employee IDs
    const busyEmployeeIds = new Set<string>();
    const details: Record<string, any> = {};

    for (const c of conflicts) {
        for (const a of c.assignees) {
            busyEmployeeIds.add(a.id);
            details[a.id] = {
                conflictProject: c.schedule.project.name || c.schedule.project.projectNumber,
                conflictStart: c.plannedStart,
                conflictEnd: c.plannedEnd,
            };
        }
    }

    return {
        busy: Array.from(busyEmployeeIds),
        details,
    };
}
