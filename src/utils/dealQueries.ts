import { query, collection, where, orderBy, limit, startAfter, Timestamp, QueryDocumentSnapshot, DocumentData, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Configurable constants
export const DEAL_EXPIRY_WEEKS = 3;
export const DEAL_EXPIRY_DAYS = DEAL_EXPIRY_WEEKS * 7; // 21 days

/**
 * Gets the date for filtering recent deals
 * @returns Date object representing the cutoff for recent deals
 */
export const getRecentDealsDate = (): Date => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DEAL_EXPIRY_DAYS);
  return cutoffDate;
};

/**
 * Gets the timestamp for filtering recent deals based on expiry settings
 * @returns Timestamp for deals created within the last DEAL_EXPIRY_WEEKS
 */
export const getRecentDealsTimestamp = (): Timestamp => {
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - (DEAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
  return Timestamp.fromDate(cutoffDate);
};

/**
 * Creates a basic query for recent deals with optional additional constraints
 * @param additionalConstraints - Additional where clauses to add to the query
 * @param orderByField - Field to order by (default: 'createdAt')
 * @param orderDirection - Order direction (default: 'desc')
 * @param limitCount - Number of documents to limit (optional)
 * @returns Firestore query for recent deals
 */
export const createRecentDealsQuery = (
  additionalConstraints: QueryConstraint[] = [],
  orderByField: string = 'createdAt',
  orderDirection: 'asc' | 'desc' = 'desc',
  limitCount?: number
) => {
  const constraints: QueryConstraint[] = [
    where('createdAt', '>=', getRecentDealsTimestamp()),
    ...additionalConstraints,
    orderBy(orderByField, orderDirection),
  ];

  if (limitCount) {
    constraints.push(limit(limitCount));
  }

  return query(collection(db, 'deals'), ...constraints);
};

/**
 * Creates a paginated query for recent deals
 * @param lastDoc - Last document from previous page (for pagination)
 * @param limitCount - Number of documents per page
 * @param additionalConstraints - Additional where clauses
 * @returns Firestore query for paginated recent deals
 */
export const createPaginatedRecentDealsQuery = (
  lastDoc: QueryDocumentSnapshot<DocumentData> | null,
  limitCount: number,
  additionalConstraints: QueryConstraint[] = []
) => {
  const constraints: QueryConstraint[] = [
    where('createdAt', '>=', getRecentDealsTimestamp()),
    ...additionalConstraints,
    orderBy('createdAt', 'desc'),
  ];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(limitCount));

  return query(collection(db, 'deals'), ...constraints);
};

/**
 * Creates a query for counting recent deals
 * @param additionalConstraints - Additional where clauses
 * @returns Firestore query for counting recent deals
 */
export const createRecentDealsCountQuery = (additionalConstraints: QueryConstraint[] = []) => {
  return query(
    collection(db, 'deals'),
    where('createdAt', '>=', getRecentDealsTimestamp()),
    ...additionalConstraints
  );
};

/**
 * Searches for deals in the database with text matching across multiple fields
 * @param searchTerm - The text to search for
 * @param lastDoc - Last document from previous page (for pagination)
 * @param limitCount - Number of documents per page
 * @returns Array of query constraints for searching deals
 */
export const createSearchQuery = (
  searchTerm: string,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  limitCount: number = 20
) => {
  const searchTermLower = searchTerm.toLowerCase();
  
  // Note: Firestore doesn't support full-text search natively, so we'll need to 
  // use a different approach. For now, we'll search by individual fields.
  // For better search, consider using Algolia or implementing search keywords.
  
  const constraints: QueryConstraint[] = [
    where('createdAt', '>=', getRecentDealsTimestamp()),
    // We'll fetch all recent deals and filter client-side for now
    // This is not optimal for large datasets, but works for initial implementation
    orderBy('createdAt', 'desc'),
  ];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(limitCount * 5)); // Fetch more to account for client-side filtering

  return query(collection(db, 'deals'), ...constraints);
};

/**
 * Creates a query for searching deals by title (partial match)
 * @param searchTerm - The text to search for in titles
 * @param lastDoc - Last document from previous page (for pagination)  
 * @param limitCount - Number of documents per page
 * @returns Firestore query for title search
 */
export const createTitleSearchQuery = (
  searchTerm: string,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  limitCount: number = 20
) => {
  const constraints: QueryConstraint[] = [
    where('createdAt', '>=', getRecentDealsTimestamp()),
    // For title search, we can use range queries for prefix matching
    where('title', '>=', searchTerm),
    where('title', '<=', searchTerm + '\uf8ff'),
    orderBy('title'),
    orderBy('createdAt', 'desc'),
  ];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(limitCount));

  return query(collection(db, 'deals'), ...constraints);
};

/**
 * Creates a query for searching deals by category
 * @param category - The category to search for
 * @param lastDoc - Last document from previous page (for pagination)
 * @param limitCount - Number of documents per page
 * @returns Firestore query for category search
 */
export const createCategorySearchQuery = (
  category: string,
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  limitCount: number = 20
) => {
  const constraints: QueryConstraint[] = [
    where('createdAt', '>=', getRecentDealsTimestamp()),
    where('category', '==', category),
    orderBy('createdAt', 'desc'),
  ];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(limitCount));

  return query(collection(db, 'deals'), ...constraints);
};

/**
 * Client-side filtering function for comprehensive search across all deal fields
 * @param deals - Array of deals to filter
 * @param searchTerm - The search term to match against
 * @returns Filtered array of deals
 */
export const filterDealsClientSide = (deals: any[], searchTerm: string): any[] => {
  if (!searchTerm.trim()) return deals;
  
  const searchLower = searchTerm.toLowerCase();
  
  return deals.filter(deal =>
    deal.title?.toLowerCase().includes(searchLower) ||
    deal.description?.toLowerCase().includes(searchLower) ||
    deal.category?.toLowerCase().includes(searchLower) ||
    deal.createdByName?.toLowerCase().includes(searchLower) ||
    (deal.store?.name && deal.store.name.toLowerCase().includes(searchLower))
  );
}; 