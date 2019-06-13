import fetch, { Headers } from 'node-fetch'

import db from './db'
import { fetchSource } from './middleware/fetchSource'
import { fetchSources } from './middleware/fetchSources'
import { fetchTeachers } from './middleware/fetchTeachers'
import { fetchTimes } from './middleware/fetchSource'
import { getSession } from './middleware/getSession'

import { Period } from './interfaces/Period'
import { fetchTimestamp } from './middleware/fetchTimestamp'

import express from 'express'
import { POINT_CONVERSION_COMPRESSED } from 'constants'

const flat = require('array.prototype.flat')
flat.shim()

const update = async () => {
  /**
   * Get last update time and put in in db
   */
  const lastTimestamp = await db
    .collection('timetables')
    .doc('stats')
    .get()
    .then((doc: any) => doc.data()['last-update'])
  const currentTimestamp = await fetchTimestamp()

  db.collection('timetables')
    .doc('stats')
    .set({
      'last-update': currentTimestamp,
    })

  console.info('Checking for new timetable...')

  if (currentTimestamp && currentTimestamp > lastTimestamp) {
    console.info('New timetable found, updating entries...')
    /**
     * Update klassen timetables
     */
    console.info('Klassen update initiated')

    const sources = await fetchSources(new Date())

    // Update teacher list
    const teacherList = await fetchTeachers(new Date()).then(res => {
      db.collection('sources')
        .doc('teachers')
        .set(res)
      console.info('Teacher list updated successfully')
      return res
    })

    // Put sources in db
    db.collection('sources')
      .doc('klassen')
      .set(sources)
      .then(() => {
        console.info('Klassen list updated successfully')
      })

    const entries = Object.entries(sources)

    const tasks = Promise.all(
      entries.map(
        ([name, id]) =>
          new Promise((resolve, reject) => {
            fetchSource(id, new Date())
              .then(async res => {
                if (res) {
                  const timetable = await Promise.all(
                    res.timetable.map(async day => {
                      const cookies = await getSession()
                      if (cookies) {
                        const headers = new Headers({
                          Cookie: cookies,
                        })
                        return await Promise.all(
                          day.map(async hour => {
                            return await Promise.all(
                              hour.map(async period => {
                                const url = `https://thalia.webuntis.com/WebUntis/api/public/period/info?date=${
                                  period.date
                                }&starttime=${period.startTime}&endtime=${
                                  period.endTime
                                }&elemid=${
                                  period.id
                                }&elemtype=1&ttFmtId=1&selectedPeriodId=${
                                  period.lessonId
                                }`

                                const details = (await fetch(url, {
                                  headers,
                                }).then(res => res.json())).data.blocks.filter(
                                  (el: any) =>
                                    el[0].subjectName === period.subjectShort && el[0].lesson.id === period.lessonId,
                                )[0][0]

                                return {
                                  ...period,
                                  teacherShort: details.teacherNameLong || '',
                                  teacherLong: details.teacherNameLong
                                    ? details.teacherNameLong
                                      .split(', ')
                                      .map((teacherName: any) => teacherList[teacherName])
                                      .join(', ')
                                    : '',
                                  klasseShort: details.klasseNameLong || '',
                                  studentGroups: details.studentGroups || '',
                                }
                              }),
                            )
                          }),
                        )
                      } else {
                        throw new Error('Could not not create session')
                      }
                    }),
                  )
                  const parsedTimetable = await Promise.all(
                    timetable.map(async day => {
                      const returnDay: any = {}
                      ;(await day).forEach((val, i) => {
                        returnDay[i] = val || null
                      })
                      return returnDay
                    }),
                  )
                  db.collection('timetables')
                    .doc(name)
                    .set({
                      timestamp: res.timestamp,
                      timetable: parsedTimetable,
                    })
                    .then(() => {
                      resolve(timetable)
                    })
                    .catch(reject)
                }
              })
              .catch(reject)
          }),
      ),
    )

    tasks
      .then(async timetables => {
        console.info('Klassen updated successfully')
        console.info('Teacher update initiated')

        const hours = timetables.flat(3)

        const teachers: any = {}
        hours.forEach(period => {
          if (period) {
            const teachersInvolved = period.teacherShort.split(', ')

            teachersInvolved.forEach((teacher: string) => {
              if (teachers[teacher]) {
                teachers[teacher].push(period)
              } else {
                teachers[teacher] = [period]
              }
            })
          }
        })

        const times = await fetchTimes()

        for (const [teacher, periods] of Object.entries(teachers)) {
          if (teacher && teacher !== '---') {
            const timetable: Period[][][] = [[], [], [], [], []]

            // @ts-ignore
            for (const hour of periods) {
              const startTime = hour.startTime
              const endTime = hour.endTime

              const startHour =
                times.filter(({ startTime: hour }) => startTime === hour)[0]
                  .period - 1
              const endHour =
                times.filter(({ endTime: hour }) => endTime === hour)[0]
                  .period - 1
              const duration = endHour - startHour + 1

              const {
                // @ts-ignore
                groups: { day, month, year },
              } = /(?<year>[0-9]{4})(?<month>[0-9]{2})(?<day>[0-9]{2})/.exec(
                hour.date,
              )

              const parsedDate = new Date(`${year}-${month}-${day}`)
              const weekDay = parsedDate.getDay() - 1

              timetable[weekDay][startHour] = [
                {
                  ...hour,
                },
              ]
            }

            const timetableParsed = timetable.map(day => {
              const returnDay: any = {}

              day.forEach((val, i) => {
                returnDay[i] = val
              })
              return returnDay
            })
            db.collection('timetables')
              .doc(teacher)
              .set({
                timestamp: Date.now(),
                timetable: timetableParsed,
              })
          }
        }
        console.log('Teachers updated successfully')
      })
      .catch(e => {
        console.error('Klassen update failed', e)
      })
  } else {
    console.info('Timetable is already newest version')
  }
}

const app = express()

app.get('/*', (req, res) => {
  update()

  res.sendStatus(202)
})

app.listen(process.env.PORT || 7000)

export default update