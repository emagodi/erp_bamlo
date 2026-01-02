'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { safeAction } from '@/lib/safe-action';
import { revalidatePath } from 'next/cache';
import { addDays } from 'date-fns';

const createTaskSchema = z.object({
    projectId: z.string(),
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    templateKey: z.string().optional(),
    quantity: z.number().optional(),
    assigneeIds: z.array(z.string()).optional(),
    startDate: z.string().optional(), // ISO string
});

export const createTask = safeAction(createTaskSchema, async (data) => {
    const { projectId, title, description, templateKey, quantity, assigneeIds, startDate } = data;

    let estimatedHours = 8; // Default
    let plannedEnd: Date | undefined;
    const start = startDate ? new Date(startDate) : new Date();

    // 1. Auto-calculate duration if template and quantity are provided
    if (templateKey && quantity) {
        const template = await prisma.taskTemplate.findUnique({
            where: { key: templateKey },
        });

        if (template) {
            // e.g. 50m * 1.6 hours/m = 80 hours
            estimatedHours = quantity * template.hoursPerUnit * template.complexityFactor;

            // Calculate duration in days based on assignees
            // Default to 1 person if no assignees yet
            const numAssignees = assigneeIds?.length || 1;
            const hoursPerDay = 8; // Standard workday

            // Total man-hours needed / (people * hours/day) = days needed
            const daysNeeded = Math.ceil(estimatedHours / (numAssignees * hoursPerDay));

            plannedEnd = addDays(start, daysNeeded);
        }
    }

    // 2. Create the task
    const task = await prisma.task.create({
        data: {
            projectId,
            title,
            description,
            templateKey,
            quantity,
            estimatedHours,
            plannedStart: start,
            plannedEnd,
            createdById: 'system', // TODO: Get actual user ID
            assignments: assigneeIds ? {
                create: assigneeIds.map(userId => ({
                    userId,
                    hoursPerDay: 8, // Default
                }))
            } : undefined,
        },
    });

    try {
        revalidatePath(`/projects/${projectId}`);
    } catch (error) {
        // Ignore revalidatePath errors in scripts/testing
    }
    return { success: true, task };
});

const updateProgressSchema = z.object({
    taskId: z.string(),
    userId: z.string(),
    percent: z.number().min(0).max(100),
    note: z.string().optional(),
});

export const updateTaskProgress = safeAction(updateProgressSchema, async (data) => {
    const { taskId, userId, percent, note } = data;

    // 1. Log the progress
    await prisma.taskProgress.create({
        data: {
            taskId,
            userId,
            percent,
            note,
        },
    });

    // 2. Update the task's overall percentage
    // For simplicity, we'll just take the latest reported percentage as the task status
    // In a real app, you might average it or have a more complex logic
    await prisma.task.update({
        where: { id: taskId },
        data: {
            percentComplete: percent,
            status: percent === 100 ? 'DONE' : 'IN_PROGRESS',
        },
    });

    try {
        revalidatePath('/my-tasks');
    } catch (error) {
        // Ignore revalidatePath errors in scripts/testing
    }
    return { success: true };
});
