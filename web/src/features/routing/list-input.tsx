import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface ListInputProps {
  id?: string;
  value: string[] | undefined;
  onChange: (next: string[]) => void;
  className?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function ListInput({ id, value, onChange, className, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedby }: ListInputProps) {
  const joined = (value ?? []).join(', ');
  const [text, setText] = useState(joined);
  const [shownJoined, setShownJoined] = useState(joined);
  if (joined !== shownJoined) {
    setShownJoined(joined);
    setText(joined);
  }
  return (
    <Input
      id={id}
      data-mono
      autoComplete="off"
      spellCheck={false}
      className={className}
      aria-invalid={ariaInvalid}
      aria-describedby={ariaDescribedby}
      value={text}
      onChange={(event) => {
        const next = splitList(event.target.value);
        setText(event.target.value);
        setShownJoined(next.join(', '));
        onChange(next);
      }}
    />
  );
}
