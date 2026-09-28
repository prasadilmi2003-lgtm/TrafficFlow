import { useEffect, useState, type ReactNode } from 'react';
import { errorMessage } from '../../api/client';
import { Button } from './Button';
import { Alert } from './Layout';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in a sentence or two */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** danger for actions that close, remove or disable something */
  tone?: 'primary' | 'danger';
  /** Runs the action; the dialog closes when it succeeds and shows the error when it fails */
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

/** "Are you sure?" before an action that is hard to undo. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone} loading={busy} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <div className="text-sm text-slate-600">{children}</div>
    </Modal>
  );
}
