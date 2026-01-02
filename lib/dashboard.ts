import { prisma } from '@/lib/db';
import { format } from 'date-fns';

export async function fetchCardData() {
    try {
        // Run queries sequentially to spare connection pool in dev
        const quoteCount = await prisma.quote.count();
        const customerCount = await prisma.customer.count();
        const pendingQuoteCount = await prisma.quote.count({
            where: {
                status: {
                    in: ['DRAFT', 'SUBMITTED_REVIEW', 'NEGOTIATION']
                }
            }
        });
        const projectCount = await prisma.project.count();
        const pendingProjectCount = await prisma.project.count({
            where: {
                status: {
                    in: ['CREATED', 'PLANNED', 'DEPOSIT_PENDING', 'SCHEDULING_PENDING']
                }
            }
        });
        const revenueResult = await prisma.payment.aggregate({
            _sum: {
                amountMinor: true
            }
        });

        const totalRevenue = Number(revenueResult._sum.amountMinor || 0) / 100;

        return {
            numberOfQuotes: quoteCount,
            numberOfCustomers: customerCount,
            numberOfPendingQuotes: pendingQuoteCount,
            numberOfProjects: projectCount,
            numberOfPendingProjects: pendingProjectCount,
            totalRevenue,
        };
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch card data.');
    }
}

export async function fetchRevenueData() {
    try {
        // Fetch payments for the last 6 months
        const payments = await prisma.payment.findMany({
            orderBy: {
                receivedAt: 'asc',
            },
            // You might want to limit this to a date range in a real app
        });

        // Group by month
        const revenueByMonth: Record<string, number> = {};

        payments.forEach((payment) => {
            const month = format(payment.receivedAt, 'MMM');
            const amount = Number(payment.amountMinor) / 100;
            revenueByMonth[month] = (revenueByMonth[month] || 0) + amount;
        });

        // Convert to array format for Recharts
        const data = Object.entries(revenueByMonth).map(([name, revenue]) => ({
            name,
            revenue,
        }));

        // If no data, return some empty months or just empty array
        if (data.length === 0) {
            return [
                { name: 'Jan', revenue: 0 },
                { name: 'Feb', revenue: 0 },
                { name: 'Mar', revenue: 0 },
            ];
        }

        return data;
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch revenue data.');
    }
}

export async function fetchRecentQuotes() {
    try {
        const quotes = await prisma.quote.findMany({
            take: 5,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                customer: true,
                lines: true, // To calculate total if needed, or use a pre-calculated field if available
            },
        });

        return quotes.map((quote) => {
            // Calculate total from lines if not stored on quote
            // Note: Schema has lineTotalMinor on QuoteLine. 
            // Quote doesn't seem to have a totalAmount field in the schema I saw, 
            // but let's check if we can sum lines.
            const totalMinor = quote.lines.reduce((sum, line) => sum + Number(line.lineTotalMinor), 0);

            return {
                id: quote.id,
                customer: quote.customer.displayName,
                amount: totalMinor / 100,
                status: quote.status,
                date: format(quote.createdAt, 'yyyy-MM-dd'),
            };
        });
    } catch (error) {
        console.error('Database Error:', error);
        throw new Error('Failed to fetch recent quotes.');
    }
}
