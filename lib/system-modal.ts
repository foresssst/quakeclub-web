/**
 * Sistema de Modales Global
 * 
 * Este módulo permite reemplazar alert(), confirm() y prompt() nativos
 * con modales personalizados que siguen el diseño de la web.
 * 
 * USO:
 * - Importar y llamar: await systemConfirm('¿Estás seguro?')
 * - O usar el hook: const modal = useSystemModal(); await modal.confirm('...')
 */

type ModalType = "alert" | "confirm" | "prompt" | "success" | "warning" | "error"

interface ModalRequest {
  id: string
  type: ModalType
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  placeholder?: string
  defaultValue?: string
  resolve: (value: boolean | string | null) => void
}

// Store global para el estado del modal
class ModalStore {
  private listeners: Set<(modal: ModalRequest | null) => void> = new Set()
  private currentModal: ModalRequest | null = null
  private idCounter = 0

  subscribe(listener: (modal: ModalRequest | null) => void) {
    this.listeners.add(listener)
    // Enviar estado actual al nuevo listener
    listener(this.currentModal)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.currentModal))
  }

  show(config: Omit<ModalRequest, 'id' | 'resolve'>): Promise<boolean | string | null> {
    return new Promise((resolve) => {
      this.currentModal = {
        ...config,
        id: `modal-${++this.idCounter}`,
        resolve,
      }
      this.notify()
    })
  }

  close(value: boolean | string | null) {
    if (this.currentModal) {
      this.currentModal.resolve(value)
      this.currentModal = null
      this.notify()
    }
  }

  getCurrent() {
    return this.currentModal
  }
}

// Instancia global del store
export const modalStore = new ModalStore()

// Funciones helper para uso directo (sin hooks)
export async function systemAlert(message: string, title?: string): Promise<boolean> {
  return modalStore.show({ type: "alert", message, title }) as Promise<boolean>
}

export async function systemConfirm(message: string, title?: string): Promise<boolean> {
  return modalStore.show({ type: "confirm", message, title }) as Promise<boolean>
}

export async function systemPrompt(message: string, defaultValue?: string, title?: string): Promise<string | null> {
  return modalStore.show({ type: "prompt", message, title, defaultValue }) as Promise<string | null>
}

export async function systemSuccess(message: string, title?: string): Promise<boolean> {
  return modalStore.show({ type: "success", message, title }) as Promise<boolean>
}

export async function systemWarning(message: string, title?: string): Promise<boolean> {
  return modalStore.show({ type: "warning", message, title }) as Promise<boolean>
}

export async function systemError(message: string, title?: string): Promise<boolean> {
  return modalStore.show({ type: "error", message, title }) as Promise<boolean>
}
