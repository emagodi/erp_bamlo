import { prisma } from '@/lib/db';
import { format } from 'date-fns';

/**
 * Generate the next project number for the given date.
 * Format: BM[YYYYMMDD][XXX]
 * Example: BM20251220001
 * 
 * @param date - The date for which to generate the project number (defaults to today)
 * @returns Promise<string> - The generated project number
 */
export async function generateProjectNumber(date: Date = new Date()): Promise<string> {
    const dateStr = format(date, 'yyyyMMdd');
    const prefix = `BM${dateStr}`;

    // Find the highest sequence number for this date
    const lastProject = await prisma.project.findFirst({
        where: {
            projectNumber: {
                startsWith: prefix,
            },
        },
        orderBy: {
            projectNumber: 'desc',
        },
        select: {
            projectNumber: true,
        },
    });

    let sequence = 1;
    if (lastProject?.projectNumber) {
        // Extract the last 3 digits
        const lastSequence = parseInt(lastProject.projectNumber.slice(-3), 10);
        sequence = lastSequence + 1;
    }

    // Format sequence as 3-digit padded number
    const sequenceStr = sequence.toString().padStart(3, '0');

    return `${prefix}${sequenceStr}`;
}

/**
 * Generate a project number within a transaction
 * This ensures atomic generation even with concurrent requests
 */
export async function generateProjectNumberInTransaction(tx: any, date: Date = new Date()): Promise<string> {
    const dateStr = format(date, 'yyyyMMdd');
    const prefix = `BM${dateStr}`;

    // Find the highest sequence number for this date
    const lastProject = await tx.project.findFirst({
        where: {
            projectNumber: {
                startsWith: prefix,
            },
        },
        orderBy: {
            projectNumber: 'desc',
        },
        select: {
            projectNumber: true,
        },
    });

    let sequence = 1;
    if (lastProject?.projectNumber) {
        // Extract the last 3 digits
        const lastSequence = parseInt(lastProject.projectNumber.slice(-3), 10);
        sequence = lastSequence + 1;
    }

    // Format sequence as 3-digit padded number
    const sequenceStr = sequence.toString().padStart(3, '0');

    return `${prefix}${sequenceStr}`;
}
