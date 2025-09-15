/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import GoalList from './GoalList';

const noop = () => {};

describe('GoalList component', () => {
  it('renders empty state', () => {
    render(<GoalList goals={[]} onAdd={noop} onUpdate={noop} onDelete={noop} onQuickAdd={noop} />);
    expect(screen.getByText(/Belum ada goal/i)).toBeInTheDocument();
  });

  it('renders goal cards when data exists', () => {
    const goals = [{ id: '1', name: 'Tabungan', target: 1000, saved: 100 }];
    render(<GoalList goals={goals} onAdd={noop} onUpdate={noop} onDelete={noop} onQuickAdd={noop} />);
    expect(screen.getByText('Tabungan')).toBeInTheDocument();
  });
});
