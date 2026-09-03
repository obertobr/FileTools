import { useState } from 'react';
import { SearchInput } from '@/ui/components/SearchInput';
import { CategoryFilter } from '@/ui/components/CategoryFilter';
import { ConverterGrid } from '@/ui/components/ConverterGrid';
import { CONVERTERS } from '@/lib/formats';

/**
 * ConverterCatalog — React island for the /converter catalog page.
 * Provides interactive search and category filtering over all converters.
 */
export function ConverterCatalog() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const q = query.toLowerCase().trim();
  const converters = CONVERTERS.filter(
    (c) =>
      (category === 'all' || c.category === category) &&
      (`${c.from} ${c.to} ${c.description}`.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-3">
      <div className="max-w-sm">
        <SearchInput value={query} onChange={setQuery} placeholder="Search converters…" />
      </div>
      <CategoryFilter value={category} onChange={setCategory} />
      <div className="pt-2">
        <ConverterGrid converters={converters} />
      </div>
    </div>
  );
}
