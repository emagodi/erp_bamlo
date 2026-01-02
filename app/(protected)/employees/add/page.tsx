'use server';

import { getCurrentUser } from '@/lib/auth';
import { createEmployee } from '../actions';
import { redirect } from 'next/navigation';

function canManage(role: string | null | undefined) {
  return ['ADMIN', 'MANAGING_DIRECTOR', 'PROJECT_MANAGER'].includes(role || '');
}

export default async function AddEmployeePage() {
  const me = await getCurrentUser();
  if (!me) return <div className="p-6">Auth required</div>;
  if (!canManage(me.role)) return <div className="p-6">Not authorized</div>;

  async function add(formData: FormData) {
    'use server';
    await createEmployee(formData);
    redirect('/employees');
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Add Employee</h1>
      <p className="text-sm text-gray-600">Creating an employee also creates a user account with password: Password01</p>
      <form action={add} className="space-y-3 max-w-xl">
        <div className="grid grid-cols-2 gap-3">
          <input
            name="givenName"
            className="rounded border px-3 py-2"
            placeholder="First name"
            required
          />
          <input
            name="surname"
            className="rounded border px-3 py-2"
            placeholder="Last name"
          />
          <input name="email" type="email" className="rounded border px-3 py-2 col-span-2" placeholder="Email" required />
          <input name="phone" className="rounded border px-3 py-2 col-span-2" placeholder="Phone" />
          <select name="role" className="rounded border px-3 py-2 col-span-2" required defaultValue="BUILDER">
            <option value="BUILDER">Builder</option>
            <option value="CARPENTER">Carpenter</option>
            <option value="ASSISTANT">Assistant</option>
            <option value="ELECTRICIAN">Electrician</option>
            <option value="PLUMBER">Plumber</option>
          </select>
          <input name="office" className="rounded border px-3 py-2 col-span-2" placeholder="Office (e.g., Harare, Bulawayo)" />
        </div>
        <button
          type="submit"
          className="rounded bg-emerald-600 px-4 py-2 text-white text-sm hover:bg-emerald-700"
        >
          Save
        </button>
      </form>
    </div>
  );
}
