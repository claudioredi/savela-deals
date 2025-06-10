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
 * Gets the Firestore Timestamp for filtering recent deals
 * @returns Firestore Timestamp for the recent deals cutoff
 */
export const getRecentDealsTimestamp = (): Timestamp => {
  return Timestamp.fromDate(getRecentDealsDate());
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