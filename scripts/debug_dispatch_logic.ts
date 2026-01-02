
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Debugging Dispatch Logic ---');

    // 1. Find the project (assuming recent one or hardcode if known, but I'll search for one with relevant data)
    const projects = await prisma.project.findMany({
        where: {
            requisitions: {
                some: {
                    status: { in: ['APPROVED', 'PARTIAL', 'PURCHASED', 'COMPLETED'] }
                }
            }
        },
        include: {
            requisitions: {
                include: {
                    items: true
                }
            }
        },
        take: 1
    });

    if (projects.length === 0) {
        console.log('No relevant projects found.');
        return;
    }

    const project = projects[0];
    console.log(`Checking Project: ${project.title} (${project.id})`);

    // 2. Compute eligible req IDs
    const eligibleReqs = project.requisitions.filter(r =>
        ['APPROVED', 'PARTIAL', 'PURCHASED', 'COMPLETED'].includes(r.status)
    );
    const reqIds = eligibleReqs.map(r => r.id);
    console.log(`Eligible Req IDs: ${reqIds.length}`);

    // 3. Run the exact query used in page.tsx
    const verifiedGrnItems = await prisma.goodsReceivedNoteItem.findMany({
        where: {
            grn: {
                status: 'VERIFIED',
                purchaseOrder: { projectId: project.id },
            },
            poItem: { requisitionItemId: { in: reqIds } },
        },
        select: {
            id: true,
            qtyAccepted: true,
            poItem: { select: { id: true, requisitionItemId: true } },
            grn: { select: { id: true, status: true, purchaseOrderId: true } }
        },
    });

    console.log('--- Query Result from page.tsx logic ---');
    console.log(`Found ${verifiedGrnItems.length} verified items.`);
    verifiedGrnItems.forEach(i => {
        console.log(`GRN Item: ${i.id}, QtyAccepted: ${i.qtyAccepted}, ReqItem ID: ${i.poItem?.requisitionItemId}, GRN: ${i.grn.id} (${i.grn.status})`);
    });

    // 4. If nothing found, investigate why by traversing up from GRN
    if (verifiedGrnItems.length === 0) {
        console.log('\n--- Deep Dive Investigation ---');
        // Find ANY verified GRN in this project
        const anyGrn = await prisma.goodsReceivedNote.findMany({
            where: {
                status: 'VERIFIED',
                purchaseOrder: { projectId: project.id }
            },
            include: {
                items: {
                    include: {
                        poItem: true
                    }
                },
                purchaseOrder: true
            },
            take: 5
        });

        if (anyGrn.length === 0) {
            console.log('No VERIFIED GRNs found for this project at all.');
        } else {
            console.log(`Found ${anyGrn.length} Verified GRNs in project.`);
            anyGrn.forEach(grn => {
                console.log(`\nGRN: ${grn.id}`);
                console.log(`Purchase Order: ${grn.purchaseOrderId}`);
                grn.items.forEach(item => {
                    console.log(`  Item: ${item.description}, QtyAccepted: ${item.qtyAccepted}`);
                    console.log(`  -> Linked PO Item: ${item.poItemId}`);
                    if (item.poItem) {
                        console.log(`    -> PO Item Req ID: ${item.poItem.requisitionItemId}`);
                        if (item.poItem.requisitionItemId && !reqIds.includes(item.poItem.requisitionItemId)) {
                            console.log(`    !!! Mismatch: PO Req ID ${item.poItem.requisitionItemId} is not in eligible list.`);
                        }
                    } else {
                        console.log(`    !!! Missing PO Item Link`);
                    }
                });
            });
        }
    }

}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
