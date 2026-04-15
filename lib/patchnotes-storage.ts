import fs from "fs"
import path from "path"
import type { PatchNote } from "@/types/patchnote"
import { safeJsonParse } from "./security"

const DATA_DIR = path.join(process.cwd(), "data")
const PATCHNOTES_FILE = path.join(DATA_DIR, "patchnotes.json")

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

export function loadPatchNotes(): PatchNote[] {
  try {
    if (fs.existsSync(PATCHNOTES_FILE)) {
      const data = fs.readFileSync(PATCHNOTES_FILE, "utf-8")
      if (!data || data.trim().length === 0) return []
      return safeJsonParse<PatchNote[]>(data, [])
    }
  } catch (error) {
    console.error("Error loading patchnotes:", error)
  }
  return []
}

export function savePatchNotes(notes: PatchNote[]) {
  fs.writeFileSync(PATCHNOTES_FILE, JSON.stringify(notes, null, 2))
}

export function getAllPatchNotes(): PatchNote[] {
  return loadPatchNotes().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPatchNoteById(id: string): PatchNote | null {
  return loadPatchNotes().find((item) => item.id === id) || null
}

export function createPatchNote(note: Omit<PatchNote, "id">): PatchNote {
  const notes = loadPatchNotes()
  const id = `patch-${Date.now()}`
  const newNote: PatchNote = { ...note, id }
  notes.push(newNote)
  savePatchNotes(notes)
  return newNote
}

export function updatePatchNote(id: string, updates: Partial<PatchNote>): PatchNote | null {
  const notes = loadPatchNotes()
  const index = notes.findIndex((item) => item.id === id)
  if (index === -1) return null
  notes[index] = { ...notes[index], ...updates, id }
  savePatchNotes(notes)
  return notes[index]
}

export function deletePatchNote(id: string): boolean {
  const notes = loadPatchNotes()
  const filtered = notes.filter((item) => item.id !== id)
  if (filtered.length === notes.length) return false
  savePatchNotes(filtered)
  return true
}
