export type SpeechResult = 'speaking' | 'stopped' | 'no-voice' | 'unsupported'

/**
 * Reads text aloud, or stops if already speaking. Only on-device voices are used:
 * some browser voices stream the text to a server, which Recallify never does.
 */
export function toggleSpeech(text: string): SpeechResult {
  const synth = window.speechSynthesis
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return 'unsupported'
  if (synth.speaking) {
    synth.cancel()
    return 'stopped'
  }

  const language = navigator.language.slice(0, 2)
  const local = synth.getVoices().filter((voice) => voice.localService)
  const voice = local.find((v) => v.lang.startsWith(language)) ?? local[0]
  if (!voice) return 'no-voice'

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  synth.speak(utterance)
  return 'speaking'
}
