import fetch, { Headers } from 'node-fetch'

import { Time } from '../interfaces/Time'
import { Detail } from '../interfaces/Detail'
import { Period } from '../interfaces/Period'

import { getSession } from './getSession'

export const fetchTeachers = async (date: Date) => {
  const url = `https://thalia.webuntis.com/WebUntis/api/public/officehours/hours?date=${date.getFullYear()}${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}&klasseId=-1`

  const cookies = (await getSession()) || ''

  const headers = new Headers({
    Cookie: cookies,
  })

  const response = await fetch(url, {
    headers,
  })

  const { data: raw } = await response.json()

  const teachers: { [short: string]: string } = {}

  raw.forEach(({ teacher }: { teacher: string }) => {
    const split = teacher.split('(')
    const short = split[1].replace(')', '')

    const name = split[0].split(', ').reverse().join(' ')

    teachers[short] = name
  })

  return teachers
}
