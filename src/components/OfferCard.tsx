'use client';

import { Deal } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import SmartImage from './SmartImage';
import StoreIcon from './StoreIcon';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserInteractions } from '@/hooks/useUserInteractions';
import { useLoginPrompt } from '@/contexts/LoginPromptContext';

interface OfferCardProps {
  deal: Deal;
}

export default function OfferCard({ deal }: OfferCardProps) {
  const { user } = useAuth();
  const { showLoginPrompt } = useLoginPrompt();
  const { interaction, loading, vote, reportUnavailable } = useUserInteractions(user?.uid || null, deal.id);
  const [isVoting, setIsVoting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  
  // Local state for optimistic updates
  const [localDeal, setLocalDeal] = useState(deal);
  const [localInteraction, setLocalInteraction] = useState(interaction);

  // Update local states when props change
  useEffect(() => {
    setLocalDeal(deal);
  }, [deal]);

  useEffect(() => {
    setLocalInteraction(interaction);
  }, [interaction]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const timeAgo = formatDistanceToNow(deal.createdAt, { 
    addSuffix: true, 
    locale: es 
  });

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user) {
      showLoginPrompt('Para votar en las ofertas necesitas iniciar sesión');
      return;
    }
    
    if (isVoting) return;
    
    setIsVoting(true);
    
    // Calculate optimistic changes
    const currentVote = localInteraction?.vote;
    let upvoteChange = 0;
    let downvoteChange = 0;
    let newVote: 'up' | 'down' | undefined = voteType;

    if (currentVote === voteType) {
      // Removing vote
      if (voteType === 'up') upvoteChange = -1;
      else downvoteChange = -1;
      newVote = undefined;
    } else {
      // Adding or changing vote
      if (currentVote === 'up') upvoteChange = -1;
      if (currentVote === 'down') downvoteChange = -1;
      
      if (voteType === 'up') upvoteChange += 1;
      else downvoteChange += 1;
    }

    // Optimistic update - update UI immediately
    setLocalDeal(prev => ({
      ...prev,
      upvotes: Math.max(0, (prev.upvotes || 0) + upvoteChange),
      downvotes: Math.max(0, (prev.downvotes || 0) + downvoteChange),
    }));

    setLocalInteraction(prev => ({
      id: `${user.uid}_${deal.id}`,
      userId: user.uid,
      dealId: deal.id,
      vote: newVote,
      reportedUnavailable: prev?.reportedUnavailable || false,
      createdAt: prev?.createdAt || new Date(),
      updatedAt: new Date(),
    }));

    try {
      await vote(voteType);
    } catch (error) {
      console.error('Error voting:', error);
      // Revert optimistic update on error
      setLocalDeal(deal);
      setLocalInteraction(interaction);
    } finally {
      setIsVoting(false);
    }
  };

  const handleReportUnavailable = async () => {
    if (!user) {
      showLoginPrompt('Para reportar ofertas como no disponibles necesitas iniciar sesión');
      return;
    }
    
    if (isReporting || localInteraction?.reportedUnavailable) return;
    
    setIsReporting(true);
    
    // Optimistic update - update UI immediately
    setLocalDeal(prev => ({
      ...prev,
      unavailableReports: (prev.unavailableReports || 0) + 1,
    }));

    setLocalInteraction(prev => ({
      id: `${user.uid}_${deal.id}`,
      userId: user.uid,
      dealId: deal.id,
      vote: prev?.vote,
      reportedUnavailable: true,
      createdAt: prev?.createdAt || new Date(),
      updatedAt: new Date(),
    }));

    try {
      await reportUnavailable();
    } catch (error) {
      console.error('Error reporting:', error);
      // Revert optimistic update on error
      setLocalDeal(deal);
      setLocalInteraction(interaction);
    } finally {
      setIsReporting(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('svg') || target.closest('a')) {
      return;
    }
    // Navigate to deal detail page
    window.location.href = `/deal/${deal.id}`;
  };

  return (
    <div 
      className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      onClick={handleCardClick}
      title={`Ver detalles: ${deal.title}`}
    >
      {/* Image Section */}
      <div className="relative aspect-[3/2] bg-gray-100 overflow-hidden">
        {deal.imageUrl ? (
          <SmartImage
            src={deal.imageUrl}
            alt={deal.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <div className="text-center text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Sin imagen</p>
            </div>
          </div>
        )}
        
        {/* Discount Badge */}
        {deal.discountPercentage && (
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white shadow-lg">
              -{deal.discountPercentage}%
            </span>
          </div>
        )}

        {/* Category Badge */}
        <div className="absolute top-3 right-3">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-700 backdrop-blur-sm">
            {deal.category}
          </span>
        </div>

        {/* Store Icon */}
        {deal.store && (
          <div className="absolute bottom-3 left-3">
            <div 
              className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow-sm"
              title={deal.store.name}
            >
              <StoreIcon icon={deal.store.icon} name={deal.store.name} size="sm" />
            </div>
          </div>
        )}


      </div>

      {/* Content Section */}
      <div className="p-6">
        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {deal.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {deal.description}
        </p>

        {/* Price Section */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-bold text-gray-900">
              {formatPrice(deal.currentPrice)}
            </div>
            {deal.previousPrice && (
              <div className="text-sm text-gray-500 line-through">
                {formatPrice(deal.previousPrice)}
              </div>
            )}
          </div>
          <a
            href={deal.purchaseLink}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            Ver Oferta
          </a>
        </div>

        {/* Voting and Reporting Section */}
        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-4">
            {/* Upvote Button */}
            <button
              onClick={() => handleVote('up')}
              disabled={isVoting || loading}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-all ${
                localInteraction?.vote === 'up'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-white text-gray-600 hover:bg-green-50 hover:text-green-600'
              } ${(isVoting || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3v11z"/>
              </svg>
              <span>{localDeal.upvotes || 0}</span>
            </button>

            {/* Downvote Button */}
            <button
              onClick={() => handleVote('down')}
              disabled={isVoting || loading}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-all ${
                localInteraction?.vote === 'down'
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-600'
              } ${(isVoting || loading) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13v4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3V2h3z"/>
              </svg>
              <span>{localDeal.downvotes || 0}</span>
            </button>
          </div>

          {/* Report Unavailable Button */}
          <button
            onClick={handleReportUnavailable}
            disabled={isReporting || loading || localInteraction?.reportedUnavailable}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-all ${
              localInteraction?.reportedUnavailable
                ? 'bg-orange-100 text-orange-700'
                : 'bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600'
            } ${(isReporting || loading || localInteraction?.reportedUnavailable) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>No disponible</span>
            {localDeal.unavailableReports > 0 && (
              <span className="text-xs">({localDeal.unavailableReports})</span>
            )}
          </button>
        </div>

        {/* Footer with timestamp */}
        <div className="flex items-center pt-4 border-t border-gray-100">
          <div className="flex items-center text-xs text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{timeAgo}</span>
          </div>
        </div>


      </div>

    </div>
  );
} 