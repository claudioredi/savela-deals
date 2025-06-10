# Deal Queries Utilities

Este archivo centraliza toda la lógica de consultas de ofertas con filtros de fecha para evitar duplicación de código y facilitar el mantenimiento.

## Configuración

La duración de validez de las ofertas se controla desde dos constantes:

```typescript
export const DEAL_EXPIRY_WEEKS = 3;  // Cambiar aquí para modificar el período
export const DEAL_EXPIRY_DAYS = DEAL_EXPIRY_WEEKS * 7; // Se calcula automáticamente
```

**Para cambiar el período de validez de las ofertas**, simplemente modifica `DEAL_EXPIRY_WEEKS` y todos los componentes se actualizarán automáticamente.

## Funciones Disponibles

### `getRecentDealsDate()`
Retorna un objeto Date que representa la fecha límite para ofertas recientes.

### `getRecentDealsTimestamp()`
Retorna un Firestore Timestamp para usar en consultas.

### `createRecentDealsQuery(additionalConstraints?, orderByField?, orderDirection?, limitCount?)`
Crea una consulta básica para ofertas recientes.

**Parámetros:**
- `additionalConstraints`: Array de QueryConstraint adicionales (ej: `[where('category', '==', 'electronics')]`)
- `orderByField`: Campo para ordenar (default: 'createdAt')
- `orderDirection`: Dirección del orden (default: 'desc')
- `limitCount`: Número de documentos a limitar (opcional)

**Ejemplo:**
```typescript
// Consulta básica (ordenada por fecha, descendente)
const query = createRecentDealsQuery();

// Con filtro de categoría y límite
const query = createRecentDealsQuery(
  [where('category', '==', 'electronics')], 
  'createdAt', 
  'desc', 
  50
);
```

### `createPaginatedRecentDealsQuery(lastDoc, limitCount, additionalConstraints?)`
Crea una consulta paginada para ofertas recientes.

**Parámetros:**
- `lastDoc`: Último documento de la página anterior (para paginación)
- `limitCount`: Número de documentos por página
- `additionalConstraints`: Filtros adicionales (opcional)

**Ejemplo:**
```typescript
// Primera página
const query = createPaginatedRecentDealsQuery(null, 20);

// Páginas siguientes
const query = createPaginatedRecentDealsQuery(lastDocument, 20);
```

### `createRecentDealsCountQuery(additionalConstraints?)`
Crea una consulta para contar ofertas recientes.

**Ejemplo:**
```typescript
const countQuery = createRecentDealsCountQuery();
const snapshot = await getDocs(countQuery);
const totalCount = snapshot.size;
```

## Uso en Componentes

Todos los componentes principales ya usan estas utilidades:

- `FeaturedCarousel.tsx`
- `MostViewedCarousel.tsx` 
- `CategoryHighlights.tsx`
- `FeaturedStores.tsx`
- `page.tsx` (página principal)

## Ventajas

1. **Centralización**: Un solo lugar para cambiar el período de validez de ofertas
2. **Consistencia**: Todos los componentes usan la misma lógica
3. **Mantenibilidad**: Fácil de actualizar y debuggear
4. **Reutilización**: Funciones flexibles que se adaptan a diferentes casos de uso
5. **Tipado**: TypeScript garantiza el uso correcto de las funciones

## Migración

Si necesitas agregar un nuevo componente que consulte ofertas:

1. Importa las utilidades: `import { createRecentDealsQuery } from '@/utils/dealQueries'`
2. Usa la función apropiada en lugar de crear queries manualmente
3. Evita importar `collection`, `query`, `where`, `Timestamp` individualmente 