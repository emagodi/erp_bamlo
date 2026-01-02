import { NextRequest, NextResponse } from 'next/server';
import { logUserAction } from '@/lib/action-logger';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, action, method, path, ip, userAgent } = body;

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        await logUserAction(userId, action, method, path, ip, userAgent);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error logging user action:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        console.error('Stack trace:', error instanceof Error ? error.stack : 'N/A');
        // Return success anyway to avoid breaking the app
        return NextResponse.json({ success: true }, { status: 200 });
    }
}
