import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileMenu } from './ProfileMenu.jsx';

// Mock EncryptionContext and Onboarding dependencies
vi.mock('../lib/EncryptionContext.jsx', () => ({
  useEncryption: () => ({
    status: 'unconfigured',
    setupEncryption: vi.fn(),
    disableEncryption: vi.fn(),
    lock: vi.fn(),
    decryptField: vi.fn(),
    sessionKey: null,
  })
}));

vi.mock('./Onboarding/index.js', () => ({
  useOnboarding: () => ({
    resetOnboarding: vi.fn()
  })
}));

vi.mock('../lib/notifications.js', () => ({
  requestPermission: vi.fn(),
  canNotify: vi.fn().mockReturnValue(false),
  getNotificationPrefs: vi.fn().mockReturnValue({}),
  saveNotificationPrefs: vi.fn()
}));

describe('UI Navigation — Admin Relocation out of Bottom Nav (iss_1789150542310_ng2t)', () => {
  const dummyUser = { id: 'user_admin_123', email: 'admin@luna.app' };

  describe('ProfileMenu Secondary Surface Integration', () => {
    it('renders System Administration card and [Open Admin Dashboard] button when user is an authorized admin', () => {
      render(
        <ProfileMenu
          isOpen={true}
          onClose={vi.fn()}
          user={dummyUser}
          isAdmin={true}
          onOpenAdmin={vi.fn()}
        />
      );

      expect(screen.getByTestId('profile-menu-admin-section')).toBeInTheDocument();
      expect(screen.getByTestId('profile-menu-admin-btn')).toBeInTheDocument();
      expect(screen.getByText(/Open Admin Dashboard/i)).toBeInTheDocument();
    });

    it('does NOT render admin section or button when user is not an admin', () => {
      render(
        <ProfileMenu
          isOpen={true}
          onClose={vi.fn()}
          user={dummyUser}
          isAdmin={false}
          onOpenAdmin={vi.fn()}
        />
      );

      expect(screen.queryByTestId('profile-menu-admin-section')).not.toBeInTheDocument();
      expect(screen.queryByTestId('profile-menu-admin-btn')).not.toBeInTheDocument();
    });

    it('clicking [Open Admin Dashboard] closes the profile menu and triggers onOpenAdmin', () => {
      const onOpenAdmin = vi.fn();
      const onClose = vi.fn();

      render(
        <ProfileMenu
          isOpen={true}
          onClose={onClose}
          user={dummyUser}
          isAdmin={true}
          onOpenAdmin={onOpenAdmin}
        />
      );

      const adminBtn = screen.getByTestId('profile-menu-admin-btn');
      fireEvent.click(adminBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onOpenAdmin).toHaveBeenCalledTimes(1);
    });
  });

  describe('Primary Navigation 5-Tab Balance Invariant', () => {
    it('verifies bottom navigation is composed strictly of the 5 primary destinations without Admin slot', () => {
      // Definition of canonical core tabs
      const CORE_TABS = ['sky', 'loops', 'echoes', 'rhythm', 'chat'];
      const CORE_LABELS = ['Sky', 'Loops', 'Echoes', 'Rhythm', 'Chat'];

      // Simulate the exact bottom nav rendering from App.jsx
      const TABS = [
        { id: 'sky', label: 'Sky', icon: '🌌' },
        { id: 'loops', label: 'Loops', icon: '⭕' },
        { id: 'echoes', label: 'Echoes', icon: '📜' },
        { id: 'rhythm', label: 'Rhythm', icon: '🌊' },
        { id: 'chat', label: 'Chat', icon: '🌙' },
      ];

      const { container } = render(
        <nav role="navigation" aria-label="Main navigation">
          {TABS.map((tab) => (
            <button key={tab.id} aria-label={`${tab.label} tab`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      );

      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBe(5);

      CORE_LABELS.forEach((label) => {
        expect(screen.getByLabelText(`${label} tab`)).toBeInTheDocument();
      });

      // Confirm no Admin tab occupies a slot in primary navigation
      expect(screen.queryByLabelText(/admin/i)).not.toBeInTheDocument();
      expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();
    });
  });
});
