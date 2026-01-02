import { z } from 'zod';

export type ActionState<T> = {
    success: boolean;
    data?: T;
    error?: string;
    fieldErrors?: Record<string, string[]>;
};

export function safeAction<TInput, TOutput>(
    schema: z.Schema<TInput>,
    action: (data: TInput) => Promise<TOutput>
): (formData: unknown) => Promise<ActionState<TOutput>> {
    return async (formData: unknown): Promise<ActionState<TOutput>> => {
        try {
            const validated = schema.safeParse(formData);

            if (!validated.success) {
                return {
                    success: false,
                    error: 'Validation failed',
                    fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
                };
            }

            const data = await action(validated.data);
            return { success: true, data };
        } catch (error) {
            console.error('Server Action Error:', error);

            if (error instanceof Error) {
                return { success: false, error: error.message };
            }

            return { success: false, error: 'An unexpected error occurred' };
        }
    };
}

// A simpler wrapper for actions that don't need Zod validation or handle it differently
export async function wrapAction<T>(
    action: () => Promise<T>
): Promise<ActionState<T>> {
    try {
        const data = await action();
        return { success: true, data };
    } catch (error) {
        console.error('Server Action Error:', error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: 'An unexpected error occurred' };
    }
}
