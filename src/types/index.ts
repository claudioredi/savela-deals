export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface Store {
  id: string;
  name: string;
  icon: string; // URL or path to store icon
  domain: string; // Used for matching URLs
  color: string; // Brand color for styling
}

export interface Deal {
  id: string;
  title: string;
  description: string;
  previousPrice?: number;
  currentPrice: number;
  discountPercentage?: number;
  category: string;
  purchaseLink: string;
  imageUrl?: string;
  createdAt: Date;
  createdBy: string; // User ID
  createdByName: string; // User's display name
  // Store information
  store: Store;
  // Voting system
  upvotes: number;
  downvotes: number;
  // Unavailable reports
  unavailableReports: number;
  // Views tracking
  views: number;
}

export interface UserInteraction {
  id: string;
  userId: string;
  dealId: string;
  vote?: 'up' | 'down'; // null if no vote
  reportedUnavailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type DealCategory = 
  | 'electrónicos'
  | 'moda'
  | 'hogar'
  | 'belleza'
  | 'deportes'
  | 'libros'
  | 'turismo'
  | 'juegos'
  | 'otros';

export const DEAL_CATEGORIES: Record<DealCategory, string> = {
  'electrónicos': 'Electrónicos',
  'moda': 'Moda y Accesorios',
  'hogar': 'Hogar y Jardín',
  'belleza': 'Belleza y Cuidado Personal',
  'deportes': 'Deportes y Fitness',
  'libros': 'Libros y Educación',
  'turismo': 'Turismo y Recreación',
  'juegos': 'Juegos y Juguetes',
  'otros': 'Otros'
}; 