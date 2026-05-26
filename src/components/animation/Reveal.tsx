import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  y?: number
}

const ease = [0.22, 1, 0.36, 1] as const

export default function Reveal({
  children,
  className,
  delay = 0,
  duration = 0.45,
}: RevealProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={false}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration, delay, ease }}
    >
      {children}
    </motion.div>
  )
}
