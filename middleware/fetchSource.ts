import fetch, { Headers } from 'node-fetch'

import { Time } from '../interfaces/Time'
import { Detail } from '../interfaces/Detail'
import { Period } from '../interfaces/Period'

import { getSession } from './getSession'

export const fetchSource = async (source: number, date: Date) => {
  const url = `https://thalia.webuntis.com/WebUntis/api/public/timetable/weekly/data?elementType=1&elementId=${source}&date=${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}&formatId=1`

  const cookies = await getSession()

  if (cookies) {
    const headers = new Headers({
      Cookie: cookies,
    })

    const response = await fetch(url, {
      headers,
    })

    try {
      const {
        data: {
          result: { data, lastImportTimestamp },
        },
      } = await response.json()
      const times = await fetchTimes()

      const timetable: Period[][][] = [[], [], [], [], []]

      const {
        elementPeriods: { [source]: hours },
        elements: details,
      }: { elementPeriods: any; elements: Detail[] } = data

      for (const {
        startTime,
        endTime,
        elements,
        date: rawDate,
        lessonId,
        lessonText,
        cellState,
      } of hours) {
        const startHour =
          times.filter(({ startTime: hour }) => startTime === hour)[0].period -
          1
        const endHour =
          times.filter(({ endTime: hour }) => endTime === hour)[0].period - 1
        const duration = endHour - startHour + 1

        const {
          // @ts-ignore
          groups: { day, month, year },
        } = /(?<year>[0-9]{4})(?<month>[0-9]{2})(?<day>[0-9]{2})/.exec(rawDate)

        const parsedDate = new Date(`${year}-${month}-${day}`)
        const weekDay = parsedDate.getDay() - 1

        const period: Period = {
          subjectShort: '',
          subjectLong: '',
          roomShort: '?',
          roomLong: '?',
          startHour,
          endHour,
          duration,
          parsedDate,
          startTime,
          endTime,
          lessonId,
          id: source,
          date: rawDate,
          cancelled: cellState === 'CANCEL',
          substitution: cellState === 'SHIFT' || cellState === 'ADDITIONAL',
        }

        for (const { type, id } of elements) {
          /**
           * Type 3: Subject
           * Type 4: Room
           */

          const { name: shortName, longName } = details.filter(
            detail => detail.id === id && detail.type === type,
          )[0]

          period[type === 3 ? 'subjectShort' : 'roomShort'] = shortName
          period[type === 3 ? 'subjectLong' : 'roomLong'] = longName
        }

        if (period.subjectShort === '') {
          period.subjectLong = lessonText || '?'
        }

        if (timetable[weekDay][startHour]) {
          timetable[weekDay][startHour].push(period)
        } else {
          timetable[weekDay][startHour] = [period]
        }
      }

      return { timestamp: lastImportTimestamp, timetable }
    } catch (e) {
      console.error(`Error while fetching timetable for ${source}`, e)
      return null
    }
  } else {
    return null
  }
}

export const fetchTimes = async () => {
  const cookies = await getSession()

  const headers = new Headers({
    Cookie: cookies || '',
  })

  const response = await fetch(
    'https://thalia.webuntis.com/WebUntis/api/public/timegrid?schoolyearId=10',
    {
      headers,
    },
  )

  const {
    data: { rows: times },
  }: { data: { rows: Time[] } } = await response.json()

  return times
}
