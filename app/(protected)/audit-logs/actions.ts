'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type AuditLogFilters = {
    userId?: string;
    method?: string;
    path?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
};

export async function getAuditLogs(filters: AuditLogFilters = {}) {
    const user = await getCurrentUser();

    if (!user || user.role !== 'ADMIN') {
        throw new Error('Unauthorized: Admin access required');
    }

    const {
        userId,
        method,
        path,
        dateFrom,
        dateTo,
        page = 1,
        pageSize = 50,
    } = filters;

    const where: any = {};

    if (userId) {
        where.userId = userId;
    }

    if (method) {
        where.method = method;
    }

    if (path) {
        where.path = {
            contains: path,
            mode: 'insensitive',
        };
    }

    if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) {
            where.createdAt.gte = new Date(dateFrom);
        }
        if (dateTo) {
            // Add one day to include the entire end date
            const endDate = new Date(dateTo);
            endDate.setDate(endDate.getDate() + 1);
            where.createdAt.lt = endDate;
        }
    }

    const [logs, totalCount] = await Promise.all([
        prisma.userActionLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.userActionLog.count({ where }),
    ]);

    return {
        logs,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
    };
}

export async function getAllUsers() {
    const user = await getCurrentUser();

    if (!user || user.role !== 'ADMIN') {
        throw new Error('Unauthorized: Admin access required');
    }

    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
        },
        orderBy: { email: 'asc' },
    });

    return users;
}

export async function exportAuditLogs(filters: AuditLogFilters = {}, format: 'csv' | 'json' = 'csv') {
    const user = await getCurrentUser();

    if (!user || user.role !== 'ADMIN') {
        throw new Error('Unauthorized: Admin access required');
    }

    const where: any = {};

    if (filters.userId) {
        where.userId = filters.userId;
    }

    if (filters.method) {
        where.method = filters.method;
    }

    if (filters.path) {
        where.path = {
            contains: filters.path,
            mode: 'insensitive',
        };
    }

    if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) {
            where.createdAt.gte = new Date(filters.dateFrom);
        }
        if (filters.dateTo) {
            const endDate = new Date(filters.dateTo);
            endDate.setDate(endDate.getDate() + 1);
            where.createdAt.lt = endDate;
        }
    }

    const logs = await prisma.userActionLog.findMany({
        where,
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                    role: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    if (format === 'json') {
        return JSON.stringify(logs, null, 2);
    }

    // CSV format
    const headers = ['Timestamp', 'User Email', 'User Name', 'Role', 'Action', 'Method', 'Path', 'IP', 'User Agent'];
    const rows = logs.map(log => [
        log.createdAt.toISOString(),
        log.user.email,
        log.user.name || '',
        log.user.role,
        log.action,
        log.method,
        log.path,
        log.ip || '',
        log.userAgent || '',
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
}
