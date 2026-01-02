import { createTask } from '@/app/actions/scheduling';
import { prisma } from '@/lib/db';

async function runTests() {
    console.log('Starting Scheduling Verification...');

    try {
        // 1. Setup: Get a project and a user
        const project = await prisma.project.findFirst();
        const user = await prisma.user.findFirst();

        if (!project || !user) {
            throw new Error('No project or user found to test with.');
        }

        console.log(`Testing with Project: ${project.id}, User: ${user.id}`);

        // 2. Test Excavation Auto-Calculation
        // Rule: 1.6 hours/m. 50m -> 80 hours.
        // 1 Employee -> 80 / (1 * 8) = 10 days.
        console.log('Testing Excavation Task Creation...');
        const result = await createTask({
            projectId: project.id,
            title: 'Test Excavation',
            templateKey: 'EXCAVATION',
            quantity: 50,
            assigneeIds: [user.id], // Single user
            startDate: new Date().toISOString(),
        });

        if (!result.success || !result.data?.task) {
            console.error('Full Result:', JSON.stringify(result, null, 2));
            throw new Error(`Task creation failed: ${result.error}`);
        }

        const task = result.data.task;
        console.log('Task Created:', task);

        // Verify Estimated Hours
        // 50 * 1.6 = 80
        if (Math.abs(task.estimatedHours - 80) > 0.1) {
            throw new Error(`Expected 80 hours, got ${task.estimatedHours}`);
        }

        // Verify Duration
        if (!task.plannedStart || !task.plannedEnd) {
            throw new Error('Planned dates are missing');
        }

        const start = new Date(task.plannedStart);
        const end = new Date(task.plannedEnd);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        console.log(`Duration in Days: ${diffDays}`);

        // 80 hours / (1 person * 8 hours/day) = 10 days
        if (diffDays !== 10) {
            throw new Error(`Expected 10 days duration, got ${diffDays}`);
        }

        console.log('✅ Excavation Task Verification Passed!');

        // Clean up
        await prisma.taskAssignment.deleteMany({ where: { taskId: task.id } });
        await prisma.task.delete({ where: { id: task.id } });

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
}

runTests();
