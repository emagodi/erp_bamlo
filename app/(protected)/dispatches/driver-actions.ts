'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function acknowledgeDispatchByDriver(dispatchId: string) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'DRIVER' && user.role !== 'ADMIN')) {
        throw new Error('Unauthorized');
    }

    await prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
            status: 'SENT', // Driver has it and is leaving
            driverById: user.id,
            driverSignedAt: new Date(),
            departAt: new Date()
        }
    });

    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath('/dashboard');
}

export async function getDrivers() {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SECURITY' && user.role !== 'ADMIN')) {
        throw new Error('Unauthorized');
    }
    return prisma.user.findMany({
        where: { role: 'DRIVER' },
        select: { id: true, name: true, email: true }
    });
}

export async function assignDriverToDispatch(dispatchId: string, driverId: string) {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'SECURITY' && user.role !== 'ADMIN')) {
        throw new Error('Unauthorized');
    }

    await prisma.dispatch.update({
        where: { id: dispatchId },
        data: {
            assignedToDriverId: driverId,
            status: 'DISPATCHED', // Updated to DISPATCHED so it shows in driver's list (was SENT, but dashboard looks for DISPATCHED)
            securitySignedAt: new Date(),
            securityById: user.id
        }
    });

    revalidatePath(`/dispatches/${dispatchId}`);
    revalidatePath('/dashboard');
}
