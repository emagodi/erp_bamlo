import { HomeIcon, EnvelopeIcon, GlobeAltIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';

export default function PrintHeader() {
  return (
    <div className="hidden print:flex flex-row justify-between items-start mb-8 border-b-2 border-barmlo-blue pb-4 w-full">
      <div className="flex flex-col items-center">
        <div className="relative w-48 h-24">
            <Image src="/barmlo_logo.png" alt="Barmlo Logo" fill className="object-contain" />
        </div>
        <p className="text-barmlo-orange italic mt-1 font-medium text-sm">Your happiness is our pride</p>
      </div>
      
      <div className="flex flex-col gap-3 text-sm text-barmlo-blue mt-2">
        <div className="flex items-start gap-3">
            <HomeIcon className="w-5 h-5 text-barmlo-blue mt-1 shrink-0" />
            <span className="font-bold italic">3294, Light Industry Mberengwa<br/>Business Center</span>
        </div>
        <div className="flex items-center gap-3">
            <EnvelopeIcon className="w-5 h-5 text-barmlo-blue shrink-0" />
            <span className="font-bold italic">info@barmlo.co.zw</span>
        </div>
         <div className="flex items-center gap-3">
            <GlobeAltIcon className="w-5 h-5 text-barmlo-blue shrink-0" />
            <span className="font-bold italic">www.barmlo.co.zw</span>
        </div>
      </div>
    </div>
  );
}
