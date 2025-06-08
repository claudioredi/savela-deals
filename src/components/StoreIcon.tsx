import React from 'react';

interface StoreIconProps {
  icon: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function StoreIcon({ icon, name, size = 'md', className = '' }: StoreIconProps) {
  const isUrl = icon.startsWith('http');
  
  const sizeClasses = {
    sm: 'w-4 h-4 text-base',
    md: 'w-6 h-6 text-lg', 
    lg: 'w-8 h-8 text-2xl'
  };

  if (isUrl) {
    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <img
          src={icon}
          alt={`${name} icon`}
          className="w-full h-full object-contain rounded-sm"
          onError={(e) => {
            // Fallback to emoji if image fails to load
            const target = e.currentTarget as HTMLImageElement;
            const container = target.parentElement;
            if (container) {
              container.innerHTML = `<span class="${sizeClasses[size].split(' ')[2]}">🌐</span>`;
            }
          }}
        />
      </div>
    );
  }

  return (
    <span className={`${sizeClasses[size].split(' ')[2]} ${className}`}>
      {icon}
    </span>
  );
} 