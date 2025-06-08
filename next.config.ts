import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // MercadoLibre
      {
        protocol: 'https',
        hostname: 'http2.mlstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'images.mlstatic.com',
      },
      // Amazon
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'images-na.ssl-images-amazon.com',
      },
      // Garbarino
      {
        protocol: 'https',
        hostname: 'images.garbarino.com',
      },
      // Fravega
      {
        protocol: 'https',
        hostname: 'images.fravega.com',
      },
      // Musimundo
      {
        protocol: 'https',
        hostname: 'www.musimundo.com',
      },
      // Falabella
      {
        protocol: 'https',
        hostname: 'falabella.scene7.com',
      },
      // General domains
      {
        protocol: 'https',
        hostname: '**.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '**.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      // Common image hosting
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
      },
      // Contentful
      {
        protocol: 'https',
        hostname: '**.ctfassets.net',
      },
      // More common domains
      {
        protocol: 'https',
        hostname: '**.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.pexels.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
    ],
  },
};

export default nextConfig;
