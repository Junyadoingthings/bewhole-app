'use client';
import React, { createContext, useContext, useState } from 'react';

type AdminEditContextType = {
  isEditMode: boolean;
  toggleEditMode: () => void;
};

const AdminEditContext = createContext<AdminEditContextType>({
  isEditMode: false,
  toggleEditMode: () => {},
});

export const AdminEditProvider = ({ children }: { children: React.ReactNode }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  return (
    <AdminEditContext.Provider value={{ isEditMode, toggleEditMode: () => setIsEditMode(!isEditMode) }}>
      {children}
    </AdminEditContext.Provider>
  );
};

export const useAdminEdit = () => useContext(AdminEditContext);