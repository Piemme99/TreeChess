import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { Modal, ConfirmModal } from './Modal';

/**
 * Renders a button that opens the Modal. The trigger button is what should
 * receive focus again after the modal closes.
 */
function ModalHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal
        isOpen={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="Test dialog"
        footer={<button>Footer action</button>}
      >
        <input aria-label="field" />
      </Modal>
    </div>
  );
}

describe('Modal – accessibility / focus management', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Provide an app root so the inert wiring has a target.
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  it('renders with dialog semantics and labels by its title', () => {
    render(<Modal isOpen onClose={() => {}} title="Hello">content</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Hello');
  });

  it('moves focus into the dialog on open', () => {
    render(<ModalHarness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    // Focus should now live inside the dialog, not on the trigger.
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(trigger);
  });

  it('restores focus to the previously focused element on close', () => {
    const onClose = vi.fn();
    render(<ModalHarness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} title="Esc">content</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus, cycling from the last element back to the first', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog');
    const focusables = within(dialog).getAllByRole('button');
    const closeBtn = within(dialog).getByRole('button', { name: 'Close' });
    const last = focusables[focusables.length - 1];

    // Park focus on the last focusable, then Tab should wrap to the first.
    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });

  it('traps Shift+Tab focus, cycling from the first element back to the last', () => {
    render(<ModalHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog');
    const focusables = within(dialog).getAllByRole('button');
    const closeBtn = within(dialog).getByRole('button', { name: 'Close' });
    const last = focusables[focusables.length - 1];

    closeBtn.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('marks the app root inert while open and clears it on close', () => {
    const root = document.getElementById('root')!;
    const { rerender } = render(<Modal isOpen onClose={() => {}} title="Inert">x</Modal>);
    expect(root.hasAttribute('inert')).toBe(true);

    rerender(<Modal isOpen={false} onClose={() => {}} title="Inert">x</Modal>);
    expect(root.hasAttribute('inert')).toBe(false);
  });
});

describe('ConfirmModal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
  });

  it('disables the confirm button when confirmDisabled is set', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Danger"
        message="Are you sure?"
        confirmText="Delete permanently"
        variant="danger"
        confirmDisabled
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Delete permanently' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('invokes onConfirm when enabled', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Danger"
        message="Are you sure?"
        confirmText="Delete permanently"
        variant="danger"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
