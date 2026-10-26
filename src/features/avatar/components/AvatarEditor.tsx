import { Camera, Trash2 } from 'lucide-react'
import type { ChangeEvent } from 'react'
import { useRef } from 'react'

import { FeatureGate } from '@/features/feature-flags/FeatureGate'
import { strings } from '@/shared/i18n'

import { useAvatarUpload } from '../useAvatarUpload'
import { Avatar } from './Avatar'
import type { AvatarSize } from './Avatar'
import { AvatarCropper } from './AvatarCropper'

interface AvatarEditorProps {
  userId: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  avatarVersion?: number
  size?: AvatarSize
}

/**
 * Photo de profil avec recadrage (LOT F1, §1) : composant autonome (bouton photo +
 * input fichier masqué + modale de recadrage) posé à côté de n'importe quel <Avatar/>,
 * utilisé pour l'instant dans Réglages > Compte.
 */
export function AvatarEditor({
  userId,
  username,
  displayName,
  avatarUrl,
  avatarVersion,
  size = 'lg',
}: AvatarEditorProps) {
  const s = strings.avatar
  const inputRef = useRef<HTMLInputElement>(null)
  const { step, bitmap, error, selectFile, cancelCrop, confirmCrop, removeAvatar } =
    useAvatarUpload()

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void selectFile(file)
  }

  const handleRemove = () => {
    if (window.confirm(s.removeConfirm)) void removeAvatar()
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar
        userId={userId}
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        avatarVersion={avatarVersion}
        size={size}
      />
      <div className="flex flex-col gap-1.5">
        <FeatureGate flag="avatar_upload">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl border border-[var(--panel-line)] px-3 text-xs font-medium text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)]"
          >
            <Camera size={14} strokeWidth={1.75} aria-hidden="true" />
            {s.uploadLabel}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </FeatureGate>
        {avatarUrl ? (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-[#E5484D] transition-opacity duration-200 hover:opacity-80"
          >
            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            {s.removeLabel}
          </button>
        ) : null}
      </div>

      {(step === 'cropping' || step === 'uploading') && bitmap ? (
        <AvatarCropper
          bitmap={bitmap}
          isUploading={step === 'uploading'}
          error={error}
          onCancel={cancelCrop}
          onConfirm={(transform) => void confirmCrop(transform)}
        />
      ) : null}
    </div>
  )
}
