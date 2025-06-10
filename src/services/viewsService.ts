import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const trackDealView = async (dealId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'deals', dealId), {
      views: increment(1)
    });
    console.log('View tracked for deal:', dealId);
  } catch (error) {
    console.error('Error tracking view for deal:', dealId, error);
    // Don't throw error to avoid disrupting user experience
  }
}; 