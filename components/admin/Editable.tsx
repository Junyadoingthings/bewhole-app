'use client';

import React, { useState } from 'react';
import { useAdminEdit } from '@/app/context/AdminEditContext';
import { updateSettingAction } from '@/app/actions/settings';

export function Editable({ 
  configKey, 
  fallback, 
  as: Component = 'span', 
  className = '' 
}: { 
  configKey: string; 
  fallback: string; 
  as?: any; 
  className?: string;
}) {
  const { isEditMode } = useAdminEdit();
  const [value, setValue] = useState(fallback);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isEditMode) {
    return <Component className={className}>{value}</Component>;
  }

  if (isEditing) {
    return (
      <input
        type="text"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={async () => {
          setIsEditing(false);
          setIsSaving(true);
          await updateSettingAction(configKey, value);
          setIsSaving(false);
        }}
        className={`border-2 border-green-500 bg-white text-black px-2 py-1 rounded w-full ${className}`}
      />
    );
  }

  return (
    <Component
      onClick={() => setIsEditing(true)}
      className={`cursor-pointer border-2 border-dashed border-green-400 hover:bg-green-50 px-1 rounded transition-colors ${className} ${isSaving ? 'opacity-50' : ''}`}
      title="Click to edit"
    >
      {value}
    </Component>
  );
}