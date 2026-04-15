'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'success' | 'info';
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  variant = 'info',
  loading = false,
}: ConfirmDialogProps) {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <AlertTriangle className="h-6 w-6 text-foreground" />;
      case 'success':
        return <CheckCircle2 className="h-6 w-6 text-foreground" />;
      case 'info':
        return <Info className="h-6 w-6 text-foreground" />;
    }
  };

  const getConfirmButtonClass = () => {
    switch (variant) {
      case 'danger':
        return 'bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30';
      case 'success':
        return 'bg-foreground hover:bg-foreground/80 text-white';
      case 'info':
        return 'bg-foreground hover:bg-foreground/80 text-white';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-foreground/[0.08]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {getIcon()}
            <DialogTitle className="font-tiktok text-foreground">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-foreground/70 pt-2">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-foreground/[0.06] text-foreground hover:bg-black/5"
          >
            {cancelText}
          </Button>
          <Button onClick={onConfirm} disabled={loading} className={getConfirmButtonClass()}>
            {loading ? 'Procesando...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
