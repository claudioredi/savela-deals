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
import { trackDealView } from '@/services/viewsService';

interface OfferCardProps {
  deal: Deal;
}

export default function OfferCard({ deal }: OfferCardProps) {
  const { user } = useAuth();
  const { showLoginPrompt } = useLoginPrompt();
  const { interaction, loading, vote, reportUnavailable, unreportUnavailable } = useUserInteractions(user?.uid || null, deal.id);
  const [isVoting, setIsVoting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  
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
    
    if (isReporting) return;

    // If already reported, unreport it
    if (localInteraction?.reportedUnavailable) {
      setIsReporting(true);
      
      // Optimistic update - update UI immediately
      setLocalDeal(prev => ({
        ...prev,
        unavailableReports: Math.max(0, (prev.unavailableReports || 0) - 1),
      }));

      setLocalInteraction(prev => ({
        id: `${user!.uid}_${deal.id}`,
        userId: user!.uid,
        dealId: deal.id,
        vote: prev?.vote,
        reportedUnavailable: false,
        createdAt: prev?.createdAt || new Date(),
        updatedAt: new Date(),
      }));

      try {
        await unreportUnavailable();
      } catch (error) {
        console.error('Error unreporting:', error);
        // Revert optimistic update on error
        setLocalDeal(deal);
        setLocalInteraction(interaction);
      } finally {
        setIsReporting(false);
      }
    } else {
      // Show confirmation for reporting
      setShowReportConfirm(true);
    }
  };

  const confirmReport = async () => {
    setShowReportConfirm(false);
    setIsReporting(true);
    
    // Optimistic update - update UI immediately
    setLocalDeal(prev => ({
      ...prev,
      unavailableReports: (prev.unavailableReports || 0) + 1,
    }));

    setLocalInteraction(prev => ({
      id: `${user!.uid}_${deal.id}`,
      userId: user!.uid,
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

  const handleViewOffer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Track the view
    try {
      await trackDealView(deal.id);
    } catch (error) {
      console.error('Error tracking view:', error);
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

  const hasMultipleReports = (localDeal.unavailableReports || 0) >= 3;

  return (
    <div 
      className={`group bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer ${
        hasMultipleReports 
          ? 'border-orange-300 hover:border-orange-400' 
          : 'border-gray-200 hover:border-blue-200'
      }`}
      onClick={handleCardClick}
      title={`Ver detalles: ${deal.title}`}
    >
      {/* Image Section */}
      <div className="relative aspect-[3/2] bg-white overflow-hidden">
        {deal.imageUrl ? (
          <SmartImage
            src={deal.imageUrl}
            alt={deal.title}
            fill
            className="object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white">
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

        {/* Unavailable Warning Badge */}
        {(localDeal.unavailableReports || 0) >= 3 && (
          <div className="absolute bottom-3 right-3">
            <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.866-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Varios reportes
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
            onClick={handleViewOffer}
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
            disabled={isReporting || loading}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-medium transition-all ${
              localInteraction?.reportedUnavailable
                ? 'bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200'
                : 'bg-white text-gray-600 hover:bg-orange-50 hover:text-orange-600 border border-transparent'
            } ${(isReporting || loading) ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
            title={localInteraction?.reportedUnavailable ? 'Click para revertir el reporte' : 'Reportar que el enlace no funciona'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {localInteraction?.reportedUnavailable ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              )}
            </svg>
            <span>{localInteraction?.reportedUnavailable ? 'Reportado' : 'Enlace roto'}</span>
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

      {/* Report Confirmation Modal */}
      {showReportConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowReportConfirm(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-orange-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.866-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900">Reportar enlace roto</h3>
            </div>
            <p className="text-gray-600 mb-6">
              ¿Estás seguro de que quieres reportar que esta oferta no está disponible o el enlace no funciona?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowReportConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReport}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
              >
                Sí, reportar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
} 