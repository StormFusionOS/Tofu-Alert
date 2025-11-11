import tesseract from 'node-tesseract-ocr'

export interface OCRResult {
  text: string
  confidence: number
}

export async function extractTextFromImage(imagePath: string): Promise<OCRResult> {
  try {
    const config = {
      lang: 'eng',
      oem: 1,
      psm: 3,
    }

    const text = await tesseract.recognize(imagePath, config)

    return {
      text: text.trim(),
      confidence: 0.8, // Tesseract doesn't provide per-document confidence easily
    }
  } catch (error) {
    console.error('OCR error:', error)
    return {
      text: '',
      confidence: 0,
    }
  }
}

export async function extractTextFromMultipleFrames(framePaths: string[]): Promise<OCRResult> {
  const results = await Promise.all(framePaths.map((path) => extractTextFromImage(path)))

  // Combine all text
  const combinedText = results.map((r) => r.text).join(' ')

  // Average confidence
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length

  return {
    text: combinedText,
    confidence: avgConfidence,
  }
}
