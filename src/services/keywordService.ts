interface HuggingFaceResult {
  labels: string[];
  scores: number[];
}

/**
 * Genera keywords para una oferta usando Hugging Face API desde el cliente
 */
export async function generateKeywordsForDeal(
  title: string,
  description: string = '',
  category: string = ''
): Promise<string[]> {
  const apiKey = process.env.NEXT_PUBLIC_HUGGINGFACE_API_KEY;
  
  if (!apiKey) {
    console.warn('Hugging Face API key not configured, using fallback keywords');
    return generateFallbackKeywords(`${title} ${description} ${category}`);
  }

  try {
    const text = `${title} ${description} ${category}`;
    
    // Usar zero-shot classification para categorizar el texto
    const categories = [
      'television', 'smartphone', 'laptop', 'auriculares', 'zapatillas', 
      'remera', 'jeans', 'libros', 'juegos', 'deportes', 'hogar', 'belleza',
      'electronica', 'moda', 'tecnologia', 'entretenimiento', 'fitness'
    ];

    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/bart-large-mnli",
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          inputs: text,
          parameters: {
            candidate_labels: categories
          }
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Hugging Face API error: ${response.status}`);
    }

    const result = await response.json() as HuggingFaceResult;
    
    // Extraer categorías relevantes
    const relevantCategories = result.labels
      .filter((_, index: number) => result.scores[index] > 0.2)
      .slice(0, 5);
    
    // Combinar con keywords extraídas del texto
    const textKeywords = extractKeywordsFromText(text);
    const synonyms = getSynonyms(text);
    
    const allKeywords = [
      ...relevantCategories,
      ...textKeywords,
      ...synonyms
    ];
    
    // Remover duplicados y limitar a 15 keywords
    return [...new Set(allKeywords)].slice(0, 15);
    
  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    return generateFallbackKeywords(`${title} ${description} ${category}`);
  }
}

function extractKeywordsFromText(text: string): string[] {
  // Extraer palabras clave del texto
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remover caracteres especiales
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !isStopWord(word) &&
      !isNumber(word)
    )
    .slice(0, 8);
  
  return words;
}

function getSynonyms(text: string): string[] {
  const synonymMap: Record<string, string[]> = {
    'tv': ['television', 'televisor', 'pantalla'],
    'celular': ['smartphone', 'telefono', 'movil'],
    'pc': ['computadora', 'ordenador', 'computador'],
    'laptop': ['notebook', 'portatil', 'computadora portatil'],
    'auriculares': ['audifonos', 'headphones', 'cascos'],
    'zapatillas': ['tenis', 'sneakers', 'calzado deportivo'],
    'remera': ['camiseta', 'polo', 'camisa'],
    'jeans': ['pantalon', 'vaqueros', 'denim'],
    'smartphone': ['celular', 'telefono', 'movil'],
    'television': ['tv', 'televisor', 'pantalla'],
    'computadora': ['pc', 'ordenador', 'computador'],
    'notebook': ['laptop', 'portatil'],
    'audifonos': ['auriculares', 'headphones'],
    'tenis': ['zapatillas', 'sneakers'],
    'camiseta': ['remera', 'polo'],
    'pantalon': ['jeans', 'vaqueros'],
    'libro': ['libros', 'lectura'],
    'juego': ['juegos', 'videojuego'],
    'ropa': ['vestimenta', 'indumentaria'],
    'calzado': ['zapatos', 'zapatillas'],
    'accesorios': ['complementos', 'adornos'],
    'deportes': ['fitness', 'ejercicio'],
    'hogar': ['casa', 'vivienda'],
    'belleza': ['cosmeticos', 'cuidado personal'],
    'electronica': ['tecnologia', 'gadgets'],
    'moda': ['ropa', 'vestimenta'],
    'tecnologia': ['electronica', 'gadgets'],
    'entretenimiento': ['diversion', 'ocio'],
    'fitness': ['deportes', 'ejercicio']
  };
  
  const synonyms: string[] = [];
  const textLower = text.toLowerCase();
  
  Object.entries(synonymMap).forEach(([key, values]) => {
    if (textLower.includes(key)) {
      synonyms.push(...values);
    }
  });
  
  return synonyms;
}

function isStopWord(word: string): boolean {
  const stopWords = [
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'y', 'o', 'pero', 'si', 'no', 'que', 'cual', 'quien',
    'donde', 'cuando', 'como', 'por', 'para', 'con', 'sin',
    'sobre', 'entre', 'desde', 'hasta', 'durante', 'antes',
    'despues', 'mientras', 'aunque', 'porque', 'pues', 'entonces',
    'tambien', 'tampoco', 'nunca', 'siempre', 'a veces', 'mucho',
    'poco', 'mas', 'menos', 'muy', 'demasiado', 'bien', 'mal',
    'bueno', 'malo', 'grande', 'pequeno', 'nuevo', 'viejo',
    'mejor', 'peor', 'primero', 'ultimo', 'solo', 'sola',
    'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
    'aquel', 'aquella', 'aquellos', 'aquellas', 'mi', 'tu', 'su',
    'nuestro', 'vuestro', 'sus', 'mis', 'tus', 'yo', 'tu', 'el',
    'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'me', 'te',
    'lo', 'la', 'nos', 'os', 'los', 'las', 'se', 'le', 'les'
  ];
  
  return stopWords.includes(word);
}

function isNumber(word: string): boolean {
  return /^\d+$/.test(word);
}

function generateFallbackKeywords(text: string): string[] {
  // Fallback cuando no hay API key o falla la API
  const keywords = extractKeywordsFromText(text);
  const synonyms = getSynonyms(text);
  
  return [...new Set([...keywords, ...synonyms])].slice(0, 10);
} 