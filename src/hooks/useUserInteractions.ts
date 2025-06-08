import { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  runTransaction,
  deleteField 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserInteraction } from '@/types';

export function useUserInteractions(userId: string | null, dealId: string) {
  const [interaction, setInteraction] = useState<UserInteraction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !dealId) {
      setLoading(false);
      return;
    }

    const fetchInteraction = async () => {
      try {
        const interactionRef = doc(db, 'userInteractions', `${userId}_${dealId}`);
        const interactionDoc = await getDoc(interactionRef);
        
        if (interactionDoc.exists()) {
          const data = interactionDoc.data();
          setInteraction({
            id: interactionDoc.id,
            userId: data.userId,
            dealId: data.dealId,
            vote: data.vote || undefined,
            reportedUnavailable: data.reportedUnavailable || false,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        } else {
          setInteraction(null);
        }
      } catch (error) {
        console.error('Error fetching user interaction:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInteraction();
  }, [userId, dealId]);

  const vote = async (voteType: 'up' | 'down') => {
    if (!userId) return;

    let newVote: 'up' | 'down' | null = voteType;

    try {
      await runTransaction(db, async (transaction) => {
        const interactionRef = doc(db, 'userInteractions', `${userId}_${dealId}`);
        const dealRef = doc(db, 'deals', dealId);
        
        const interactionDoc = await transaction.get(interactionRef);
        const dealDoc = await transaction.get(dealRef);
        
        if (!dealDoc.exists()) return;

        let currentVote = null;
        if (interactionDoc.exists()) {
          currentVote = interactionDoc.data()?.vote;
        }

        // Calculate vote changes
        let upvoteChange = 0;
        let downvoteChange = 0;

        if (currentVote === voteType) {
          // Removing vote
          if (voteType === 'up') upvoteChange = -1;
          else downvoteChange = -1;
          newVote = null;
        } else {
          // Adding or changing vote
          if (currentVote === 'up') upvoteChange = -1;
          if (currentVote === 'down') downvoteChange = -1;
          
          if (voteType === 'up') upvoteChange += 1;
          else downvoteChange += 1;
        }

        // Update deal vote counts
        const updates: any = {};
        if (upvoteChange !== 0) updates.upvotes = increment(upvoteChange);
        if (downvoteChange !== 0) updates.downvotes = increment(downvoteChange);
        
        if (Object.keys(updates).length > 0) {
          transaction.update(dealRef, updates);
        }

        // Update user interaction
        const interactionData: any = {
          userId,
          dealId,
          reportedUnavailable: interactionDoc.exists() ? interactionDoc.data()?.reportedUnavailable || false : false,
          updatedAt: new Date(),
          ...(interactionDoc.exists() ? {} : { createdAt: new Date() })
        };

        // Handle vote field - use deleteField() when removing vote, otherwise set the value
        if (newVote === null) {
          interactionData.vote = deleteField();
        } else {
          interactionData.vote = newVote;
        }

        if (interactionDoc.exists()) {
          transaction.update(interactionRef, interactionData);
        } else {
          transaction.set(interactionRef, interactionData);
        }
      });

      // Update local state
      setInteraction(prev => ({
        id: `${userId}_${dealId}`,
        userId,
        dealId,
        vote: newVote === null ? undefined : newVote,
        reportedUnavailable: prev?.reportedUnavailable || false,
        createdAt: prev?.createdAt || new Date(),
        updatedAt: new Date(),
      }));

    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const reportUnavailable = async () => {
    if (!userId) return;

    try {
      await runTransaction(db, async (transaction) => {
        const interactionRef = doc(db, 'userInteractions', `${userId}_${dealId}`);
        const dealRef = doc(db, 'deals', dealId);
        
        const interactionDoc = await transaction.get(interactionRef);
        const dealDoc = await transaction.get(dealRef);
        
        if (!dealDoc.exists()) return;

        const alreadyReported = interactionDoc.exists() ? 
          interactionDoc.data()?.reportedUnavailable || false : false;

        if (alreadyReported) return; // Already reported

        // Update deal unavailable count
        transaction.update(dealRef, {
          unavailableReports: increment(1)
        });

        // Update user interaction
        const interactionData: any = {
          userId,
          dealId,
          reportedUnavailable: true,
          updatedAt: new Date(),
          ...(interactionDoc.exists() ? {} : { createdAt: new Date() })
        };

        // Only include vote field if it exists and is not undefined
        const existingVote = interactionDoc.exists() ? interactionDoc.data()?.vote : undefined;
        if (existingVote !== undefined) {
          interactionData.vote = existingVote;
        }

        if (interactionDoc.exists()) {
          transaction.update(interactionRef, interactionData);
        } else {
          transaction.set(interactionRef, interactionData);
        }
      });

      // Update local state
      setInteraction(prev => ({
        id: `${userId}_${dealId}`,
        userId,
        dealId,
        vote: prev?.vote,
        reportedUnavailable: true,
        createdAt: prev?.createdAt || new Date(),
        updatedAt: new Date(),
      }));

    } catch (error) {
      console.error('Error reporting unavailable:', error);
    }
  };

  return {
    interaction,
    loading,
    vote,
    reportUnavailable,
  };
} 