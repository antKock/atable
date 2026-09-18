// Lecture Apple Vision sur Mac — même API qu'iOS (VNRecognizeTextRequest),
// pour le banc « OCR sur l'appareil » (chantier du 2026-09-18).
//
// Usage : swiftc -O -parse-as-library vision-ocr.swift -o /tmp/vision-ocr
//         /tmp/vision-ocr [--doc] [--fast] [--no-correction] [--auto-lang] img1.jpg [img2.jpg …]
// Deux modes :
//  - par défaut : VNRecognizeTextRequest (iOS 13+), lignes dans l'ordre de Vision ;
//  - --doc : RecognizeDocumentsRequest (iOS 26+ / macOS 26+), qui regroupe en
//    paragraphes et listes → `transcript` dans l'ordre de lecture du document.
// Sortie (stdout) : un JSON par appel, une entrée par image :
//   { images: [{ path, width, height, ms, transcript?, lines: [{ text, confidence, x, y, w, h }] }] }
// Coordonnées normalisées (0-1), origine en HAUT à gauche (convertie depuis Vision).
// Ordre des lignes : celui de Vision (lecture haut → bas), non retrié ici — le
// banc garde l'ordre natif, c'est ce que ferait le plugin iOS.
import AppKit
import Foundation
import Vision

let args = Array(CommandLine.arguments.dropFirst())
let docMode = args.contains("--doc")
let fast = args.contains("--fast")
let correction = !args.contains("--no-correction")
let autoLang = args.contains("--auto-lang")
let paths = args.filter { !$0.hasPrefix("--") }

struct Line: Encodable {
  let text: String
  let confidence: Float
  let x: Double, y: Double, w: Double, h: Double
}
struct ImageResult: Encodable {
  let path: String
  let width: Int, height: Int
  let ms: Int
  var transcript: String? = nil
  let lines: [Line]
  let error: String?
}

func recognize(_ path: String) -> ImageResult {
  guard let image = NSImage(contentsOfFile: path),
    let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil)
  else {
    return ImageResult(path: path, width: 0, height: 0, ms: 0, lines: [], error: "lecture image")
  }
  let request = VNRecognizeTextRequest()
  request.recognitionLevel = fast ? .fast : .accurate
  request.usesLanguageCorrection = correction
  if autoLang {
    request.automaticallyDetectsLanguage = true
  } else {
    request.recognitionLanguages = ["fr-FR", "en-US"]
  }
  let started = Date()
  let handler = VNImageRequestHandler(cgImage: cg, options: [:])
  do {
    try handler.perform([request])
  } catch {
    return ImageResult(
      path: path, width: cg.width, height: cg.height, ms: 0, lines: [], error: "\(error)")
  }
  let ms = Int(Date().timeIntervalSince(started) * 1000)
  let lines = (request.results ?? []).compactMap { obs -> Line? in
    guard let top = obs.topCandidates(1).first else { return nil }
    let b = obs.boundingBox
    return Line(
      text: top.string, confidence: top.confidence,
      x: b.minX, y: 1 - b.maxY, w: b.width, h: b.height)
  }
  return ImageResult(path: path, width: cg.width, height: cg.height, ms: ms, lines: lines, error: nil)
}

/// Mode document : transcript dans l'ordre de lecture ; les lignes (texte,
/// confiance, position) restent celles de VNRecognizeTextRequest, pour que les
/// deux modes exposent les mêmes signaux au critère de secours.
@available(macOS 26.0, *)
func recognizeDocument(_ path: String) async -> ImageResult {
  var base = recognize(path)
  var request = RecognizeDocumentsRequest()
  request.textRecognitionOptions.recognitionLanguages = [
    Locale.Language(identifier: "fr-FR"), Locale.Language(identifier: "en-US"),
  ]
  request.textRecognitionOptions.useLanguageCorrection = correction
  let started = Date()
  do {
    let observations = try await request.perform(on: URL(fileURLWithPath: path))
    base.transcript = observations.map { $0.document.text.transcript }.joined(separator: "\n")
  } catch {
    return ImageResult(
      path: path, width: base.width, height: base.height, ms: 0, lines: base.lines,
      error: "\(error)")
  }
  return ImageResult(
    path: path, width: base.width, height: base.height,
    ms: Int(Date().timeIntervalSince(started) * 1000), transcript: base.transcript,
    lines: base.lines, error: nil)
}

struct Output: Encodable { let images: [ImageResult] }

@main
struct VisionOcr {
  static func main() async {
    var images: [ImageResult] = []
    for path in paths {
      if docMode, #available(macOS 26.0, *) {
        images.append(await recognizeDocument(path))
      } else {
        images.append(recognize(path))
      }
    }
    let enc = JSONEncoder()
    enc.outputFormatting = [.withoutEscapingSlashes]
    FileHandle.standardOutput.write(try! enc.encode(Output(images: images)))
  }
}
