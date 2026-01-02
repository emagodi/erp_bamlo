
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Fixing Premature PLANNED Status ---');

    const projects = await prisma.project.findMany({
        where: { status: 'PLANNED' },
        include: {
            paymentSchedules: true,
            quote: { select: { number: true, customer: { select: { displayName: true } } } }
        }
    });

    console.log(`Found ${projects.length} PLANNED projects. Checking deposits...`);

    let fixedCount = 0;

    for (const p of projects) {
        const depositItem = p.paymentSchedules.find(s => s.label === 'Deposit');
        if (!depositItem) continue; // No deposit item, leave as is (maybe fully paid upfront or no deposit logic)

        const deposit = BigInt(depositItem.amountMinor);
        const paid = BigInt(depositItem.paidMinor ?? 0n);

        if (deposit > 0n && paid < deposit) {
            console.log(`Project ${p.projectNumber} (${p.quote?.customer?.displayName}) is PLANNED but Deposit is partial.`);
            console.log(`   Deposit: ${Number(paid) / 100} / ${Number(deposit) / 100}`);
            console.log(`   Action: Reverting status to DEPOSIT_PENDING`);

            await prisma.project.update({
                where: { id: p.id },
                data: { status: 'DEPOSIT_PENDING' }
            });
            fixedCount++;
        }
    }

    console.log(`--- Done. Reverted ${fixedCount} projects. ---`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
