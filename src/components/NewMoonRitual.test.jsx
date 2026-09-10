import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NewMoonRitual } from './NewMoonRitual.jsx';

describe('NewMoonRitual', () => {
  const defaultLunarData = {
    age: 28.5, // Pre-conjunction New Moon threshold
    phase: { key: 'new', name: 'New Moon' },
    lunarMonth: 'Harvest',
    dayOfCycle: 1,
    remainingHours: 24,
  };

  const defaultProps = {
    lunarData: defaultLunarData,
    onSetIntention: vi.fn(),
    onDismiss: vi.fn(),
    newMoonQuestion: 'What wants to be born through me this cycle?',
    phrasesLoading: false,
    hemisphere: 'north',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with moon glyph, month name, and prompt question', () => {
    render(<NewMoonRitual {...defaultProps} />);
    expect(screen.getByText(/NEW MOON ·/i)).toBeInTheDocument();
    expect(screen.getByText('What wants to be born through me this cycle?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /set intention/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close new moon ritual/i })).toBeInTheDocument();
  });

  it('calculates a future dismiss date when clicking NOT NOW during pre-conjunction threshold', () => {
    const beforeTime = Date.now();
    render(<NewMoonRitual {...defaultProps} />);
    const notNowBtn = screen.getByRole('button', { name: /not now/i });
    fireEvent.click(notNowBtn);

    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
    const dismissedUntil = defaultProps.onDismiss.mock.calls[0][0];
    expect(dismissedUntil).toBeInstanceOf(Date);
    // Dismissed date MUST be strictly in the future (never past/negative)
    expect(dismissedUntil.getTime()).toBeGreaterThan(beforeTime);
  });

  it('dismisses when clicking the top-right close [✕] button', () => {
    render(<NewMoonRitual {...defaultProps} />);
    const closeBtn = screen.getByRole('button', { name: /close new moon ritual/i });
    fireEvent.click(closeBtn);

    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
    const dismissedUntil = defaultProps.onDismiss.mock.calls[0][0];
    expect(dismissedUntil.getTime()).toBeGreaterThan(Date.now() - 1000);
  });

  it('dismisses when pressing the Escape key', () => {
    render(<NewMoonRitual {...defaultProps} />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses when clicking outside on the backdrop overlay', () => {
    render(<NewMoonRitual {...defaultProps} />);
    const dialogBackdrop = screen.getByRole('dialog');
    fireEvent.click(dialogBackdrop);

    expect(defaultProps.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onSetIntention when submitting intention text', () => {
    render(<NewMoonRitual {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Cultivate deep presence and peace' } });

    const submitBtn = screen.getByRole('button', { name: /set intention/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(defaultProps.onSetIntention).toHaveBeenCalledWith('Cultivate deep presence and peace');
  });

  it('disables submit button when intention is empty or whitespace', () => {
    render(<NewMoonRitual {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    const submitBtn = screen.getByRole('button', { name: /set intention/i });

    expect(submitBtn).toBeDisabled();
    fireEvent.change(textarea, { target: { value: '   ' } });
    expect(submitBtn).toBeDisabled();
  });
});
