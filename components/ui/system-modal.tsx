"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { modalStore, systemAlert, systemConfirm, systemPrompt, systemSuccess, systemWarning, systemError } from "@/lib/system-modal"

// Re-exportar las funciones para uso con hooks
export { systemAlert, systemConfirm, systemPrompt, systemSuccess, systemWarning, systemError }

// Hook para usar en componentes (alternativa a las funciones globales)
export function useSystemModal() {
  return {
    alert: systemAlert,
    confirm: systemConfirm,
    prompt: systemPrompt,
    success: systemSuccess,
    warning: systemWarning,
    error: systemError,
  }
}

// Tipos
type ModalType = "alert" | "confirm" | "prompt" | "success" | "warning" | "error"

interface ModalState {
  id: string
  type: ModalType
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  placeholder?: string
  defaultValue?: string
}

// Componente del Modal
function ModalContent({ state, onClose }: { state: ModalState; onClose: (value: boolean | string | null) => void }) {
  const [inputValue, setInputValue] = useState(state.defaultValue || "")

  const getTitle = () => {
    if (state.title) return state.title
    switch (state.type) {
      case "success": return "Éxito"
      case "warning": return "Advertencia"
      case "error": return "Error"
      case "confirm": return "Confirmar"
      case "prompt": return "Ingresa un valor"
      default: return "Aviso"
    }
  }

  const getTitleColor = () => {
    switch (state.type) {
      case "success": return "text-green-600"
      case "warning": return "text-yellow-600"
      case "error": return "text-red-500"
      default: return "text-foreground"
    }
  }

  const getButtonStyle = () => {
    switch (state.type) {
      case "error":
        return "border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 hover:border-red-500/50"
      case "warning":
        return "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 hover:border-yellow-500/50"
      case "success":
        return "border-green-500/30 bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:border-green-500/50"
      default:
        return "border-foreground/30 bg-foreground/10 text-foreground hover:bg-foreground/20 hover:border-foreground/50"
    }
  }

  const handleConfirm = () => {
    if (state.type === "prompt") {
      onClose(inputValue)
    } else {
      onClose(true)
    }
  }

  const handleCancel = () => {
    if (state.type === "prompt") {
      onClose(null)
    } else {
      onClose(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === "Escape") {
      handleCancel()
    }
  }

  const showCancelButton = state.type === "confirm" || state.type === "prompt"

  // Formatear mensaje con saltos de línea
  const formattedMessage = state.message.split('\n').map((line, i) => (
    <span key={i}>
      {line}
      {i < state.message.split('\n').length - 1 && <br />}
    </span>
  ))

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[var(--qc-bg-pure)]/70 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={handleCancel}
      />
      
      {/* Modal - Usando el mismo estilo que ContentContainer */}
      <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in slide-in-from-bottom-2 duration-200">
        <div className="glass-card-elevated rounded-xl overflow-hidden shadow-xl">
          
          {/* Header - Igual que ContentHeader */}
          <div className="border-b border-foreground/[0.06] bg-[var(--qc-bg-pure)] px-5 py-4 flex items-center justify-between">
            <h3 className={`font-tiktok text-sm font-bold uppercase tracking-wider ${getTitleColor()}`}>
              {getTitle()}
            </h3>
            <button
              onClick={handleCancel}
              className="text-foreground/30 transition-colors hover:text-foreground/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Content */}
          <div className="px-5 py-5">
            <p className="text-sm text-foreground/70 leading-relaxed">
              {formattedMessage}
            </p>
            
            {state.type === "prompt" && (
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={state.placeholder || "Escribe aquí..."}
                autoFocus
                className="mt-4 w-full rounded-lg border border-foreground/[0.06] bg-foreground/[0.04] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/50 focus:outline-none transition-colors"
              />
            )}
          </div>
          
          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-foreground/[0.06] bg-[#cacad0] px-5 py-4">
            {showCancelButton && (
              <button
                onClick={handleCancel}
                className="rounded-lg border border-foreground/[0.06] bg-black/5 px-5 py-2 text-xs font-medium uppercase tracking-wider text-foreground/50 transition-all hover:border-black/20 hover:bg-black/10 hover:text-foreground/70"
              >
                {state.cancelText || "Cancelar"}
              </button>
            )}
            <button
              onClick={handleConfirm}
              autoFocus={state.type !== "prompt"}
              className={`rounded-lg border px-5 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${getButtonStyle()}`}
            >
              {state.confirmText || "Aceptar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Provider que renderiza el modal
export function SystemModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<ModalState | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Suscribirse al store
    const unsubscribe = modalStore.subscribe((modal) => {
      setModalState(modal ? {
        id: modal.id,
        type: modal.type,
        title: modal.title,
        message: modal.message,
        confirmText: modal.confirmText,
        cancelText: modal.cancelText,
        placeholder: modal.placeholder,
        defaultValue: modal.defaultValue,
      } : null)
    })

    // Sobrescribir métodos globales del window
    if (typeof window !== 'undefined') {
      const originalAlert = window.alert
      const originalConfirm = window.confirm
      const originalPrompt = window.prompt

      // Sobrescribir alert
      ;(window as any).alert = (message: string) => {
        systemAlert(String(message))
      }

      // Sobrescribir confirm
      ;(window as any).confirm = (message: string) => {
        systemConfirm(String(message))
        return true
      }

      // Sobrescribir prompt
      ;(window as any).prompt = (message: string, defaultValue?: string) => {
        systemPrompt(String(message), defaultValue)
        return defaultValue || ''
      }

      return () => {
        unsubscribe()
        window.alert = originalAlert
        window.confirm = originalConfirm
        window.prompt = originalPrompt
      }
    }

    return unsubscribe
  }, [])

  const handleClose = useCallback((value: boolean | string | null) => {
    modalStore.close(value)
  }, [])

  return (
    <>
      {children}
      {mounted && modalState && createPortal(
        <ModalContent state={modalState} onClose={handleClose} />,
        document.body
      )}
    </>
  )
}
