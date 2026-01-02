
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting project reset...');

    // 1. Find all projects
    const projects = await prisma.project.findMany({
        select: { id: true, quoteId: true },
    });

    console.log(`Found ${projects.length} projects to reset.`);

    for (const project of projects) {
        try {
            console.log(`Resetting project ${project.id} (Quote: ${project.quoteId})...`);

            // 2. Delete the project (cascading deletes should handle most children, but let's be safe)
            // Note: If you have strict actions or logs, they might persist.
            // We will rely on cascade or manual deletion if needed.
            // Assuming cascade is configured or we just delete the parent.

            // Delete dependent PaymentSchedules to avoid constraints if any
            await prisma.paymentSchedule.deleteMany({ where: { projectId: project.id } });
            await prisma.projectTask.deleteMany({ where: { projectId: project.id } });
            await prisma.inventoryAllocation.deleteMany({ where: { projectId: project.id } });
            await prisma.dispatch.deleteMany({ where: { projectId: project.id } });

            // Delete the Project
            await prisma.project.delete({
                where: { id: project.id },
            });

            // 3. Update the Quote status to 'REVIEWED' so it can be endorsed again
            await prisma.quote.update({
                where: { id: project.quoteId },
                data: {
                    status: 'REVIEWED',
                    // Clear any project-specific flags if they exist on Quote? 
                    // The schema verification showed negotiationCycle etc., but status is the main one.
                },
            });

            console.log(`✓ Project ${project.id} deleted and Quote ${project.quoteId} reverted.`);
        } catch (e) {
            console.error(`Error resetting project ${project.id}:`, e);
        }
    }

    console.log('Project reset complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
