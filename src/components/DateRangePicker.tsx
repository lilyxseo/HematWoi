import { useState } from 'react';
import dayjs from 'dayjs';
import Button from './Button';

interface Props {
  onChange?: (start: string, end: string) => void;
}

export default function DateRangePicker({ onChange }: Props) {
  const [start, setStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [end, setEnd] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));

  const apply = () => onChange?.(start, end);

  return (
    <div className="flex gap-2 items-end">
      <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="border p-1 rounded" />
      <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="border p-1 rounded" />
      <Button onClick={apply}>Apply</Button>
    </div>
  );
}
