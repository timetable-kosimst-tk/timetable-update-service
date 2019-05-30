import fetch, { Headers } from 'node-fetch'

import { getSession } from './getSession'
import { fetchSources } from './fetchSources'
import { fetchTimes } from './fetchSource'
import { Period } from '../interfaces/Period'

const flat = require('array.prototype.flat')
flat.shim()

export const fetchTeacher = async (teacher: string, date: Date) => {
  const urlGenerator = (id: number) =>
    `https://thalia.webuntis.com/WebUntis/api/public/timetable/weekly/data?elementType=1&elementId=${id}&date=${date.getFullYear()}-${String(
      date.getMonth() + 1,
    ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}&formatId=1`

  const sources = await fetchSources(date)

  const urls = Object.values(sources).map(urlGenerator)

  const cookies = await getSession()

  if (cookies) {
    const headers = new Headers({
      Cookie: cookies,
    })

    const timetables = await Promise.all(
      urls.map(url => fetch(url, { headers }).then(res => res.json())),
    )

    const hours = timetables
      .map(data => {
        const raw = data.data.result.data.elementPeriods
        const id = Object.keys(data.data.result.data.elementPeriods)[0]

        return raw[id].map((el: any) => {
          el.id = id
          return el
        })
      })
      .flat()

    const periodUrls = hours.map(
      hour =>
        `https://thalia.webuntis.com/WebUntis/api/public/period/info?date=${
          hour.date
        }&starttime=${hour.startTime}&endtime=${hour.endTime}&elemid=${
          hour.id
        }&elemtype=1&ttFmtId=1&selectedPeriodId=${hour.lessonId}`,
    )

    const periods = (await Promise.all(
      periodUrls.map(url => fetch(url, { headers }).then(res => res.json())),
    ))
      .map(period => period.data.blocks)
      .flat(2)
      .filter(period => period.teacherName === teacher)

    const times = await fetchTimes()

    const timetable: Period[][][] = [[], [], [], [], []]

    for (const hour of periods) {
      const startTime = hour.periods[0].startTime
      const endTime = hour.periods[0].endTime

      const startHour =
        times.filter(({ startTime: hour }) => startTime === hour)[0].period - 1
      const endHour =
        times.filter(({ endTime: hour }) => endTime === hour)[0].period - 1
      const duration = endHour - startHour + 1

      const {
        // @ts-ignore
        groups: { day, month, year },
      } = /(?<year>[0-9]{4})(?<month>[0-9]{2})(?<day>[0-9]{2})/.exec(
        hour.periods[0].date,
      )

      const parsedDate = new Date(`${year}-${month}-${day}`)
      const weekDay = parsedDate.getDay() - 1

      timetable[weekDay][startHour] = [
        {
          startHour,
          endHour,
          parsedDate,
          duration,
          roomShort: hour.periods[0].rooms.name,
          roomLong: hour.periods[0].rooms.longName,
          subjectShort: hour.subjectName,
          subjectLong: hour.subjectNameLong,
          klasseShort: hour.klasseName,
          cancelled: hour.periods[0].isCancelled,
        },
      ]
    }

    return { timetable }
  }
}
