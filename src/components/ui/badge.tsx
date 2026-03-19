import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-blue-600 text-white shadow hover:bg-blue-500",
        secondary: "border-transparent bg-gray-700 text-gray-200 hover:bg-gray-600",
        destructive: "border-transparent bg-red-900/50 text-red-400 border-red-500/30",
        warning: "border-transparent bg-amber-900/50 text-amber-400 border-amber-500/30",
        info: "border-transparent bg-blue-900/50 text-blue-400 border-blue-500/30",
        success: "border-transparent bg-green-900/50 text-green-400 border-green-500/30",
        outline: "border-gray-700 text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
