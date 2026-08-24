import { tableFeatures } from '@tanstack/react-table'

// Sorting, filtering, and pagination all live in the URL (nuqs) and are
// applied server-side in the query layer — the table itself never needs
// those features registered, just the core row/cell model. Column
// definitions elsewhere must be built with `createColumnHelper<typeof
// tableFeaturesConfig, TData>()` so their feature type matches this
// instance exactly.
export const tableFeaturesConfig = tableFeatures({})
