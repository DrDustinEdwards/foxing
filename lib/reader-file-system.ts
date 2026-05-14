// Local replacement for @epubjs-react-native/expo-file-system's useFileSystem.
// The upstream adapter imports from "expo-file-system", which on SDK 54 is
// the new "next" API — its writeAsStringAsync signature breaks epub.js's
// jszip cache step ("failed to write jszip js file"). The legacy API is
// re-exported at the "expo-file-system/legacy" subpath; mirror the adapter
// shape but pull every function from there.
import { useCallback, useState } from 'react'
import * as FileSystem from 'expo-file-system/legacy'

export function useFileSystem() {
  const [file, setFile] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [size, setSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const downloadFile = useCallback(
    async (fromUrl: string, toFile: string) => {
      const callback: FileSystem.FileSystemNetworkTaskProgressCallback<FileSystem.DownloadProgressData> = (
        downloadProgress,
      ) => {
        const currentProgress = Math.round(
          (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100,
        )
        setProgress(currentProgress)
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        fromUrl,
        FileSystem.documentDirectory + toFile,
        { cache: true },
        callback,
      )

      setDownloading(true)
      try {
        const value = await downloadResumable.downloadAsync()
        if (!value) throw new Error('Download failed')
        if (value.headers['Content-Length']) {
          setSize(Number(value.headers['Content-Length']))
        }
        setSuccess(true)
        setError(null)
        setFile(value.uri)
        return { uri: value.uri, mimeType: value.mimeType }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error downloading file')
        return { uri: null, mimeType: null }
      } finally {
        setDownloading(false)
      }
    },
    [],
  )

  const getFileInfo = useCallback(async (fileUri: string) => {
    const info = await FileSystem.getInfoAsync(fileUri)
    return {
      uri: info.uri,
      exists: info.exists,
      isDirectory: 'isDirectory' in info ? info.isDirectory : false,
      size: 'size' in info ? info.size : undefined,
    }
  }, [])

  return {
    file,
    progress,
    downloading,
    size,
    error,
    success,
    documentDirectory: FileSystem.documentDirectory,
    cacheDirectory: FileSystem.cacheDirectory,
    bundleDirectory: FileSystem.bundleDirectory || undefined,
    readAsStringAsync: FileSystem.readAsStringAsync,
    writeAsStringAsync: FileSystem.writeAsStringAsync,
    deleteAsync: FileSystem.deleteAsync,
    downloadFile,
    getFileInfo,
  }
}
