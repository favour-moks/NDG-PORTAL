import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-800 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
            <Image src="/logo.jpeg" alt="Niger Delta Games" width={36} height={36} priority className="h-full w-full object-contain" />
          </span>
          <span className="text-lg font-semibold text-white">NDG Payment Portal</span>
        </div>
        <div className="rounded-xl bg-surface-raised p-8 shadow-xl [&_main]:!max-w-none [&_main]:!p-0 [&_h1]:!text-xl [&_form]:!max-w-none">
          {children}
        </div>
      </div>
    </div>
  )
}
