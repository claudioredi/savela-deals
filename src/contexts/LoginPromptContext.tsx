'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import LoginPrompt from '@/components/LoginPrompt';

interface LoginPromptContextType {
  showLoginPrompt: (message: string) => void;
  hideLoginPrompt: () => void;
}

const LoginPromptContext = createContext<LoginPromptContextType | undefined>(undefined);

interface LoginPromptProviderProps {
  children: ReactNode;
}

export function LoginPromptProvider({ children }: LoginPromptProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const showLoginPrompt = (promptMessage: string) => {
    setMessage(promptMessage);
    setIsOpen(true);
  };

  const hideLoginPrompt = () => {
    setIsOpen(false);
    setMessage('');
  };

  return (
    <LoginPromptContext.Provider value={{ showLoginPrompt, hideLoginPrompt }}>
      {children}
      
      {/* Single global LoginPrompt */}
      <LoginPrompt 
        isOpen={isOpen}
        onClose={hideLoginPrompt}
        message={message}
      />
    </LoginPromptContext.Provider>
  );
}

export function useLoginPrompt() {
  const context = useContext(LoginPromptContext);
  if (context === undefined) {
    throw new Error('useLoginPrompt must be used within a LoginPromptProvider');
  }
  return context;
} 