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
        <div className="absolute inset-0 bg-black/40" /> {/* Overlay */}
      </div>

      <div className="relative z-10 w-full max-w-[400px] p-4">
        <div className="flex flex-col items-center space-y-6 rounded-xl bg-white/95 backdrop-blur-sm p-8 shadow-2xl">
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-16 w-16">
               <Image src="/barmlo_logo.png" alt="Barmlo Logo" fill className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Barmlo Investments</h1>
            <p className="text-sm text-gray-500">Sign in to your account</p>
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
