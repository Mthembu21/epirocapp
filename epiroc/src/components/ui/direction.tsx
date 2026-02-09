"use client"

import * as React from "react"

type Direction = "ltr" | "rtl"

const DirectionContext = React.createContext<Direction | undefined>(undefined)

export function DirectionProvider({
  children,
  dir = "ltr",
}: {
  children: React.ReactNode
  dir?: Direction
}) {
  return (
    <DirectionContext.Provider value={dir}>{children}</DirectionContext.Provider>
  )
}

export function useDirection() {
  const context = React.useContext(DirectionContext)
  if (context === undefined) {
    throw new Error("useDirection must be used within a DirectionProvider")
  }
  return context
}
