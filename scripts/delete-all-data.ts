
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting full data wipe (Projects & Quotes)...');

    // 1. Transactional/Operational Tables (Children of Project/Quote)
    // Inventory/Logistics
    console.log('Deleting Logistics...');
    await prisma.inventoryReturn.deleteMany({});
    await prisma.stockMove.deleteMany({});
    await prisma.dispatchItem.deleteMany({});
    await prisma.dispatch.deleteMany({});
    await prisma.inventoryAllocation.deleteMany({});
    await prisma.goodsReceivedNoteItem.deleteMany({});
    await prisma.goodsReceivedNote.deleteMany({});

    // Procurement
    console.log('Deleting Procurement...');
    await prisma.purchase.deleteMany({}); // On Requisition
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.fundingRequest.deleteMany({}); // On Requisition
    await prisma.requisitionItemTopup.deleteMany({});
    await prisma.procurementRequisitionItem.deleteMany({});
    await prisma.procurementRequisition.deleteMany({});

    // Financials
    console.log('Deleting Financials...');
    await prisma.clientPayment.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.paymentSchedule.deleteMany({});

    // Project Management
    console.log('Deleting PM Data...');
    await prisma.taskProgress.deleteMany({});
    await prisma.taskAssignment.deleteMany({});
    await prisma.projectTask.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.projectProductivitySetting.deleteMany({});
    await prisma.scheduleItem.deleteMany({});
    await prisma.schedule.deleteMany({});

    // 2. Project
    console.log('Deleting Projects...');
    await prisma.project.deleteMany({});

    // 3. Quote Related
    console.log('Deleting Quote Data...');
    await prisma.quoteLineExtraRequest.deleteMany({});
    await prisma.quoteNegotiationItem.deleteMany({});
    await prisma.quoteNegotiation.deleteMany({});
    await prisma.quoteLine.deleteMany({});
    await prisma.quoteVersion.deleteMany({}); // Versions refer to Quote

    // 4. Quote
    console.log('Deleting Quotes...');
    await prisma.quote.deleteMany({});

    console.log('✓ Full wipe complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
