'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User, DEAL_CATEGORIES, DealCategory, Store } from '@/types';
import { normalizeStore, normalizeStoreSync, getAllStores } from '@/services/storeService';
import Header from '@/components/Header';
import SmartImage from '@/components/SmartImage';
import StoreIcon from '@/components/StoreIcon';



export default function PostPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastScrapedUrl, setLastScrapedUrl] = useState('');
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [previousPrice, setPreviousPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [discountPercentage, setDiscountPercentage] = useState('');
  const [category, setCategory] = useState<DealCategory>('otros');
  const [imageUrl, setImageUrl] = useState('');
  const [store, setStore] = useState<Store | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          photoURL: firebaseUser.photoURL || undefined,
        });
      } else {
        setUser(null);
        router.push('/login');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Validate URL function
  const isValidUrl = (string: string): boolean => {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  // Auto-scrape function
  const autoScrapeUrl = async (urlToScrape: string) => {
    if (!urlToScrape.trim() || !isValidUrl(urlToScrape) || urlToScrape === lastScrapedUrl) {
      return;
    }
    
    setScraping(true);
    setLastScrapedUrl(urlToScrape);
    
    // Auto-detect store from URL (immediate UI update with sync version)
    const tempStore = normalizeStoreSync(urlToScrape);
    setStore(tempStore);
    
    // Then get/create the proper store in database
    normalizeStore(urlToScrape).then(actualStore => {
      setStore(actualStore);
    }).catch(error => {
      console.error('Error normalizing store:', error);
      // Keep the temp store if database operation fails
    });
    
    try {
      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(urlToScrape)}`);
      const data = await response.json();
      
      if (data.status === 'success') {
        // Pre-fill form fields directly
        if (data.data.title) setTitle(data.data.title);
        if (data.data.description) setDescription(data.data.description);
        if (data.data.image?.url) setImageUrl(data.data.image.url);
        
        const extractedPrice = data.data.price || extractPriceFromText(data.data.title + ' ' + data.data.description);
        if (extractedPrice) {
          // Parse the price using our improved function
          const parsedPrice = parsePrice(extractedPrice);
          if (parsedPrice > 0) {
            setCurrentPrice(parsedPrice.toString());
          }
        }
        
        // Try to guess category based on title/description
        const guessedCategory = guessCategory(data.data.title + ' ' + data.data.description);
        setCategory(guessedCategory);
        
        // Update store with favicon if available
        if (data.data.logo?.url) {
          const storeWithFavicon = normalizeStoreSync(urlToScrape, data.data.logo.url);
          setStore(storeWithFavicon);
          
          // Also update the database version
          normalizeStore(urlToScrape, data.data).then(actualStore => {
            setStore(actualStore);
          }).catch(error => {
            console.error('Error normalizing store with favicon:', error);
          });
        }
      }
    } catch (error) {
      console.error('Error scraping URL:', error);
      // Silent error for auto-scraping, don't show alert
    } finally {
      setScraping(false);
    }
  };

  // Debouncer effect for manual typing
  useEffect(() => {
    if (!url.trim()) {
      setLastScrapedUrl('');
      return;
    }

    const timeoutId = setTimeout(() => {
      autoScrapeUrl(url);
    }, 2000); // 2 seconds debounce

    return () => clearTimeout(timeoutId);
  }, [url]);

  // Handle paste event for immediate scraping
  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && isValidUrl(pastedText)) {
      // Small delay to let the input update
      setTimeout(() => {
        autoScrapeUrl(pastedText);
      }, 100);
    }
  };

  const extractPriceFromText = (text: string): string | undefined => {
    // More comprehensive regex for different price formats
    const priceRegex = /\$\s*[\d.,]+|\$[\d.,]+|(?:USD|ARS|€|£)\s*[\d.,]+|[\d.,]+\s*(?:USD|ARS|€|£)|(?:precio|price|valor).*?[\d.,]+/gi;
    const matches = text.match(priceRegex);
    return matches ? matches[0] : undefined;
  };

  // New function to normalize price strings to numbers
  const parsePrice = (priceString: string): number => {
    if (!priceString) return 0;
    
    // Remove currency symbols and words
    let cleanPrice = priceString
      .replace(/[\$€£]/g, '')
      .replace(/\b(USD|ARS|precio|price|valor)\b/gi, '')
      .trim();
    
    // Count dots and commas to determine format
    const dotCount = (cleanPrice.match(/\./g) || []).length;
    const commaCount = (cleanPrice.match(/,/g) || []).length;
    
    // Argentine format: 8.000,50 (dot for thousands, comma for decimals)
    // US format: 8,000.50 (comma for thousands, dot for decimals)
    
    if (dotCount > 1) {
      // Multiple dots = thousands separators only (like 1.234.567)
      cleanPrice = cleanPrice.replace(/\./g, '');
    } else if (commaCount > 1) {
      // Multiple commas = thousands separators only (like 1,234,567)
      cleanPrice = cleanPrice.replace(/,/g, '');
    } else if (dotCount === 1 && commaCount === 1) {
      // Both present - determine which is decimal based on position
      const dotPos = cleanPrice.lastIndexOf('.');
      const commaPos = cleanPrice.lastIndexOf(',');
      
      if (dotPos > commaPos) {
        // Format: 1,234.50 (US format)
        cleanPrice = cleanPrice.replace(/,/g, '');
      } else {
        // Format: 1.234,50 (Argentine format)
        cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
      }
    } else if (dotCount === 1) {
      // Only one dot - could be thousands or decimal
      const parts = cleanPrice.split('.');
      if (parts[1] && parts[1].length <= 2) {
        // Likely decimal (e.g., 123.50)
        // Keep as is
      } else if (parts[1] && parts[1].length === 3) {
        // Likely thousands separator (e.g., 8.000)
        cleanPrice = cleanPrice.replace('.', '');
      }
    } else if (commaCount === 1) {
      // Only one comma - treat as decimal separator (Argentine format)
      cleanPrice = cleanPrice.replace(',', '.');
    }
    
    // Remove any remaining non-digit characters except dots
    cleanPrice = cleanPrice.replace(/[^\d.]/g, '');
    
    const parsed = parseFloat(cleanPrice);
    return isNaN(parsed) ? 0 : parsed;
  };

  const guessCategory = (text: string): DealCategory => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('celular') || lowerText.includes('smartphone') || lowerText.includes('laptop') || lowerText.includes('tablet')) {
      return 'electrónicos';
    }
    if (lowerText.includes('ropa') || lowerText.includes('zapatos') || lowerText.includes('vestido')) {
      return 'moda';
    }
    if (lowerText.includes('casa') || lowerText.includes('cocina') || lowerText.includes('mueble')) {
      return 'hogar';
    }
    if (lowerText.includes('belleza') || lowerText.includes('perfume') || lowerText.includes('crema')) {
      return 'belleza';
    }
    if (lowerText.includes('deporte') || lowerText.includes('fitness') || lowerText.includes('gym')) {
      return 'deportes';
    }
    if (lowerText.includes('libro') || lowerText.includes('curso') || lowerText.includes('educación')) {
      return 'libros';
    }
    
    return 'otros';
  };

  // Calculate discount percentage automatically
  const calculateDiscountPercentage = (prev: string, current: string): string => {
    const prevPrice = parsePrice(prev);
    const currPrice = parsePrice(current);
    
    if (prevPrice && currPrice && prevPrice > currPrice) {
      const discount = Math.round(((prevPrice - currPrice) / prevPrice) * 100);
      return discount.toString();
    }
    return '';
  };

  // Update discount when prices change
  useEffect(() => {
    if (previousPrice && currentPrice) {
      const calculatedDiscount = calculateDiscountPercentage(previousPrice, currentPrice);
      setDiscountPercentage(calculatedDiscount);
    } else if (!previousPrice) {
      // If no previous price, allow manual discount entry
      setDiscountPercentage('');
    }
  }, [previousPrice, currentPrice]);

  // Check if discount should be editable
  const isDiscountEditable = !previousPrice || !currentPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    try {
      // Ensure we have store information
      const finalStore = store || await normalizeStore(url);
      
      const dealData: any = {
        title: title.trim(),
        description: description.trim(),
        currentPrice: parsePrice(currentPrice),
        category,
        purchaseLink: url,
        imageUrl: imageUrl.trim() || null,
        store: finalStore,
        createdAt: serverTimestamp(),
        createdBy: user.id,
        createdByName: user.displayName || user.email,
        upvotes: 0,
        downvotes: 0,
        unavailableReports: 0,
      };

      // Add optional fields only if they have values
      if (previousPrice && parsePrice(previousPrice) > 0) {
        dealData.previousPrice = parsePrice(previousPrice);
      }
      
      if (discountPercentage && parsePrice(discountPercentage) > 0) {
        dealData.discountPercentage = parsePrice(discountPercentage);
      }

      await addDoc(collection(db, 'deals'), dealData);

      alert('¡Oferta publicada exitosamente!');
      router.push('/');
    } catch (error) {
      console.error('Error saving deal:', error);
      alert('Error al guardar la oferta. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
            {/* Page Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                  Publicar Nueva Oferta
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                  Comparte una oferta increíble con la comunidad. Solo necesitas la URL del producto.
                </p>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                  {/* URL Input Section */}
                  <div className="space-y-4">
                    <label htmlFor="url" className="block text-sm font-semibold text-gray-900">
                      URL del Producto <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <input
                        type="url"
                        id="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://mercadolibre.com.ar/producto-ejemplo"
                        className="w-full pl-10 pr-12 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                        disabled={scraping}
                        onPaste={handleUrlPaste}
                        required
                      />
                      {scraping && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-sm">
                      {scraping ? (
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                          <div className="animate-pulse">🔄</div>
                          <span className="font-medium">Obteniendo datos del producto...</span>
                        </div>
                      ) : url && isValidUrl(url) ? (
                        <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
                          <span>✅</span>
                          <span>URL válida - Los datos se cargarán automáticamente</span>
                        </div>
                      ) : url && !isValidUrl(url) ? (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
                          <span>⚠️</span>
                          <span>Por favor ingresa una URL válida (debe comenzar con http:// o https://)</span>
                        </div>
                      ) : (
                        <div className="text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                          💡 <strong>Tip:</strong> Pega una URL y los datos se cargarán automáticamente, o escríbela manualmente
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Form Fields Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-6">
                      {/* Title */}
                      <div>
                        <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
                          Título del Producto <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="title"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Ej: iPhone 15 Pro Max 256GB"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                          required
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label htmlFor="description" className="block text-sm font-semibold text-gray-900 mb-2">
                          Descripción
                        </label>
                        <textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe brevemente el producto o la oferta..."
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500 resize-none"
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label htmlFor="category" className="block text-sm font-semibold text-gray-900 mb-2">
                          Categoría <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="category"
                          value={category}
                          onChange={(e) => setCategory(e.target.value as DealCategory)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 bg-white"
                          required
                        >
                          {Object.entries(DEAL_CATEGORIES).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Store Detection */}
                      {store && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Tienda Detectada
                          </label>
                          <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl">
                            <div className="flex items-center gap-3">
                              <StoreIcon icon={store.icon} name={store.name} size="lg" />
                              <div>
                                <div className="font-medium text-gray-900">{store.name}</div>
                                <div className="text-sm text-gray-500">{store.domain}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                      {/* Previous Price */}
                      <div>
                        <label htmlFor="previousPrice" className="block text-sm font-semibold text-gray-900 mb-2">
                          Precio Anterior (Opcional)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-lg">$</span>
                          </div>
                          <input
                            type="number"
                            id="previousPrice"
                            value={previousPrice}
                            onChange={(e) => setPreviousPrice(e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                          />
                        </div>
                      </div>

                      {/* Current Price */}
                      <div>
                        <label htmlFor="currentPrice" className="block text-sm font-semibold text-gray-900 mb-2">
                          Precio Actual <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-lg">$</span>
                          </div>
                          <input
                            type="number"
                            id="currentPrice"
                            value={currentPrice}
                            onChange={(e) => setCurrentPrice(e.target.value)}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                            required
                          />
                        </div>
                      </div>

                      {/* Discount Percentage */}
                      {discountPercentage && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Descuento Calculado
                          </label>
                          <div className="px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                            <div className="flex items-center gap-2">
                              <span className="text-green-600 font-bold text-lg">
                                {discountPercentage}% de descuento
                              </span>
                              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Image URL */}
                      <div>
                        <label htmlFor="imageUrl" className="block text-sm font-semibold text-gray-900 mb-2">
                          URL de la Imagen
                        </label>
                        <input
                          type="url"
                          id="imageUrl"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          placeholder="https://ejemplo.com/imagen.jpg"
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                        />
                        {imageUrl && (
                          <div className="mt-3">
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200">
                              <SmartImage
                                src={imageUrl}
                                alt="Preview"
                                fill
                                className="object-cover"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-6 border-t border-gray-200">
                    <button
                      type="submit"
                      disabled={submitting || !title || !currentPrice || !url}
                      className="w-full flex justify-center items-center px-8 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          Publicando oferta...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Publicar Oferta
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
    </div>
  );
} 