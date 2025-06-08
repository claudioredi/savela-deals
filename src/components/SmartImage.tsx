'use client';

import Image from 'next/image';
import { useState, useMemo } from 'react';

interface SmartImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  width?: number;
  height?: number;
  onError?: () => void;
}

// Lista de dominios configurados en next.config.ts
const CONFIGURED_DOMAINS = [
  'http2.mlstatic.com',
  'images.mlstatic.com',
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'images.garbarino.com',
  'images.fravega.com',
  'www.musimundo.com',
  'falabella.scene7.com',
  'i.imgur.com',
  'cdn.shopify.com',
];

// Patrones de dominios (wildcards)
const CONFIGURED_PATTERNS = [
  /.*\.cloudfront\.net$/,
  /.*\.cloudinary\.com$/,
  /.*\.amazonaws\.com$/,
  /.*\.ctfassets\.net$/,
  /.*\.unsplash\.com$/,
  /.*\.pexels\.com$/,
  /.*\.googleusercontent\.com$/,
  /.*\.fbcdn\.net$/,
];

function isDomainConfigured(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Verificar dominios exactos
    if (CONFIGURED_DOMAINS.includes(hostname)) {
      return true;
    }
    
    // Verificar patrones (wildcards)
    return CONFIGURED_PATTERNS.some(pattern => pattern.test(hostname));
  } catch {
    return false;
  }
}

export default function SmartImage({ 
  src, 
  alt, 
  fill = false, 
  className = '', 
  width, 
  height,
  onError 
}: SmartImageProps) {
  const [hasError, setHasError] = useState(false);
  
  // Determinar si usar Next.js Image o img regular
  const shouldUseNextImage = useMemo(() => isDomainConfigured(src), [src]);

  const handleRegularImageError = () => {
    setHasError(true);
    onError?.();
  };

  // Si la imagen ha fallado completamente, mostrar placeholder
  if (hasError) {
    return (
      <div className={`bg-slate-200 flex items-center justify-center ${className}`} style={{ width, height }}>
        <div className="text-slate-400 text-center p-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">Imagen no disponible</p>
        </div>
      </div>
    );
  }

  // Usar Next.js Image si el dominio está configurado
  if (shouldUseNextImage) {
    return (
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={width}
        height={height}
        className={className}
        onError={handleRegularImageError}
      />
    );
  }

  // Fallback a img regular para dominios no configurados
  if (fill) {
    return (
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 w-full h-full object-cover ${className}`}
        onError={handleRegularImageError}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={handleRegularImageError}
    />
  );
} 