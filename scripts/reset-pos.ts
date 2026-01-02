
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🗑️  Resetting Purchase Orders and GRNs...');

    // 1. Delete GRN Items
    const deletedGRNItems = await prisma.goodsReceivedNoteItem.deleteMany({});
    console.log(`   - Deleted ${deletedGRNItems.count} GRN Items`);

    // 2. Delete GRNs
    const deletedGRNs = await prisma.goodsReceivedNote.deleteMany({});
    console.log(`   - Deleted ${deletedGRNs.count} GRNs`);

    // 3. Delete PO Items
    const deletedPOItems = await prisma.purchaseOrderItem.deleteMany({});
    console.log(`   - Deleted ${deletedPOItems.count} PO Items`);

    // 4. Delete POs
    const deletedPOs = await prisma.purchaseOrder.deleteMany({});
    console.log(`   - Deleted ${deletedPOs.count} Purchase Orders`);

    // 5. Revert Requisitions from PURCHASED -> APPROVED
    const updatedReqs = await prisma.procurementRequisition.updateMany({
        where: { status: 'PURCHASED' },
        data: { status: 'APPROVED' },
    });
    console.log(`   - Reverted ${updatedReqs.count} Requisitions to APPROVED`);

    console.log('\n✅ Reset complete. You can now start purchasing from the Procurement Dashboard.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
