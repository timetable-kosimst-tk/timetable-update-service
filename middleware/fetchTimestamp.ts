import fetch, { Headers } from 'node-fetch'

import { getSession } from './getSession'

export const fetchTimestamp = async () => {
  const date = new Date()
  const url = `https://thalia.webuntis.com/WebUntis/api/public/timetable/weekly/data?elementType=1&elementId=${507}&date=${date.getFullYear()}-${String(
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
          result: { lastImportTimestamp },
        },
      } = await response.json()

       

      return lastImportTimestamp as number
    } catch (e) {
      return null
    }
  } else {
    return null
  }
}
