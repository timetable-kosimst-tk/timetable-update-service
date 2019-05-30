import fetch, { Headers } from 'node-fetch'

import { Time } from '../interfaces/Time'
import { Detail } from '../interfaces/Detail'
import { Period } from '../interfaces/Period'

import { getSession } from './getSession'

export const fetchSources = async (date: Date) => {
  const url = `https://thalia.webuntis.com/WebUntis/api/public/timetable/weekly/pageconfig?type=1&id=342&date=${date.getFullYear()}-${String(
    date.getMonth() + 1,
  ).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}&formatId=1`

  const cookies = await getSession() || ''

  const headers = new Headers({
    Cookie: cookies,
  })

  const response = await fetch(url, {
    headers,
  })

  const {
    data: { elements: raw },
  } = await response.json()

  const sources: { [name: string]: number } = {}

  raw.forEach((source: any) => {
    sources[source.name] = source.id
  })

  return sources
}
