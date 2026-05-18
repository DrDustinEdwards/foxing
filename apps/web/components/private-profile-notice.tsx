interface PrivateProfileNoticeProps {
  username: string
}

export function PrivateProfileNotice({ username }: PrivateProfileNoticeProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="text-center">
        <h1 className="font-fraunces text-2xl text-text-primary">
          @{username}
        </h1>
        <p className="mt-2 font-source-serif-4 text-base text-text-tertiary">
          This profile is private.
        </p>
      </div>
    </div>
  )
}
