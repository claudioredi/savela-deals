import { Store } from '@/types';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Seed stores with well-known information (used as defaults when creating new stores)
const STORE_SEEDS: Record<string, Partial<Store>> = {
  'mercadolibre.com.ar': {
    name: 'Mercado Libre Argentina',
    icon: '🛒',
    color: '#FFE600'
  },
  'mercadolibre.com': {
    name: 'Mercado Libre',
    icon: '🛒',
    color: '#FFE600'
  },
  'amazon.com': {
    name: 'Amazon US',
    icon: '📦',
    color: '#FF9900'
  },
  'amazon.es': {
    name: 'Amazon España',
    icon: '📦',
    color: '#FF9900'
  },
  'amazon.co.uk': {
    name: 'Amazon UK',
    icon: '📦',
    color: '#FF9900'
  },
  'amazon.de': {
    name: 'Amazon Alemania',
    icon: '📦',
    color: '#FF9900'
  },
  'amazon.fr': {
    name: 'Amazon Francia',
    icon: '📦',
    color: '#FF9900'
  },
  'amazon.it': {
    name: 'Amazon Italia',
    icon: '📦',
    color: '#FF9900'
  },
  'tiendamia.com': {
    name: 'Tiendamia',
    icon: '🛍️',
    color: '#E91E63'
  },
  'linio.com': {
    name: 'Linio',
    icon: '🏪',
    color: '#FF6B35'
  },
  'falabella.com.ar': {
    name: 'Falabella Argentina',
    icon: '🏬',
    color: '#008C45'
  },
  'falabella.com': {
    name: 'Falabella',
    icon: '🏬',
    color: '#008C45'
  },
  'ripley.com.ar': {
    name: 'Ripley Argentina',
    icon: '🏢',
    color: '#D32F2F'
  },
  'ripley.cl': {
    name: 'Ripley Chile',
    icon: '🏢',
    color: '#D32F2F'
  },
  'paris.cl': {
    name: 'Paris Chile',
    icon: '🎀',
    color: '#E91E63'
  },
  'sodimac.com': {
    name: 'Sodimac',
    icon: '🔨',
    color: '#FF5722'
  },
  'easy.com': {
    name: 'Easy',
    icon: '🏠',
    color: '#4CAF50'
  },
  'pcfactory.cl': {
    name: 'PC Factory',
    icon: '💻',
    color: '#2196F3'
  },
  'spdigital.cl': {
    name: 'SP Digital',
    icon: '📱',
    color: '#9C27B0'
  },
  'lapolar.cl': {
    name: 'La Polar',
    icon: '🐻',
    color: '#1976D2'
  },
  'walmart.com': {
    name: 'Walmart US',
    icon: '🏪',
    color: '#0071CE'
  },
  'bestbuy.com': {
    name: 'Best Buy',
    icon: '⚡',
    color: '#FFD100'
  }
};

/**
 * Extracts and normalizes domain from URL to the main domain
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.toLowerCase();
    
    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    // Normalize to main domain (remove subdomains for known stores)
    domain = normalizeToMainDomain(domain);
    
    return domain;
  } catch (error) {
    return '';
  }
}

/**
 * Normalizes domain to main domain by removing subdomains
 * Examples: 
 * - autos.mercadolibre.com.ar → mercadolibre.com.ar
 * - shop.tiendamia.com → tiendamia.com
 * - www.amazon.com → amazon.com
 */
function normalizeToMainDomain(domain: string): string {
  // Split domain into parts
  const parts = domain.split('.');
  
  // If domain has 3+ parts, try to extract main domain
  if (parts.length >= 3) {
    // For domains like "subdomain.store.com.ar" → "store.com.ar"
    if (parts.length >= 4) {
      // Keep last 3 parts for country domains (e.g., .com.ar)
      const lastThree = parts.slice(-3).join('.');
      const secondToLast = parts.slice(-2).join('.');
      
      // Check if it's a country domain pattern (.com.ar, .co.uk, etc.)
      if (parts[parts.length - 1].length === 2 && parts[parts.length - 2].length === 2) {
        return lastThree;
      } else if (parts[parts.length - 1].length === 2 && parts[parts.length - 2].length === 3) {
        return lastThree;
      } else {
        return secondToLast;
      }
    }
    // For domains like "subdomain.store.com" → "store.com"
    else if (parts.length === 3) {
      // Check if last part is a common TLD
      const tld = parts[parts.length - 1];
      const commonTlds = ['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz'];
      
      if (commonTlds.includes(tld)) {
        // Keep last 2 parts
        return parts.slice(-2).join('.');
      }
      // For country domains like .cl, .ar, etc., keep all 3 parts
      else if (tld.length === 2) {
        return domain;
      }
    }
  }
  
  // Return original domain if no normalization needed
  return domain;
}

