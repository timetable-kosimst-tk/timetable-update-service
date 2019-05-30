export interface Period {
  startHour: number
  endHour: number
  duration: number
  date?: string
  subjectShort: string
  subjectLong: string
  roomShort: string
  roomLong: string
  klasseShort?: string
  parsedDate: Date
  startTime?: number
  endTime?: number
  lessonId?: number
  id?: number
  cancelled?: boolean
}
