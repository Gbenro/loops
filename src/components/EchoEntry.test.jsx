import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EchoEntry } from './EchoEntry.jsx';

afterEach(cleanup);

describe('Echo recording entrance', () => {
  it('requests recording only after an explicit action, and prevents duplicate starts while permission is pending', async () => {
    let finish;
    const onRecord = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    render(<EchoEntry onRecord={onRecord} onWrite={vi.fn()} />);
    expect(onRecord).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Begin speaking' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onRecord).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Write instead' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for microphone access.');
    await act(async () => { finish(); });
    expect(screen.getByRole('button', { name: 'Begin speaking' })).toBeEnabled();
  });

  it('keeps writing separate from microphone access', () => {
    const onRecord = vi.fn();
    const onWrite = vi.fn();
    render(<EchoEntry onRecord={onRecord} onWrite={onWrite} />);
    fireEvent.click(screen.getByRole('button', { name: 'Write instead' }));
    expect(onWrite).toHaveBeenCalledTimes(1);
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('allows retry after a recording startup failure', async () => {
    const onRecord = vi.fn().mockRejectedValueOnce(new Error('permission failure')).mockResolvedValueOnce();
    render(<EchoEntry onRecord={onRecord} onWrite={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Begin speaking' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Recording could not start');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Begin speaking' })); });
    expect(onRecord).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
