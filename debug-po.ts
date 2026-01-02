
import { prisma } from './lib/db';

async function main() {
    console.log('Fetching Purchase Orders...');
    const pos = await prisma.purchaseOrder.findMany({
        include: {
            project: true,
        }
    });

    console.log(`Found ${pos.length} Purchase Orders.`);
    pos.forEach(po => {
        console.log(`PO ID: ${po.id}, Status: ${po.status}, CreatedAt: ${po.createdAt}, Project: ${po.project?.projectNumber}`);
    });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
