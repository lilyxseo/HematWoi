/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import ProfileBadgesCard from './ProfileBadgesCard';

describe('ProfileBadgesCard', () => {
  it('renders empty state', () => {
    render(<ProfileBadgesCard badges={[]} />);
    expect(screen.getByText(/No badges/i)).toBeInTheDocument();
  });

  it('renders badges', () => {
    const badges = [{ id: '1', name: 'Starter', description: 'first' }];
    render(<ProfileBadgesCard badges={badges} />);
    expect(screen.getByText('Starter')).toBeInTheDocument();
  });
});
