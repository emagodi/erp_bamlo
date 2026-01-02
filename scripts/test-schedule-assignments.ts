import { prisma } from '@/lib/db';

async function testScheduleAssignments() {
    console.log('Testing Schedule Employee Assignments...\n');

    try {
        // 1. Get a project
        const project = await prisma.project.findFirst();
        if (!project) {
            console.log('❌ No project found. Please create a project first.');
            return;
        }
        console.log(`✓ Using project: ${project.id}`);

        // 2. Get employees
        const employees = await prisma.employee.findMany({ take: 2 });
        if (employees.length === 0) {
            console.log('❌ No employees found. Please create employees first.');
            return;
        }
        console.log(`✓ Found ${employees.length} employees`);
        employees.forEach(emp => {
            console.log(`  - ${emp.givenName} ${emp.surname || ''} (${emp.id})`);
        });

        // 3. Create or update schedule
        let schedule = await prisma.schedule.findFirst({
            where: { projectId: project.id },
        });

        if (!schedule) {
            schedule = await prisma.schedule.create({
                data: {
                    projectId: project.id,
                    createdById: 'system',
                    note: 'Test schedule',
                },
            });
            console.log(`✓ Created new schedule: ${schedule.id}`);
        } else {
            console.log(`✓ Using existing schedule: ${schedule.id}`);
        }

        // 4. Delete existing items
        await prisma.scheduleItem.deleteMany({
            where: { scheduleId: schedule.id },
        });
        console.log('✓ Cleared existing schedule items');

        // 5. Create schedule item with employee assignments
        const scheduleItem = await prisma.scheduleItem.create({
            data: {
                scheduleId: schedule.id,
                title: 'Test Task with Assignees',
                description: 'Testing employee assignment',
                unit: 'days',
                quantity: 5,
                plannedStart: new Date(),
                plannedEnd: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                employees: employees.length,
                estHours: 40,
                assignees: {
                    connect: employees.map(emp => ({ id: emp.id })),
                },
            },
            include: {
                assignees: true,
            },
        });

        console.log(`\n✓ Created schedule item: ${scheduleItem.title}`);
        console.log(`  Assigned employees: ${scheduleItem.assignees.length}`);
        scheduleItem.assignees.forEach(emp => {
            console.log(`  - ${emp.givenName} ${emp.surname || ''}`);
        });

        // 6. Verify by fetching
        const verification = await prisma.scheduleItem.findUnique({
            where: { id: scheduleItem.id },
            include: { assignees: true },
        });

        if (verification && verification.assignees.length === employees.length) {
            console.log('\n✅ Employee assignment test PASSED!');
            console.log(`   ${verification.assignees.length} employees correctly assigned to schedule item`);
        } else {
            console.log('\n❌ Employee assignment test FAILED!');
            console.log(`   Expected ${employees.length} assignees, got ${verification?.assignees.length || 0}`);
        }

    } catch (error) {
        console.error('\n❌ Test failed with error:', error);
        process.exit(1);
    }
}

testScheduleAssignments()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
