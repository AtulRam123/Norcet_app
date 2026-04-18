import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the NORCET prep shell', () => {
  render(<App />);
  expect(screen.getAllByText(/NORCET Prep/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Dashboard/i).length).toBeGreaterThan(0);
});
