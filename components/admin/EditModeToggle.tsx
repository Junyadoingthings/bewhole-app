'use client';

import React from 'react';
import { useAdminEdit } from '@/app/context/AdminEditContext';
import { Edit3, X } from 'lucide-react';

export function EditModeToggle() {
  const { isEditMode, toggleEditMode } = useAdminEdit();

  return (
    <button
      onClick={toggleEditMode}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-800 text-white px-4 py-3 rounded-full shadow-lg hover:bg-green-900 transition-all"
    >
      {isEditMode ? <X className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
      <span className="font-medium">{isEditMode ? 'Exit Edit Mode' : 'Edit Website'}</span>
    </button>
  );
}