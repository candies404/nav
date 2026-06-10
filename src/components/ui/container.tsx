interface ContainerProps {
  children: React.ReactNode
}

export function Container({ children }: ContainerProps) {
  return (
    <div className="mx-auto w-full max-w-screen-2xl px-2 sm:px-4 lg:px-8 xl:px-12">
      {children}
    </div>
  )
} 
