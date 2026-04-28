import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

interface StaggerProps {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  stagger?: number
  scale?: number
}

const ease = [0.22, 1, 0.36, 1] as const

export default function Stagger({
  children,
  className,
  delay = 0,
  duration = 0.4,
  stagger = 0.08,
  scale = 0.98,
}: StaggerProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? false : "hidden"}
      whileInView={shouldReduceMotion ? undefined : "show"}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      variants={{
        hidden: {},
        show: {
          transition: {
            delayChildren: delay,
            staggerChildren: stagger,
          },
        },
      }}
    >
      {Array.isArray(children)
        ? children.map((child, index) => (
            <motion.div
              key={index}
              variants={{
                hidden: { opacity: 0, scale },
                show: { opacity: 1, scale: 1 },
              }}
              transition={{ duration, ease }}
            >
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  )
}
