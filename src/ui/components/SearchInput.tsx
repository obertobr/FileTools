import { Search } from 'lucide-react';
import { Input } from '@/ui/components/core';

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      leftIcon={<Search className="size-3.5" strokeWidth={1.75} />}
    />
  );
}
