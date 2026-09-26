import { useState } from 'react';
import { Input } from '@/components/ui/input';

interface ListInputProps {
  id: string;
  value: string[] | undefined;
  onChange: (next: string[]) => void;
}

function splitList(text: string): string[] {
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

export function ListInput({ id, value, onChange }: ListInputProps) {
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
      autoComplete="off"
      spellCheck={false}
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
