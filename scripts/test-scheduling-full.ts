import { createTask, updateTaskProgress } from '@/app/actions/scheduling';
import { prisma } from '@/lib/db';

async function runTests() {
    console.log('Starting Comprehensive Scheduling Verification...');

    try {
        // 1. Setup
        const project = await prisma.project.findFirst();
        const user = await prisma.user.findFirst();

        if (!project || !user) {
            throw new Error('No project or user found to test with.');
        }

        console.log(`Testing with Project: ${project.id}, User: ${user.id}`);

        // 2. Test Task Creation (Auto-Calc)
        console.log('--- Step 1: Create Task ---');
        const createResult = await createTask({
            projectId: project.id,
            title: 'Full Test Excavation',
            templateKey: 'EXCAVATION',
            quantity: 100, // 100m -> 160 hours
            assigneeIds: [user.id],
            startDate: new Date().toISOString(),
        });

        if (!createResult.success || !createResult.data?.task) {
            throw new Error(`Task creation failed: ${createResult.error}`);
        }

        const task = createResult.data.task;
        console.log(`Task Created: ${task.title} (ID: ${task.id})`);
        console.log(`Estimated Hours: ${task.estimatedHours} (Expected: 160)`);

        if (Math.abs(task.estimatedHours - 160) > 0.1) {
            throw new Error('Estimated hours calculation incorrect.');
        }

        // 3. Test Progress Update
        console.log('--- Step 2: Submit Progress Update ---');
        const updateResult = await updateTaskProgress({
            taskId: task.id,
            userId: user.id,
            percent: 50,
            note: 'Halfway done with digging.',
        });

        if (!updateResult.success) {
            throw new Error(`Progress update failed: ${updateResult.error}`);
        }
        console.log('Progress update submitted successfully.');

        // 4. Verify Data Persistence (Admin View)
        console.log('--- Step 3: Verify Data Persistence ---');
        const updatedTask = await prisma.task.findUnique({
            where: { id: task.id },
            include: { progressLogs: true },
        });

        if (!updatedTask) throw new Error('Task not found after update.');

        console.log(`Task Status: ${updatedTask.status}`);
        console.log(`Percent Complete: ${updatedTask.percentComplete}%`);

        if (updatedTask.percentComplete !== 50) {
            throw new Error('Task percent complete not updated.');
        }

        const log = updatedTask.progressLogs[0];
        if (!log || log.percent !== 50 || log.note !== 'Halfway done with digging.') {
            throw new Error('Progress log not saved correctly.');
        }
        console.log('Progress log verified.');

        console.log('✅ All Scheduling & Reporting Tests Passed!');

        // Cleanup
        await prisma.taskProgress.deleteMany({ where: { taskId: task.id } });
        await prisma.taskAssignment.deleteMany({ where: { taskId: task.id } });
        await prisma.task.delete({ where: { id: task.id } });

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
}

runTests();