/**
 * Creates a user-friendly name from scraped data or domain (fallback)
 */
function createNameFromData(domain: string, scrapedData?: any): string {
  // First try to get name from scraped data
  if (scrapedData) {
    // Try publisher field first (often contains the clean site name)
    if (scrapedData.publisher && scrapedData.publisher !== domain) {
      return cleanStoreName(scrapedData.publisher);
    }
    
    // Try title field if it seems to be the site name
    if (scrapedData.title) {
      const title = scrapedData.title.toLowerCase();
      const cleanTitle = scrapedData.title;
      
      // If title contains common site indicators, use it
      if (title.includes('amazon') || title.includes('mercado') || title.includes('ebay') || 
          title.includes('tienda') || title.includes('shop') || title.includes('store') ||
          cleanTitle.split(' ').length <= 3) { // Short titles are often site names
        return cleanStoreName(cleanTitle);
      }
    }
  }
  
  // Fallback: Extract from domain
  return createNameFromDomain(domain);
}

/**
 * Cleans and formats a store name from scraped data
 */
function cleanStoreName(name: string): string {
  // Remove common suffixes and prefixes
  let cleaned = name
    .replace(/\s*-\s*(Tienda|Shop|Store|Online|Oficial|Official).*$/i, '')
    .replace(/^(Tienda|Shop|Store)\s*/i, '')
    .replace(/\s*\|\s*.*$/, '') // Remove everything after |
    .replace(/\s*·\s*.*$/, '') // Remove everything after ·
    .replace(/\s*\.\s*.*$/, '') // Remove everything after first period
    .trim();
  
  // Capitalize properly
  return cleaned.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Creates a basic name from domain (fallback only)
 */
function createNameFromDomain(domain: string): string {
  // Extract the main part of the domain
  let name = domain;
  
  // Remove common TLD patterns
  name = name.replace(/\.(com|net|org|edu|gov|mil|int|info|biz|name|pro|museum|coop|aero|jobs|mobi|travel|xxx|post|tel|asia|cat|local|localhost)(\.[a-z]{2,3})?$/, '');
  name = name.replace(/\.(ar|cl|mx|br|co|pe|ec|py|uy|bo|ve|gq|gt|ni|pa|sv|hn|cr|do|cu|jm|ht|bs|bb|ag|dm|gd|kn|lc|vc|tt|sr|gy|fk|us|ca|uk|de|fr|it|es|pt|nl|be|ch|at|se|no|dk|fi|ie|pl|cz|hu|ro|bg|hr|si|sk|ee|lv|lt|mt|cy|lu|mc|ad|sm|va|li|is|fo|gi|im|je|gg|ax|sj|bv|hm|tf|aq|gs)$/, '');
  
  // Split by dots and get the main domain part
  const parts = name.split('.');
  const mainPart = parts[0];
  
  // Capitalize first letter
  return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
}

/**
 * Generates a random color for new stores
 */
function generateRandomColor(): string {
  const colors = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6366F1', // Indigo
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Attempts to get favicon from a website
 */
async function getFaviconUrl(domain: string): Promise<string | null> {
  try {
    // Use Google's favicon service as it's more reliable and handles CORS properly
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    console.error('Error getting favicon:', error);
    return null;
  }
}

/**
 * Creates a store object for a new domain
 */
function createStoreForDomain(domain: string, favicon?: string, scrapedData?: any): Store {
  const seedData = STORE_SEEDS[domain] || {};
  
  return {
    id: domain,
    name: seedData.name || createNameFromData(domain, scrapedData),
    icon: favicon || seedData.icon || '🌐',
    domain: domain,
    color: seedData.color || generateRandomColor()
  };
}

/**
 * Gets store from Firestore by domain
 */
async function getStoreFromDatabase(domain: string): Promise<Store | null> {
  try {
    const storeDoc = await getDoc(doc(db, 'stores', domain));
    if (storeDoc.exists()) {
      const data = storeDoc.data();
      return {
        id: storeDoc.id,
        name: data.name,
        icon: data.icon,
        domain: data.domain,
        color: data.color
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching store from database:', error);
    return null;
  }
}

/**
 * Saves a new store to Firestore
 */
async function saveStoreToDatabase(store: Store): Promise<void> {
  try {
    await setDoc(doc(db, 'stores', store.id), {
      name: store.name,
      icon: store.icon,
      domain: store.domain,
      color: store.color,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error saving store to database:', error);
    throw error;
  }
}

/**
 * Main function: Normalizes store information based on URL
 * This function will:
 * 1. Extract domain from URL
 * 2. Check if store exists in database
 * 3. If not, create new store with favicon and save to database
 * 4. Return store information
 */
export async function normalizeStore(purchaseLink: string, scrapedData?: any): Promise<Store> {
  const domain = extractDomain(purchaseLink);
  
  if (!domain) {
    // Return default store for invalid URLs
    return {
      id: 'unknown',
      name: 'Sitio Web',
      icon: '🌐',
      domain: '',
      color: '#9E9E9E'
    };
  }
  
  // First, try to get store from database
  let store = await getStoreFromDatabase(domain);
  
  if (!store) {
    // Store doesn't exist, create a new one
    let favicon: string | null = null;
    
    // Try to get favicon from scraped data first
    if (scrapedData?.logo?.url) {
      favicon = scrapedData.logo.url;
    } else {
      // Try to get favicon from the domain
      favicon = await getFaviconUrl(domain);
    }
    
    store = createStoreForDomain(domain, favicon || undefined, scrapedData);
    
    // Save to database for future use
    try {
      await saveStoreToDatabase(store);
      console.log(`Created new store: ${store.name} (${store.domain}) with ${favicon ? 'favicon' : 'emoji'}`);
    } catch (error) {
      console.error('Failed to save new store, using temporary store:', error);
    }
  }
  
  return store;
}

/**
 * Gets all stores from the database
 */
export async function getAllStores(): Promise<Store[]> {
  try {
    const storesSnapshot = await getDocs(collection(db, 'stores'));
    const stores: Store[] = [];
    
    storesSnapshot.forEach((doc) => {
      const data = doc.data();
      stores.push({
        id: doc.id,
        name: data.name,
        icon: data.icon,
        domain: data.domain,
        color: data.color
      });
    });
    
    return stores.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching all stores:', error);
    return [];
  }
}

/**
 * Gets store by domain
 */
export async function getStoreByDomain(domain: string): Promise<Store | null> {
  return await getStoreFromDatabase(domain);
}

/**
 * Updates an existing store (for admin purposes)
 */
export async function updateStore(store: Store): Promise<void> {
  try {
    await setDoc(doc(db, 'stores', store.id), {
      name: store.name,
      icon: store.icon,
      domain: store.domain,
      color: store.color,
      updatedAt: new Date()
    }, { merge: true });
  } catch (error) {
    console.error('Error updating store:', error);
    throw error;
  }
}

/**
 * Migration function to update existing store names with country suffixes
 * Run this once to fix existing stores in the database
 */
export async function migrateStoreNames(): Promise<void> {
  try {
    console.log('Starting store name migration...');
    
    const stores = await getAllStores();
    let updatedCount = 0;

    for (const store of stores) {
      const seedData = STORE_SEEDS[store.domain];
      if (seedData && seedData.name && seedData.name !== store.name) {
        console.log(`Updating ${store.name} → ${seedData.name}`);
        await updateStore({
          ...store,
          name: seedData.name
        });
        updatedCount++;
      }
    }

    console.log(`Migration complete! Updated ${updatedCount} stores.`);
  } catch (error) {
    console.error('Error during store migration:', error);
    throw error;
  }
}

/**
 * Synchronous version that returns default info (for immediate UI updates)
 * Should be followed by the async normalizeStore for database persistence
 */
export function normalizeStoreSync(purchaseLink: string, favicon?: string): Store {
  const domain = extractDomain(purchaseLink);
  
  if (!domain) {
    return {
      id: 'unknown',
      name: 'Sitio Web',
      icon: '🌐',
      domain: '',
      color: '#9E9E9E'
    };
  }
  
  return createStoreForDomain(domain, favicon);
} 