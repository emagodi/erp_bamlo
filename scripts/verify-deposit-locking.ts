
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

const logStream = fs.createWriteStream("verification_log.txt", { flags: 'w' });
function log(msg: string) {
    console.log(msg);
    logStream.write(msg + '\n');
}

async function main() {
    log('--- Verifying Deposit Locking Logic ---');

    const projects = await prisma.project.findMany({
        include: {
            paymentSchedules: true,
            schedules: true, // The actual work schedule
            quote: { select: { number: true, customer: { select: { displayName: true } } } }
        }
    });

    let lockedCount = 0;
    let unlockedCount = 0;
    let alreadyScheduledCount = 0;

    log(`Scanning ${projects.length} projects...\n`);

    for (const p of projects) {
        const name = p.quote?.customer?.displayName || p.name;
        const ref = p.projectNumber || p.quote?.number || p.id;

        // 1. Check Schedule Existence
        const hasWorkSchedule = p.schedules !== null; // 1-to-1 relation usually? or findMany if array
        // Check if relation is array or object. Based on errors it might be array? 
        // Wait, schema said: schedules Schedule? meaning Single. 
        // But page.tsx did findMany. 
        // The previous script worked, so p.schedules check is likely fine if it was correct.
        // If Prisma returns 'null' for no relation, okay. If array, length check.
        // Let's assume it IS an object or null since generated client usually follows schema.
        // But earlier verify script didn't crash on p.schedules... wait, I didn't see if it crashed.

        // Safety check
        const hasSch = !!p.schedules; // or p.schedules.length > 0 if array. 
        // But wait, page.tsx uses `prisma.schedule.count`.

        // 2. Deposit Logic
        const depositItem = p.paymentSchedules.find(s => s.label === 'Deposit');
        let isDepositPaid = true;

        let depositAmount = 0n;
        let paidAmount = 0n;

        if (depositItem) {
            depositAmount = BigInt(depositItem.amountMinor);
            paidAmount = BigInt(depositItem.paidMinor || 0n);
            isDepositPaid = paidAmount >= depositAmount;
        }

        // 3. Status Logic
        const isStatusCheck = (p.status === 'CREATED' || p.status === 'DEPOSIT_PENDING');
        const wouldBeLocked = isStatusCheck && !isDepositPaid;

        const statusStr = `Status: ${p.status}`;
        const depositStr = depositItem
            ? `Deposit: ${Number(paidAmount) / 100}/${Number(depositAmount) / 100} (${isDepositPaid ? 'PAID' : 'PARTIAL/UNPAID'})`
            : `No Deposit Item`;

        if (hasSch) {
            // already scheduled
            // log(`[${ref}] ALREADY SCHEDULED. ${depositStr}`);
            alreadyScheduledCount++;
        } else {
            if (wouldBeLocked) {
                log(`[${ref}] ${name.padEnd(20)} -> LOCKED 🔒`);
                log(`   Reason: ${statusStr} AND ${depositStr}`);
                lockedCount++;
            } else {
                // Unlocked
                log(`[${ref}] ${name.padEnd(20)} -> UNLOCKED 🔓`);
                log(`   Reason: ${statusStr} AND ${depositStr}`);
                unlockedCount++;
            }
        }
    }

    log('\n--- Summary ---');
    log(`Locked (Partial/Unpaid Deposit): ${lockedCount}`);
    log(`Unlocked (Fully Paid or Other Status): ${unlockedCount}`);
    log(`Already Scheduled (Skipped): ${alreadyScheduledCount}`);
}

main()
    .catch(e => {
        console.error(e);
        log('ERROR: ' + e.toString());
    })
    .finally(async () => {
        await prisma.$disconnect();
        logStream.end();
    });
