/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Card, CardHeader, CardBody } from './Card';

describe('Card component', () => {
  it('renders structure', () => {
    const { asFragment, getByText } = render(
      <Card>
        <CardHeader title="Title" subtitle="Sub" extra={<button>Act</button>} />
        <CardBody>Content</CardBody>
      </Card>
    );
    expect(getByText('Title')).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
