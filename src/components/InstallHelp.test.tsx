import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { InstallHelp } from './InstallHelp';

it('opens and closes explicit iPad installation instructions', async () => {
  const user = userEvent.setup();
  render(<InstallHelp />);
  await user.click(screen.getByRole('button', { name: 'Install on iPad' }));
  expect(screen.getByRole('dialog', { name: 'Add Route Review to the Home Screen' })).toBeVisible();
  expect(screen.getByText('Add to Home Screen')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Close install instructions' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
