/* @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Page } from './Page';
import ResponsiveGrid from './ResponsiveGrid';
import { Card, CardBody } from './Card';

describe('Page component', () => {
  it('renders layout', () => {
    const { asFragment, getByText } = render(
      <Page title="Demo" actions={<button>Action</button>}>
        <ResponsiveGrid>
          <Card>
            <CardBody>Item</CardBody>
          </Card>
        </ResponsiveGrid>
      </Page>
    );
    expect(getByText('Demo')).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
