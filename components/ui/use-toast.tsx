import { useEffect, useState } from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

const TOAST_LIMIT = 10
const TOAST_REMOVE_DELAY = 1000000

export type ToastVariants = 'default' | 'destructive' | 'success' | 'warning'

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: ToastVariants
}

type ToastActionType = (props: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: ToastVariants
}) => string;

const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

let TOAST_FUNCTION: ToastActionType | null = null;

export const setToastFunction = (fn: ToastActionType) => {
  TOAST_FUNCTION = fn;
};

export const toast: ToastActionType = (props) => {
  if (TOAST_FUNCTION) {
    return TOAST_FUNCTION(props);
  } else {
    console.warn("Toast function not initialized yet");
    return "";
  }
};

export const useToast = () => {
  const [toasts, setToasts] = useState<ToasterToast[]>([])

  const toast: ToastActionType = (props) => {
    const id = genId()
    
    const newToast: ToasterToast = {
      id,
      ...props,
      variant: props.variant || "default",
    }
    
    setToasts((toasts) => [...toasts, newToast])
    
    return id
  }
  
  const dismiss = (toastId?: string) => {
    setToasts((toasts) => 
      toastId
        ? toasts.filter((t) => t.id !== toastId)
        : []
    )
  }

  useEffect(() => {
    setToastFunction(toast);
  }, [toast]);
  
  return {
    toast,
    toasts,
    dismiss,
  }
}

// 添加自定义hooks等实现代码... 

export type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

export type ToastActionElement = React.ReactElement<typeof ToastAction> 