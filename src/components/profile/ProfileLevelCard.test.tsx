/* @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../AvatarLevel.jsx', () => ({
  default: () => <div>Level 5 - 10/20 XP</div>,
}));

import ProfileLevelCard from './ProfileLevelCard';

describe('ProfileLevelCard', () => {
  it('renders mocked level and xp', () => {
    render(<ProfileLevelCard />);
    expect(screen.getByText(/Level 5/)).toBeInTheDocument();
    expect(screen.getByText(/10\/20 XP/)).toBeInTheDocument();
  });
});
