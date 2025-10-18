import { Button } from '../ui/Button';

type QuantityPadProps = {
  onAdd: (qty: number) => void;
};

const increments = [1, 5, 10];

export const QuantityPad = ({ onAdd }: QuantityPadProps) => {
  return (
    <div className="grid grid-cols-3 gap-3">
      {increments.map((value) => (
        <Button key={value} type="button" onClick={() => onAdd(value)} variant="secondary">
          +{value}
        </Button>
      ))}
    </div>
  );
};
