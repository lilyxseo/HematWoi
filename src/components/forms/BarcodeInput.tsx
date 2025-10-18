/* eslint-disable jsx-a11y/no-autofocus */
import { forwardRef, InputHTMLAttributes, useEffect, useImperativeHandle, useRef } from 'react';
import { Input } from '../ui/Input';

type BarcodeInputProps = InputHTMLAttributes<HTMLInputElement> & {
  onEnter?: () => void;
};

export const BarcodeInput = forwardRef<HTMLInputElement, BarcodeInputProps>(
  ({ onEnter, autoFocus = true, ...props }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, []);

    useEffect(() => {
      if (!autoFocus) return;
      const node = innerRef.current;
      if (node && typeof node.focus === 'function') {
        const focusTimer = setTimeout(() => {
          node.focus();
          node.select();
        }, 10);
        return () => clearTimeout(focusTimer);
      }
      return undefined;
    }, [autoFocus]);

    return (
      <Input
        ref={innerRef}
        autoFocus={autoFocus}
        inputMode="search"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter?.();
          }
        }}
        {...props}
      />
    );
  }
);

BarcodeInput.displayName = 'BarcodeInput';
