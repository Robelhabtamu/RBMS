import { useEffect, useRef, useState } from 'react'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

type PaymentProofPickerProps = {
  file?: File
  onChange: (file: File | undefined) => void
  onError: (message: string | null) => void
}

export function PaymentProofPicker({ file, onChange, onError }: PaymentProofPickerProps) {
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function selectFile(selected?: File) {
    if (!selected) return
    if (!selected.type.startsWith('image/')) {
      onChange(undefined)
      onError('Please select an image.')
      return
    }
    if (selected.size > MAX_IMAGE_BYTES) {
      onChange(undefined)
      onError('Image is too large. Choose an image smaller than 10 MB.')
      return
    }
    onError(null)
    onChange(selected)
  }

  function clearFile() {
    onChange(undefined)
    onError(null)
    if (cameraInput.current) cameraInput.current.value = ''
    if (galleryInput.current) galleryInput.current.value = ''
  }

  function openCamera() {
    if (cameraInput.current) {
      cameraInput.current.value = ''
      cameraInput.current.click()
    }
  }

  function openGallery() {
    if (galleryInput.current) {
      galleryInput.current.value = ''
      galleryInput.current.click()
    }
  }

  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm" aria-labelledby="payment-proof-title">
      <h2 id="payment-proof-title" className="text-sm font-bold tracking-wide">PAYMENT VERIFICATION <span className="text-redbooth-600" aria-hidden="true">*</span><span className="sr-only">required</span></h2>

      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="Take payment verification photo with rear camera"
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        aria-label="Choose payment verification photo from gallery"
        className="sr-only"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      {previewUrl ? (
        <div className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-gray-100">
            <img src={previewUrl} alt="Selected payment verification preview" className="h-56 w-full object-contain" />
          </div>
          <p className="mt-3 text-sm font-semibold text-green-700">✓ Verification photo ready</p>
          <p className="mt-1 truncate text-xs text-gray-500">{file?.name}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={openCamera} className="min-h-12 rounded-xl border border-redbooth-200 bg-redbooth-50 px-3 text-sm font-bold text-redbooth-700">Retake Photo</button>
            <button type="button" onClick={openGallery} className="min-h-12 rounded-xl border bg-white px-3 text-sm font-bold text-gray-700">Change Photo</button>
          </div>
          <button type="button" onClick={clearFile} className="mt-2 min-h-11 w-full text-sm font-semibold text-gray-500">Remove photo</button>
        </div>
      ) : (
        <div className="mt-4">
          <button type="button" onClick={openCamera} className="flex min-h-20 w-full items-center justify-center rounded-2xl border-2 border-redbooth-200 bg-redbooth-50 px-5 text-base font-bold text-redbooth-700">
            <span className="mr-2 text-xl" aria-hidden="true">📷</span> TAKE PHOTO
          </button>
          <button type="button" onClick={openGallery} className="mt-3 min-h-12 w-full rounded-xl border bg-white px-4 text-sm font-bold text-gray-700">CHOOSE FROM GALLERY</button>
          <p className="mt-3 text-center text-xs text-gray-500">Image required · Maximum 10 MB</p>
        </div>
      )}
    </section>
  )
}
