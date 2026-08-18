'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Opens the browser print dialog, where "Save as PDF" gives a clean A4 file. */
export function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" />
      Print or save as PDF
    </Button>
  );
}
