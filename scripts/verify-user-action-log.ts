// scripts/verify-user-action-log.ts
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

function loadEnv() {
    if (process.env.DATABASE_URL) return;
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach((line) => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                process.env[key] = value;
            }
        });
    }
}
loadEnv();

const prisma = new PrismaClient();

async function verifyUserActionLog() {
    console.log('🔍 Verifying UserActionLog table...\n');

    try {
        // Check if table exists by trying to count records
        const count = await prisma.userActionLog.count();
        console.log('✅ UserActionLog table exists');
        console.log(`   Total records: ${count}\n`);

        // Check schema by fetching one record
        const sample = await prisma.userActionLog.findFirst();
        if (sample) {
            console.log('✅ Sample record found:');
            console.log(`   ID: ${sample.id}`);
            console.log(`   User ID: ${sample.userId}`);
            console.log(`   Action: ${sample.action}`);
            console.log(`   Method: ${sample.method}`);
            console.log(`   Path: ${sample.path}`);
            console.log(`   IP: ${sample.ip ?? 'N/A'}`);
            console.log(`   Created At: ${sample.createdAt}\n`);
        } else {
            console.log('ℹ️  No records found in UserActionLog table\n');
        }

        // Test logging a sample action
        const testUser = await prisma.user.findFirst();
        if (testUser) {
            console.log('🧪 Testing action logging...');
            const testLog = await prisma.userActionLog.create({
                data: {
                    userId: testUser.id,
                    action: 'TEST_ACTION',
                    method: 'GET',
                    path: '/test',
                    ip: '127.0.0.1',
                    userAgent: 'Test Script',
                    details: 'Verification test',
                },
            });
            console.log('✅ Test log created successfully');
            console.log(`   Log ID: ${testLog.id}\n`);

            // Clean up test log
            await prisma.userActionLog.delete({ where: { id: testLog.id } });
            console.log('✅ Test log cleaned up\n');
        }

        console.log('✅ All UserActionLog verifications passed!');
    } catch (error) {
        console.error('❌ Error verifying UserActionLog:', error);
        if (error instanceof Error) {
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

verifyUserActionLog();
