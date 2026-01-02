import LoginForm from '@/app/ui/login-form';
import { Suspense } from 'react';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <main className="relative flex items-center justify-center min-h-screen overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/login_bg.png"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-blue-500/30 mix-blend-multiply" /> {/* Blue Overlay */}
      </div>

      <div className="relative z-10 w-full max-w-[400px] p-4">
        <div className="flex flex-col items-center space-y-6">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white/20 shadow-xl">
               <Image src="/barmlo_logo.png" alt="Barmlo Logo" fill className="object-cover" />
            </div>
          </div>
          
          <div className="w-full">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
